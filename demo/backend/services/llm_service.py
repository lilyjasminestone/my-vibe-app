import json
from typing import Any, Dict, List, Optional

from backend.library.llmclient import LLMClient
from backend.utils.logger import log

# 创建全局 LLM 客户端实例
_llm_client = LLMClient()


async def cleanup_llm_client():
    """清理全局 LLM 客户端"""
    await _llm_client.aclose()


async def chat_completion(
    message: str,
    model: str,
    temperature: float,
    session_id: str,
    trace_id: str,
    user_id: str,
    context: Optional[List[Dict[str, str]]] = None,
) -> Optional[Dict[str, Any]]:
    """
    发送聊天请求

    Args:
        message: 聊天消息内容
        model: LLM模型名称
        temperature: 温度参数
        session_id: 会话ID
        trace_id: 追踪ID
        user_id: 用户ID
        context: 上下文消息列表
    """
    try:
        result = await _llm_client.chat_completion(
            message=message,
            model=model,
            temperature=temperature,
            session_id=session_id,
            trace_id=trace_id,
            user_id=user_id,
            context=context,
        )

        return result
    except Exception as e:
        log.error("LLM 服务错误", error=str(e))
        return {"success": False, "error": f"请求异常: {str(e)}"}


async def chat_completion_stream(
    message: str,
    model: str,
    temperature: float,
    session_id: str,
    trace_id: str,
    user_id: str,
    context: Optional[List[Dict[str, str]]] = None,
):
    """
    发送流式聊天请求

    Args:
        message: 聊天消息内容
        model: LLM模型名称
        temperature: 温度参数
        session_id: 会话ID
        trace_id: 追踪ID
        user_id: 用户ID
        context: 上下文消息列表

    Yields:
        SSE 格式的流式响应数据
    """
    try:
        async for chunk in _llm_client.chat_completion_sse(
            message=message,
            model=model,
            temperature=temperature,
            session_id=session_id,
            trace_id=trace_id,
            user_id=user_id,
            context=context,
        ):
            # 将字典转换为 SSE 格式
            if chunk.get("success"):
                if "delta" in chunk:
                    # 发送内容数据
                    data = {"content": chunk["delta"]}
                    yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
            else:
                # 发送错误数据
                error_data = {
                    "error": chunk.get("error", "未知错误"),
                    "details": chunk.get("details", ""),
                }
                yield f"event: error\ndata: {json.dumps(error_data, ensure_ascii=False)}\n\n"

        # 发送完成信号
        yield "data: [DONE]\n\n"

    except Exception as e:
        log.error("LLM 流式服务错误", error=str(e))
        # 发送错误事件
        error_data = {"error": f"请求异常: {str(e)}"}
        yield f"event: error\ndata: {json.dumps(error_data, ensure_ascii=False)}\n\n"
