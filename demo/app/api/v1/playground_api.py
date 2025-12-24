"""
PlayGround API 路由
演示和测试接口
"""

import uuid
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse

from app.models.base import BaseResponse
from app.utils.trace import get_trace_id

if TYPE_CHECKING:
    from app.services.playground_service import PlayGroundService

from app.api.deps import get_playground_service
from app.models.markdown_flow import MarkdownFlowInfoRequest, PlaygroundRunRequest
from app.models.document import SaveDocumentRequest
from app.utils.response import res

playground_api_router = APIRouter(prefix="/playground", tags=["Playground Api"])


@playground_api_router.post("/generate", summary="流式LLM生成")
async def generate_with_llm(
    playground_request: PlaygroundRunRequest,
    request: Request,
    service: "PlayGroundService" = Depends(get_playground_service),
    session_id: str = Header(None, alias="Session-Id"),
    user_id: str = Header(None, alias="User-Id"),
):
    """
    使用 LLM 生成内容（流式输出，Server-Sent Events）

    **请求参数 (PlaygroundRunRequest)：**
    - **content** (string, 必填): Markdown-Flow 原文内容
    - **block_index** (integer, 必填): 要处理的块索引（从0开始）
    - **context** (array<ChatMessage>, 可选): 上下文消息列表
    - **variables** (object, 可选): 变量映射字典
    - **user_input** (object, 可选): 用户输入内容，遇到交互块时用户的输入
      - 格式: `{"变量名": ["值1", "值2", ...]}`
      - 示例: `{"corp": ["蜜雪冰城"]}` 或 `{"hobby": ["阅读", "旅游"]}`
      - 注意: 不管是单选、多选还是文本输入，值都应该是数组形式
    - **document_prompt** (string, 可选): 文档级系统提示词
    - **interaction_prompt** (string, 可选): 交互块渲染提示词
    - **interaction_error_prompt** (string, 可选): 交互错误提示词
    - **model** (string, 可选): LLM模型名称
    - **temperature** (float, 可选): LLM温度参数，取值范围0.0-2.0，null表示使用系统默认值

    **Header 参数：**
    - **Session-Id** (string, 可选): 会话ID
    - **User-Id** (string, 可选): 用户ID

    **响应格式 (Server-Sent Events)：**
    - **Content-Type**: text/event-stream
    - **数据格式**: data: {JSON格式的SSE消息}\\n\\n
    - **错误格式**: data: [ERROR] {错误信息}\\n\\n

    **SSE消息格式：**
    ```json
    // 内容块消息
    {
      "type": "content",
      "data": "生成的文本片段"
    }

    // 交互块消息
    {
      "type": "interaction",
      "data": {
        "content": "交互内容",
        "variable": "变量名"
      }
    }

    // 结束消息
    {
      "type": "text_end",
      "data": ""
    }
    ```

    **流式数据示例：**
    ```
    data: {"type":"content","data":"这是第一个文本片段"}

    data: {"type":"content","data":"，继续生成内容"}

    data: {"type":"text_end","data":""}

    ```

    **处理逻辑：**
    - **内容块**: 使用LLM进行流式生成，逐步返回生成的文本片段
    - **交互块**:
      - 无 user_input: 返回渲染后的交互内容（一次性返回）
      - 有 user_input: 仅提取变量，返回空内容

    **特殊处理：**
    - 自动转义换行符以保持SSE格式正确
    - 错误时提供详细错误信息和调试详情
    """

    # 获取或生成 session_id 和 user_id
    header_session_id = request.headers.get("Session-Id")
    header_user_id = request.headers.get("User-Id")

    # 如果没有提供 session_id，自动生成一个
    final_session_id = (
        session_id or header_session_id or f"playground-{uuid.uuid4().hex[:8]}"
    )
    final_user_id = user_id or header_user_id or "playground-user"
    trace_id = get_trace_id()

    async def event_generator():
        try:
            # 固定输出语言为中文
            final_output_language = "Simplified Chinese"

            # 简化的API层 - session追踪由服务层装饰器处理
            for chunk in service.generate_with_llm(
                content=playground_request.content,
                block_index=playground_request.block_index,
                context=playground_request.context,
                variables=playground_request.variables,
                user_input=playground_request.user_input,
                document_prompt=playground_request.document_prompt,
                interaction_prompt=playground_request.interaction_prompt,
                interaction_error_prompt=playground_request.interaction_error_prompt,
                model=playground_request.model,
                temperature=playground_request.temperature,
                session_id=final_session_id,
                user_id=final_user_id,
                trace_id=trace_id,
                output_language=final_output_language,
            ):
                # 检测客户端是否断开连接
                if await request.is_disconnected():
                    break

                if chunk.get("success", True):
                    # 使用新的 JSON 格式发送 SSE 消息
                    sse_message = chunk.get("sse_message")
                    if sse_message:
                        import json

                        yield f"data: {json.dumps(sse_message, ensure_ascii=False)}\n\n"
                else:
                    # 返回详细错误信息
                    error_msg = chunk.get("error", "未知错误")
                    details = chunk.get("details", "")
                    if details:
                        yield f"data: [ERROR] {error_msg} - 详细信息: {details}\n\n"
                    else:
                        yield f"data: [ERROR] {error_msg}\n\n"
                    yield "data: {\"type\":\"text_end\",\"data\":{\"mdflow\":\"\"}}\n\n"
                    break
        except ValueError as e:
            yield f"data: [ERROR] {str(e)}\n\n"
            yield "data: {\"type\":\"text_end\",\"data\":{\"mdflow\":\"\"}}\n\n"
        except Exception as e:
            yield f"data: [ERROR] 生成失败: {str(e)}\n\n"
            yield "data: {\"type\":\"text_end\",\"data\":{\"mdflow\":\"\"}}\n\n"

        # 不再发送 [DONE] 标记，因为 text_end 类型已经表示结束

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@playground_api_router.post(
    "/markdownflow_info",
    response_model=BaseResponse,
    summary="获取Markdown-Flow文档信息",
)
async def markdownflow_info(
    request: MarkdownFlowInfoRequest,
    service: "PlayGroundService" = Depends(get_playground_service),
) -> BaseResponse:
    """
    获取 Markdown-Flow 文档的结构统计信息

    **请求参数 (MarkdownFlowInfoRequest)：**
    - **content** (string, 必填): 完整的 Markdown-Flow 文档内容
    - **document_prompt** (string, 可选): 文档级系统提示词

    **响应数据 (BaseResponse.data)：**
    - **block_count** (integer | null): 文档中的块总数
    - **variables** (array<string> | null): 去重后的所有变量列表
      - 包括文档内容中的变量
      - 包括 document_prompt 中的变量
    - **interaction_blocks** (array<integer>): 交互块的索引列表
    - **content_blocks** (array<integer>): 内容块的索引列表

    **响应示例：**
    ```json
    {
      "success": true,
      "message": "操作成功",
      "data": {
        "block_count": 5,
        "variables": ["用户名", "年龄", "兴趣爱好"],
        "interaction_blocks": [1, 3],
        "content_blocks": [0, 2, 4]
      }
    }
    ```

    **分析能力：**
    - 自动识别不同类型的块（内容块 vs 交互块）
    - 提取所有变量引用，包括嵌套变量
    - 统计文档结构信息
    - 合并多个来源的变量定义

    **适用场景：**
    - 文档结构预览和分析
    - 变量依赖关系检查
    - 交互流程设计验证
    - 文档复杂度评估
    """
    try:
        # 固定输出语言为中文
        final_output_language = "Simplified Chinese"

        result = service.get_markdownflow_info(
            content=request.content,
            document_prompt=request.document_prompt,
            output_language=final_output_language,
        )
        return res.info(data=result.model_dump())
    except Exception as e:
        return res.error(message=f"获取文档信息失败: {str(e)}")


