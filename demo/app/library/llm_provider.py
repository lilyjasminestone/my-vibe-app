"""
PlaygroundLLMProvider - 基于现有 LLMClient 的适配器
"""

import json
import logging
from typing import Any, Dict, Generator, List, Optional

from markdown_flow import LLMProvider
from markdown_flow.llm import LLMResult

from .llmclient import LLMClient

logger = logging.getLogger(__name__)


class PlaygroundLLMProvider(LLMProvider):
    """
    基于LLMClient 为 LLMProvider 接口提供者实现
    """

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
    ):
        """
        初始化 PlaygroundLLMProvider

        Args:
            llm_client: LLMClient 实例，如果为 None 则创建新实例
            model: 模型名称，如果设置则作为默认模型
            temperature: 温度参数，如果设置则作为默认温度
        """
        self.llm_client = llm_client or LLMClient()
        self.session_id = None  # 存储当前请求的会话ID
        self.trace_id = None  # 存储当前请求的trace_id
        self.user_id = None  # 存储当前请求的user_id
        self.default_model = model  # provider 级别的默认模型
        self.default_temperature = temperature  # provider 级别的默认温度
        self.variables = None  # 存储当前请求的 variables
        self.user_input = None  # 存储当前请求的 user_input

    def set_session_id(self, session_id: Optional[str]):
        """设置当前请求的会话ID"""
        self.session_id = session_id

    def set_trace_id(self, trace_id: Optional[str]):
        """设置当前请求的trace_id"""
        self.trace_id = trace_id

    def set_user_id(self, user_id: Optional[str]):
        """设置当前请求的user_id"""
        self.user_id = user_id

    def set_variables(self, variables: Optional[Dict[str, Any]]):
        """设置当前请求的 variables"""
        self.variables = variables

    def set_user_input(self, user_input: Optional[Dict[str, List[str]]]):
        """设置当前请求的 user_input"""
        self.user_input = user_input

    def _build_metadata(self) -> Optional[Dict[str, Any]]:
        """构建 metadata，包含 variables 和 user_input"""
        metadata = {}
        if self.variables:
            metadata["variables"] = self.variables
        if self.user_input:
            metadata["user_input"] = self.user_input
        return metadata if metadata else None

    def complete(
        self,
        messages: List[Dict[str, str]],
        model: str | None = None,
        temperature: float | None = None,
        tools: List[Dict[str, Any]] | None = None,
    ) -> LLMResult:
        """
        非流式 LLM 调用，支持 Function Calling

        Args:
            messages: 消息列表，格式为 [{"role": "system/user/assistant", "content": "..."}]
            model: 可选的模型覆盖，优先级高于 provider 默认值
            temperature: 可选的温度覆盖，优先级高于 provider 默认值
            tools: 可选的工具定义，用于 Function Calling

        Returns:
            LLMResult: 结构化的 LLM 响应结果

        Raises:
            ValueError: 当 LLM 调用失败时
        """
        if not messages:
            raise ValueError("消息列表不能为空")

        # 分离上下文和主要消息
        # 最后一个消息作为主要消息，其他作为上下文
        context = messages[:-1] if len(messages) > 1 else None
        main_message = messages[-1]["content"]

        # 使用实例级别覆盖，优先级：参数 > provider 默认值
        effective_model = model if model is not None else self.default_model
        effective_temperature = temperature if temperature is not None else self.default_temperature

        # Build metadata
        metadata = self._build_metadata()

        # 同步包装异步调用
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        try:
            if loop.is_running():
                # 如果已经在事件循环中，使用线程池
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        lambda: asyncio.run(
                            self.llm_client.chat_completion(
                                message=main_message,
                                model=effective_model,
                                temperature=effective_temperature,
                                session_id=self.session_id,
                                trace_id=self.trace_id,
                                user_id=self.user_id,
                                context=context,
                                tools=tools,
                                metadata=metadata,
                            )
                        )
                    )
                    result = future.result()
            else:
                result = loop.run_until_complete(
                    self.llm_client.chat_completion(
                        message=main_message,
                        model=effective_model,
                        temperature=effective_temperature,
                        session_id=self.session_id,
                        trace_id=self.trace_id,
                        user_id=self.user_id,
                        context=context,
                        tools=tools,
                        metadata=metadata,
                    )
                )

            if result and result.get("success"):
                response_content = result["response"]

                # 检查是否有 Function Calling 响应
                if tools and "tool_calls" in result:
                    tool_calls = result["tool_calls"]
                    if tool_calls and len(tool_calls) > 0:
                        tool_call = tool_calls[0]
                        if tool_call.get("function"):
                            try:
                                function_args = json.loads(
                                    tool_call["function"]["arguments"]
                                )
                                if function_args.get("needs_interaction"):
                                    return LLMResult(
                                        content="",  # 内容将由 core.py 构建
                                        transformed_to_interaction=True,
                                        prompt=self._messages_to_prompt(messages),
                                        metadata={
                                            "tool_used": tool_call["function"]["name"],
                                            "tool_args": function_args,
                                        },
                                    )
                            except json.JSONDecodeError:
                                logger.error("无法解析工具调用参数")

                # 普通响应
                return LLMResult(
                    content=response_content,
                    transformed_to_interaction=False,
                    prompt=self._messages_to_prompt(messages),
                )
            else:
                error_msg = result.get("error", "未知错误") if result else "LLM调用失败"
                raise ValueError(f"LLM 调用失败: {error_msg}")

        except Exception as e:
            # 如果是 Function Calling 失败，回退到普通模式
            if tools and "Function Calling" not in str(e):
                logger.warning(f"Function Calling 失败，回退到普通模式: {e}")
                return self.complete(messages)  # 递归调用，不带 tools

            if isinstance(e, ValueError):
                raise
            raise ValueError(f"LLM 调用异常: {str(e)}")

    def stream(
        self,
        messages: List[Dict[str, str]],
        model: str | None = None,
        temperature: float | None = None,
    ) -> Generator[str, None, None]:
        """
        流式 LLM 调用

        Args:
            messages: 消息列表，格式为 [{"role": "system/user/assistant", "content": "..."}]
            model: 可选的模型覆盖，优先级高于 provider 默认值
            temperature: 可选的温度覆盖，优先级高于 provider 默认值

        Yields:
            str: LLM 的增量响应内容

        Raises:
            ValueError: 当 LLM 调用失败时
        """
        if not messages:
            raise ValueError("消息列表不能为空")

        # 分离上下文和主要消息
        context = messages[:-1] if len(messages) > 1 else None
        main_message = messages[-1]["content"]

        # 使用实例级别覆盖，优先级：参数 > provider 默认值
        effective_model = model if model is not None else self.default_model
        effective_temperature = temperature if temperature is not None else self.default_temperature

        # Build metadata
        metadata = self._build_metadata()

        # 同步包装异步生成器
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        try:
            if loop.is_running():
                # 如果已经在事件循环中，使用线程和队列
                import queue
                import threading

                result_queue = queue.Queue()
                exception_queue = queue.Queue()

                def run_async_stream():
                    try:
                        new_loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(new_loop)

                        async def collect_stream():
                            async for chunk in self.llm_client.chat_completion_sse(
                                message=main_message,
                                model=effective_model,
                                temperature=effective_temperature,
                                session_id=self.session_id,
                                trace_id=self.trace_id,
                                user_id=self.user_id,
                                context=context,
                                metadata=metadata,
                            ):
                                if chunk.get("success") and "delta" in chunk:
                                    result_queue.put(chunk["delta"])
                                elif not chunk.get("success"):
                                    error_msg = chunk.get("error", "流式调用失败")
                                    exception_queue.put(
                                        ValueError(f"LLM 流式调用失败: {error_msg}")
                                    )
                                    break
                            result_queue.put(None)  # 结束标记

                        new_loop.run_until_complete(collect_stream())
                        new_loop.close()
                    except Exception as e:
                        exception_queue.put(e)
                        result_queue.put(None)

                thread = threading.Thread(target=run_async_stream)
                thread.start()

                while True:
                    if not exception_queue.empty():
                        raise exception_queue.get()

                    item = result_queue.get()
                    if item is None:
                        break
                    yield item

                thread.join()
            else:
                # 如果没有运行的事件循环
                async def async_generator():
                    async for chunk in self.llm_client.chat_completion_sse(
                        message=main_message,
                        model=effective_model,
                        temperature=effective_temperature,
                        session_id=self.session_id,
                        trace_id=self.trace_id,
                        user_id=self.user_id,
                        context=context,
                        metadata=metadata,
                    ):
                        if chunk.get("success") and "delta" in chunk:
                            yield chunk["delta"]
                        elif not chunk.get("success"):
                            error_msg = chunk.get("error", "流式调用失败")
                            raise ValueError(f"LLM 流式调用失败: {error_msg}")

                gen = async_generator()
                while True:
                    try:
                        item = loop.run_until_complete(gen.__anext__())
                        yield item
                    except StopAsyncIteration:
                        break

        except Exception as e:
            if isinstance(e, ValueError):
                raise
            raise ValueError(f"LLM 流式调用异常: {str(e)}")

    def _messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        """将消息列表转换为提示词字符串"""
        prompt_parts = []
        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")
            if role == "system":
                prompt_parts.append(f"System: {content}")
            elif role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
        return "\n\n".join(prompt_parts)
