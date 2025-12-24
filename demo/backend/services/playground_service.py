"""
重构后的 PlayGround 服务层

简化为纯委托模式，所有复杂逻辑都由 MarkdownFlow 内部处理。
"""

from typing import Dict, Generator, List, Optional

from markdown_flow import MarkdownFlow, ProcessMode
from markdown_flow.llm import LLMResult

from backend.config.settings import settings
from backend.library.llm_provider import PlaygroundLLMProvider
from backend.library.llmclient import LLMClient
from backend.models.markdown_flow import (
    Block,
    ChatMessage,
    LLMGenerateResponse,
    MarkdownFlowInfoResponse,
    HistoryItem,
    HistoryResponse,
)
from backend.models.document import SaveDocumentResponseData
import os
import re
from datetime import datetime

# 创建共享的 LLM 客户端实例，避免每次请求都创建新的客户端
_shared_llm_client = LLMClient()


async def cleanup_playground_llm_client():
    """清理 PlayGround 服务的共享 LLM 客户端"""
    await _shared_llm_client.aclose()


class PlayGroundService:
    """PlayGround 服务类"""
    
    # 内存中存储历史记录 (类变量，所有实例共享)
    _history_store: List[HistoryItem] = []
    _history_id_counter: int = 1

    def __init__(self):
        self.llm_client = _shared_llm_client
        self.llm_provider = PlaygroundLLMProvider(self.llm_client)

    def _add_history(self, content: str, block_count: int):
        """添加历史记录"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content_preview = content[:50] + "..." if len(content) > 50 else content
        
        item = HistoryItem(
            id=PlayGroundService._history_id_counter,
            created_at=now,
            content_preview=content_preview,
            block_count=block_count
        )
        
        # 添加到列表开头
        PlayGroundService._history_store.insert(0, item)
        PlayGroundService._history_id_counter += 1
        
        # 保持最多 100 条记录
        if len(PlayGroundService._history_store) > 100:
            PlayGroundService._history_store = PlayGroundService._history_store[:100]

    def get_history(self, limit: int = 5) -> HistoryResponse:
        """获取最近的历史记录"""
        history = PlayGroundService._history_store[:limit]
        return HistoryResponse(
            history=history,
            total=len(PlayGroundService._history_store)
        )

    def generate_with_llm(
        self,
        content: str,
        block_index: int,
        context: Optional[List[ChatMessage]] = None,
        variables: Optional[Dict[str, str]] = None,
        user_input: Optional[Dict[str, List[str]]] = None,
        document_prompt: Optional[str] = None,
        interaction_prompt: Optional[str] = None,
        interaction_error_prompt: Optional[str] = None,
        model: str = None,
        temperature: Optional[float] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        output_language: Optional[str] = None,
    ) -> Generator[Dict, None, None]:
        """
        使用 LLM 生成内容（流式）- 交给 MarkdownFlow

        Args:
            content: Markdown 文档内容
            block_index: 块索引
            context: 上下文消息列表
            variables: 变量映射
            user_input: 用户输入内容
            document_prompt: 文档系统提示词
            interaction_prompt: 交互提示词
            interaction_error_prompt: 交互错误提示词
            model: 使用的模型名称
            temperature: 温度参数，如果未指定则使用配置默认值
            output_language: 输出语言 locale code（例如 'zh', 'en'）

        Yields:
            Dict: 流式内容片段
        """
        # 使用默认模型如果未指定
        if model is None:
            model = settings.llm_model

        # 创建支持模型和温度参数的 LLM 提供者
        effective_temperature = (
            temperature if temperature is not None else settings.llm_temperature
        )
        llm_provider = PlaygroundLLMProvider(
            llm_client=self.llm_client, model=model, temperature=effective_temperature
        )
        llm_provider.set_session_id(session_id)
        llm_provider.set_trace_id(trace_id)
        llm_provider.set_user_id(user_id)
        llm_provider.set_variables(variables)
        llm_provider.set_user_input(user_input)

        # 创建 MarkdownFlow 实例
        mf = MarkdownFlow(
            content,
            llm_provider=llm_provider,
            document_prompt=document_prompt,
            interaction_prompt=interaction_prompt,
            interaction_error_prompt=interaction_error_prompt,
        )
        
        # 记录历史 (仅当不是单独处理某个块时记录，这里简单判断如果 block_index 为 0 则记录)
        # 或者更合理的逻辑是：每次有实质性内容生成时记录。
        # 这里简化处理：在开始处理时记录一次
        if block_index == 0:
            self._add_history(content, mf.block_count)

        # 设置输出语言（API层已固定为"Simplified Chinese"）
        if output_language:
            mf.set_output_language(output_language)

        # 转换上下文格式
        context_dict = self._convert_context_to_dict(context) if context else None

        # 调用统一处理方法
        result = mf.process(
            block_index=block_index,
            mode=ProcessMode.STREAM,
            context=context_dict,
            variables=variables,
            user_input=user_input,
        )

        generated_content = ""

        # 获取当前块信息，用于确定 SSE 消息类型
        current_block = mf.get_block(block_index)

        # 处理结果
        if hasattr(result, "__iter__") and not isinstance(result, (str, bytes)):
            # 流式结果 - 实时发送，收集完整内容
            chunk_count = 0
            for chunk in result:
                chunk_count += 1
                if hasattr(chunk, "content") and chunk.content:
                    generated_content += chunk.content
                # 实时发送每个数据块，需要判断是否为用户输入验证阶段
                is_user_input_validation = bool(user_input)  # 有用户输入说明是验证阶段
                sse_result = self._convert_to_sse_format(
                    chunk,
                    False,
                    current_block,
                    is_user_input_validation=is_user_input_validation,
                )
                # 只有当 sse_message 不为 None 时才发送
                if sse_result.get("sse_message") is not None:
                    yield sse_result

            # 发送完成标记，需要判断是否为用户输入验证阶段
            is_user_input_validation = bool(user_input)  # 有用户输入说明是验证阶段
            yield self._convert_to_sse_format(
                LLMResult(content=""),
                True,
                current_block,
                is_user_input_validation=is_user_input_validation,
            )

        else:
            # 非流式结果（如交互变量提取）
            if hasattr(result, "content"):
                generated_content = result.content

            # 检查是否是交互块（静态或动态转换的）
            from markdown_flow.enums import BlockType as MFBlockType

            is_interaction_block = (
                current_block
                and hasattr(current_block, "block_type")
                and current_block.block_type == MFBlockType.INTERACTION
            )

            if is_interaction_block:
                # 交互块处理
                is_user_input_validation = bool(user_input)  # 有用户输入说明是验证阶段

                if is_user_input_validation:
                    # 用户输入验证阶段：只返回验证结果
                    if result.content and result.content.strip():
                        # 验证失败，先发送错误消息再结束
                        yield self._convert_to_sse_format(
                            result,
                            False,
                            current_block,
                            is_user_input_validation=True,
                        )
                        yield self._convert_to_sse_format(
                            LLMResult(content=""),
                            True,
                            current_block,
                            is_user_input_validation=True,
                        )
                    else:
                        # 验证通过，直接发送结束标记
                        yield self._convert_to_sse_format(
                            LLMResult(content=""),
                            True,
                            current_block,
                            is_user_input_validation=True,
                        )
                else:
                    # 交互块渲染阶段：先发送交互数据，然后等待用户输入
                    yield self._convert_to_sse_format(
                        result, False, current_block, is_user_input_validation=False
                    )
                    yield self._convert_to_sse_format(
                        LLMResult(content=""),
                        True,
                        current_block,
                        is_user_input_validation=False,
                    )
            else:
                # 非交互块：先发送内容，再发送结束标记
                if result.content and result.content.strip():
                    # 有内容时，先发送内容
                    yield self._convert_to_sse_format(result, False, current_block)
                # 然后发送结束标记
                yield self._convert_to_sse_format(
                    LLMResult(content=""), True, current_block
                )

    def generate_with_llm_complete(
        self,
        content: str,
        block_index: int,
        context: Optional[List[ChatMessage]] = None,
        variables: Optional[Dict[str, str]] = None,
        user_input: Optional[Dict[str, List[str]]] = None,
        document_prompt: Optional[str] = None,
        interaction_prompt: Optional[str] = None,
        interaction_error_prompt: Optional[str] = None,
        model: str = None,
        temperature: Optional[float] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        output_language: Optional[str] = None,
    ) -> LLMGenerateResponse:
        """
        使用 LLM 生成内容 - 交给 MarkdownFlow

        Args:
            content: Markdown 文档内容
            block_index: 块索引
            context: 上下文消息列表
            variables: 变量映射
            user_input: 用户输入内容
            document_prompt: 文档系统提示词
            interaction_prompt: 交互提示词
            interaction_error_prompt: 交互错误提示词
            model: 使用的模型名称
            output_language: 输出语言 locale code（例如 'zh', 'en'）

        Returns:
            LLMGenerateResponse: 完整的生成结果
        """
        # 使用默认模型如果未指定
        if model is None:
            model = settings.llm_model

        # 创建支持模型和温度参数的 LLM 提供者
        effective_temperature = (
            temperature if temperature is not None else settings.llm_temperature
        )
        llm_provider = PlaygroundLLMProvider(
            llm_client=_shared_llm_client, model=model, temperature=effective_temperature
        )
        llm_provider.set_session_id(session_id)
        llm_provider.set_trace_id(trace_id)
        llm_provider.set_user_id(user_id)
        llm_provider.set_variables(variables)
        llm_provider.set_user_input(user_input)

        # 创建 MarkdownFlow 实例
        mf = MarkdownFlow(
            content,
            llm_provider=llm_provider,
            document_prompt=document_prompt,
            interaction_prompt=interaction_prompt,
            interaction_error_prompt=interaction_error_prompt,
        )

        # 设置输出语言（API层已固定为"Simplified Chinese"）
        if output_language:
            mf.set_output_language(output_language)

        # 转换上下文格式
        context_dict = self._convert_context_to_dict(context) if context else None

        # 调用统一处理方法
        result = mf.process(
            block_index=block_index,
            mode=ProcessMode.COMPLETE,
            context=context_dict,
            variables=variables,
            user_input=user_input,
        )

        # 转换为现有的响应格式
        return self._convert_to_generate_response(result, mf.get_block(block_index))

    def get_markdownflow_info(
        self,
        content: str,
        document_prompt: Optional[str] = None,
        output_language: Optional[str] = None,
    ) -> MarkdownFlowInfoResponse:
        """
        获取 Markdown-Flow 文档信息统计

        Args:
            content: Markdown 文档内容
            document_prompt: 文档系统提示词
            output_language: 输出语言 locale code（例如 'zh', 'en'）

        Returns:
            MarkdownFlowInfoResponse: 文档统计信息
        """

        # 创建 MarkdownFlow 实例
        mf = MarkdownFlow(content, llm_provider=self.llm_provider)

        # 设置输出语言（API层已固定为"Simplified Chinese"）
        if output_language:
            mf.set_output_language(output_language)

        # 获取所有块信息
        blocks = mf.get_all_blocks()
        block_count = mf.block_count

        # 收集所有变量
        all_variables = []
        interaction_blocks = []
        content_blocks = []

        for i, block in enumerate(blocks):
            # 收集变量
            if block.variables:
                all_variables.extend(block.variables)

            # 分类块类型
            if block.is_interaction:
                interaction_blocks.append(i)
            else:
                content_blocks.append(i)

        # 统计 document_prompt 变量
        if document_prompt:
            from markdown_flow import extract_variables_from_text

            document_variables = extract_variables_from_text(document_prompt)
            all_variables.extend(document_variables)

        # 变量去重
        unique_variables = list(set(all_variables))

        return MarkdownFlowInfoResponse(
            block_count=block_count,
            variables=unique_variables if unique_variables else None,
            interaction_blocks=interaction_blocks,
            content_blocks=content_blocks,
        )

    def save_document(self, title: str, content: str) -> SaveDocumentResponseData:
        """
        保存文档

        Args:
            title: 文档标题
            content: 文档内容

        Returns:
            SaveDocumentResponseData: 保存结果
        """
        # 1. 确保目录存在
        # 使用 demo 根目录下的 saved_documents
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        save_dir = os.path.join(base_dir, "saved_documents")
        os.makedirs(save_dir, exist_ok=True)

        # 2. 处理文件名（去除非法字符）
        safe_title = re.sub(r'[\\/*?:"<>|]', "", title)
        # 如果标题为空（被过滤完了），使用默认名
        if not safe_title:
            safe_title = "untitled"

        filename = f"{safe_title}.md"
        file_path = os.path.join(save_dir, filename)

        # 3. 处理重名（自动添加序号）
        counter = 1
        base_name = safe_title
        while os.path.exists(file_path):
            safe_title = f"{base_name}_{counter}"
            filename = f"{safe_title}.md"
            file_path = os.path.join(save_dir, filename)
            counter += 1

        # 4. 写入文件
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return SaveDocumentResponseData(file_path=file_path)

    def _convert_context_to_dict(
        self, context: List[ChatMessage]
    ) -> List[Dict[str, str]]:
        """将 ChatMessage 列表转换为字典格式，过滤无效消息"""
        if not context:
            return []

        filtered_context = []
        for msg in context:
            try:
                # 过滤无效消息
                if self._is_valid_message(msg):
                    filtered_context.append({"role": msg.role, "content": msg.content})
            except Exception:
                continue

        return filtered_context

    def _is_valid_message(self, msg: ChatMessage) -> bool:
        """检查消息是否有效"""
        # 检查 role 是否为 None
        if not msg.role:
            return False

        # 检查 content 是否为 None 或空
        if not msg.content:
            return False

        # 检查 content 是否只包含空白字符
        if not msg.content.strip():
            return False

        # 检查 role 是否有效
        valid_roles = {"system", "user", "assistant", "function", "tool", "developer"}
        if msg.role not in valid_roles:
            return False

        return True

    def _convert_to_sse_format(
        self,
        result,
        finished: bool = False,
        current_block=None,
        is_user_input_validation: bool = False,
    ) -> Dict:
        """转换为 SSE 格式"""
        # 如果是结束标记，返回 text_end 类型
        if finished:
            from backend.models.markdown_flow import (
                SSEMessage,
                SSEMessageType,
                TextEndSSEData,
            )

            text_end_data = TextEndSSEData(mdflow="")
            sse_message = SSEMessage(type=SSEMessageType.TEXT_END, data=text_end_data)
            return {
                "success": True,
                "sse_message": sse_message.model_dump(),
                "variables_extracted": result.variables,
            }

        # 根据块类型确定消息类型
        if current_block and hasattr(current_block, "block_type"):
            from markdown_flow.enums import BlockType as MFBlockType

            from backend.models.markdown_flow import (
                ContentSSEData,
                InteractionSSEData,
                SSEMessage,
                SSEMessageType,
            )

            # 检查是否是交互块（静态或动态转换的）
            is_interaction_block = (
                current_block.block_type == MFBlockType.INTERACTION
                or (
                    hasattr(result, "transformed_to_interaction")
                    and result.transformed_to_interaction
                )
            )

            if is_interaction_block:
                # 交互块处理
                if is_user_input_validation:
                    # 用户输入验证阶段：根据验证结果返回内容或空内容
                    if result.content and result.content.strip():
                        # 验证失败，返回错误消息
                        content_data = ContentSSEData(mdflow=result.content)
                        sse_message = SSEMessage(
                            type=SSEMessageType.CONTENT, data=content_data
                        )
                    else:
                        # 验证通过，不生成消息，让结束标记处理
                        return {
                            "success": True,
                            "sse_message": None,  # 不生成消息
                            "variables_extracted": result.variables,
                        }
                else:
                    # 交互块渲染阶段：返回交互数据
                    variable_name = (
                        current_block.variables[0]
                        if current_block.variables
                        else "user_input"
                    )
                    interaction_data = InteractionSSEData(
                        mdflow=(
                            result.content if result.content else current_block.content
                        ),
                        variable=variable_name,
                    )
                    sse_message = SSEMessage(
                        type=SSEMessageType.INTERACTION, data=interaction_data
                    )
            else:
                # 内容块：直接使用内容
                content_data = ContentSSEData(mdflow=result.content)
                sse_message = SSEMessage(type=SSEMessageType.CONTENT, data=content_data)
        else:
            # 兜底：当无法确定块类型时，按内容处理
            from backend.models.markdown_flow import (
                ContentSSEData,
                SSEMessage,
                SSEMessageType,
            )

            content_data = ContentSSEData(mdflow=result.content)
            sse_message = SSEMessage(type=SSEMessageType.CONTENT, data=content_data)

        return {
            "success": True,
            "sse_message": sse_message.model_dump(),
            "variables_extracted": result.variables,
        }

    def _convert_to_generate_response(
        self, result, block: Block
    ) -> LLMGenerateResponse:
        """转换为 LLMGenerateResponse 格式"""
        # 转换 Block 格式
        api_block = Block(
            content=block.content,
            block_type=block.block_type.value,
            index=block.index,
            variables=block.variables,
            is_interaction=block.is_interaction,
        )

        return LLMGenerateResponse(
            content=result.content,
            prompt_used=result.prompt or block.content,
            model_used=result.model or settings.llm_model,
            block_used=api_block,
            variables_replaced=result.variables or {},
        )