@playground_api_router.post(
    "/generate-complete", response_model=BaseResponse, summary="完整LLM生成"
)
async def generate_complete(
    playground_request: PlaygroundRunRequest,
    request: Request,
    service: "PlayGroundService" = Depends(get_playground_service),
    session_id: str = Header(None, alias="Session-Id"),
    user_id: str = Header(None, alias="User-Id"),
) -> BaseResponse:
    """
    使用 LLM 生成内容（非流式，一次性返回完整结果）

    **请求参数 (PlaygroundRunRequest)：**
    - **content** (string, 必填): Markdown-Flow 原文内容
    - **block_index** (integer, 必填): 要处理的块索引（从0开始）
    - **context** (array<ChatMessage>, 可选): 上下文消息列表
    - **variables** (object, 可选): 变量映射字典
    - **user_input** (object, 可选): 用户输入内容，遇到交互块时用户的输入
      - 格式: `{"变量名": ["值1", "值2", ...]}`
      - 示例: `{"corp": ["蜜雪冰城"]}` 或 `{"hobby": ["阅读", "旅游"]}`
      - 注意: 不管是单选、多选还是文本输入，值都应该是数组形式
    - **document_prompt** (string, 可选): 文档级系统提示词
    - **interaction_prompt** (string, 可选): 交互块渲染提示词
    - **interaction_error_prompt** (string, 可选): 交互错误提示词
    - **model** (string, 可选): LLM模型名称
    - **temperature** (float, 可选): LLM温度参数，取值范围0.0-2.0，null表示使用系统默认值

    **Header 参数：**
    - **Session-Id** (string, 可选): 会话ID
    - **User-Id** (string, 可选): 用户ID
    - **Output-Language** (string, 可选): 输出语言 locale code（例如 'zh', 'en'）

    **响应数据 (BaseResponse.data)：**
    - **content** (string): 生成的完整内容
      - 无 user_input: 渲染后的最终交互内容
      - 有 user_input: 空字符串（表示仅提取变量）
    - **prompt_used** (string): 实际使用的提示词
    - **model_used** (string): 实际使用的LLM模型
    - **block_used** (Block): 使用的块信息
      - content (string): 原始块内容
      - block_type (string): 块类型
      - index (integer): 块索引
      - variables (array<string>): 变量列表
    - **variables_replaced** (object): 实际替换的变量键值对

    **响应示例：**
    ```json
    {
      "success": true,
      "message": "操作成功",
      "data": {
        "content": "这是LLM生成的完整内容...",
        "prompt_used": "实际使用的提示词",
        "model_used": "gpt-4o-mini",
        "block_used": {
          "content": "原始块内容",
          "block_type": "content",
          "index": 0,
          "variables": ["变量1"]
        },
        "variables_replaced": {"变量1": "替换值"}
      }
    }
    ```

    **处理逻辑：**
    - **内容块**: 使用LLM生成完整内容，等待生成完成后一次性返回
    - **交互块**:
      - 无 user_input: 返回渲染后的完整交互内容
      - 有 user_input: 仅提取变量，返回空内容字符串

    **与流式生成的区别：**
    - **响应方式**: 一次性返回完整结果 vs 逐步流式返回
    - **适用场景**: 批处理和API集成 vs 实时展示和用户体验
    - **性能特点**: 完整结果便于后续处理 vs 低延迟的用户体验

    **适用场景：**
    - 批量内容生成和处理
    - 需要完整结果进行后续分析的场景
    - API 集成和自动化处理
    - 交互块的完整渲染
    """
    # 获取或生成 session_id 和 user_id
    header_session_id = request.headers.get("Session-Id")
    header_user_id = request.headers.get("User-Id")

    # 如果没有提供 session_id，自动生成一个
    final_session_id = (
        session_id or header_session_id or f"playground-{uuid.uuid4().hex[:8]}"
    )
    final_user_id = user_id or header_user_id or "playground-user"
    trace_id = get_trace_id()

    try:
        # 固定输出语言为中文
        final_output_language = "Simplified Chinese"

        result = service.generate_with_llm_complete(
            content=playground_request.content,
            block_index=playground_request.block_index,
            context=playground_request.context,
            variables=playground_request.variables,
            user_input=playground_request.user_input,
            document_prompt=playground_request.document_prompt,
            interaction_prompt=playground_request.interaction_prompt,
            interaction_error_prompt=playground_request.interaction_error_prompt,
            model=playground_request.model,
            temperature=playground_request.temperature,
            session_id=final_session_id,
            user_id=final_user_id,
            trace_id=trace_id,
            output_language=final_output_language,
        )
        return res.info(data=result.model_dump())
    except ValueError as e:
        return res.error(message=str(e))
    except Exception as e:
        return res.error(message=f"生成失败: {str(e)}")


@playground_api_router.get(
    "/history",
    response_model=BaseResponse,
    summary="获取历史记录",
)
async def get_history(
    limit: int = 5,
    service: "PlayGroundService" = Depends(get_playground_service),
) -> BaseResponse:
    """
    获取最近的生成历史记录（内存存储）
    
    **请求参数：**
    - **limit** (integer, 可选): 返回记录数量，默认 5 条
    
    **响应数据 (BaseResponse.data)：**
    - **history** (array<HistoryItem>): 历史记录列表
    - **total** (integer): 总记录数
    """
    try:
        result = service.get_history(limit=limit)
        return res.info(data=result.model_dump())
    except Exception as e:
        return res.error(message=f"获取历史记录失败: {str(e)}")


@playground_api_router.post(
    "/save",
    response_model=BaseResponse,
    summary="保存文档",
)
async def save_document(
    request: SaveDocumentRequest,
    service: "PlayGroundService" = Depends(get_playground_service),
) -> BaseResponse:
    """
    保存 MarkdownFlow 文档
    
    **请求参数 (SaveDocumentRequest)：**
    - **title** (string, 必填): 文档标题
    - **content** (string, 必填): Markdown-Flow 内容
    
    **响应数据 (BaseResponse.data)：**
    - **file_path** (string): 保存的文件路径
    """
    try:
        result = service.save_document(title=request.title, content=request.content)
        return res.info(message="文档保存成功", data=result.model_dump())
    except Exception as e:
        return res.error(message=f"保存失败: {str(e)}")
