import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI

from backend.config.settings import settings
from backend.utils.logger import logger


def _debug_print_messages(messages: List[Dict], title: str = "LLM Context"):
    """调试模式下美化输出 LLM 消息"""
    if not settings.debug:
        return

    # 颜色定义
    colors = {
        "system": {"icon": "⚙️", "color": "\033[1;33m", "bg": "\033[43m\033[30m"},
        "user": {"icon": "👤", "color": "\033[1;32m", "bg": "\033[42m\033[37m"},
        "assistant": {"icon": "🤖", "color": "\033[1;34m", "bg": "\033[44m\033[37m"},
        "function": {"icon": "⚡", "color": "\033[1;35m", "bg": "\033[45m\033[37m"},
        "tool": {"icon": "🔧", "color": "\033[1;36m", "bg": "\033[46m\033[30m"},
        "developer": {"icon": "👩‍💻", "color": "\033[1;31m", "bg": "\033[41m\033[37m"},
    }

    reset = "\033[0m"

    # 标题
    title_color = "\033[1;36m"
    print(f"\n{title_color}🚀 {title} ({len(messages)} messages){reset}")
    print(f"{title_color}{'=' * 50}{reset}")

    # 消息内容
    for i, item in enumerate(messages, 1):
        role = item.get("role", "unknown").lower()
        content = item.get("content", "").strip()

        # 获取角色配置
        role_config = colors.get(
            role, {"icon": "❓", "color": "\033[1;37m", "bg": "\033[47m\033[30m"}
        )

        # 角色标签
        role_display = role.upper().ljust(9)
        role_tag = f"{role_config['bg']} {role_display} {reset}"

        # 字符统计颜色
        char_count = len(content)
        if char_count > 200:
            count_color = "\033[1;31m"  # 红色
        elif char_count > 100:
            count_color = "\033[1;33m"  # 黄色
        else:
            count_color = "\033[1;32m"  # 绿色

        # 消息头
        print(
            f"\n{i:2d}. {role_config['icon']} {role_tag} {count_color}[{char_count} chars]{reset}"
        )

        # 内容处理：完整显示所有行
        if content:
            lines = content.split("\n")
            for line in lines:
                print(f"    {role_config['color']}{line}{reset}")
        else:
            print(f"    {role_config['color']}(empty){reset}")

    print(f"\n{title_color}{'=' * 50}{reset}")


class LLMClient:
    """LLM 公共客户端组件 - 使用OpenAI包"""

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = base_url or settings.llm_base_url
        self.api_key = api_key or settings.llm_api_key

        # 初始化OpenAI客户端
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    async def aclose(self):
        """关闭客户端连接"""
        try:
            await self.client.close()
        except Exception as e:
            logger.warning(f"关闭 LLM 客户端时出错: {e}")

    async def chat_completion(
        self,
        message: str,
        model: str,
        temperature: float,
        session_id: str,
        trace_id: str,
        user_id: str,
        context: Optional[List[Dict[str, str]]] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        if not self.api_key:
            return {"success": False, "error": "API Key 未配置"}

        # 构建消息列表（包含上下文）
        messages = context.copy() if context else []
        messages.append({"role": "user", "content": message})

        _debug_print_messages(messages, "LLM Chat Completion")

        try:
            # 使用OpenAI客户端
            completion_args = {
                "model": model,
                "messages": messages,
                "max_tokens": 4096,
                "temperature": temperature,
            }

            # 添加 Function Calling 支持
            if tools:
                completion_args["tools"] = tools
                completion_args["tool_choice"] = "auto"

            response = await self.client.chat.completions.create(**completion_args)

            response_content = response.choices[0].message.content
            prompt_tokens = response.usage.prompt_tokens if response.usage else None
            completion_tokens = (
                response.usage.completion_tokens if response.usage else None
            )
            total_tokens = response.usage.total_tokens if response.usage else None

            logger.info(
                f"LLM tokens - prompt: {prompt_tokens}, completion: {completion_tokens}, total: {total_tokens}"
            )
            logger.info(
                f"session_id: {session_id}, trace_id: {trace_id}, user_id: {user_id}"
            )

            result = {
                "success": True,
                "response": response_content,
                "model": model,
            }

            # 如果有 tool_calls，添加到结果中
            if response.choices[0].message.tool_calls:
                result["tool_calls"] = []
                for tool_call in response.choices[0].message.tool_calls:
                    result["tool_calls"].append(
                        {
                            "id": tool_call.id,
                            "type": tool_call.type,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments,
                            },
                        }
                    )

            return result

        except Exception as e:
            logger.error(f"LLM 请求异常: {str(e)}")
            return {"success": False, "error": f"请求异常: {str(e)}"}

    async def chat_completion_sse(
        self,
        message: str,
        model: str,
        temperature: float,
        session_id: str,
        trace_id: str,
        user_id: str,
        context: Optional[List[dict]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        SSE流式聊天请求，支持上下文拼接 - 使用OpenAI包
        """
        if not self.api_key:
            yield {"error": "API Key 未配置"}
            return

        # 构建消息列表（拼接上下文）
        messages = context.copy() if context else []
        messages.append({"role": "user", "content": message})

        _debug_print_messages(messages, "LLM Stream Chat")

        try:
            full_response = ""
            prompt_tokens = None
            completion_tokens = None
            total_tokens = None
            completion_start_time = None

            # 使用OpenAI客户端创建流式响应
            # 添加 timeout 防止请求卡死
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=4096,
                temperature=temperature,
                stream=True,
                timeout=60.0 # 60s timeout
            )

            async for chunk in stream:
                if completion_start_time is None:
                    completion_start_time = datetime.now()

                # 检查是否包含 usage 信息
                if hasattr(chunk, "usage") and chunk.usage:
                    prompt_tokens = chunk.usage.prompt_tokens
                    completion_tokens = chunk.usage.completion_tokens
                    total_tokens = chunk.usage.total_tokens

                # 提取增量内容
                if chunk.choices and len(chunk.choices) > 0:
                    choice = chunk.choices[0]
                    if choice.delta and choice.delta.content:
                        delta = choice.delta.content
                        full_response += delta
                        yield {"success": True, "delta": delta}

                    # 检查是否完成
                    if choice.finish_reason in ["stop", "length", "content_filter"]:
                        break

            # 输出 token 统计信息
            if prompt_tokens is not None or completion_tokens is not None:
                logger.info(
                    f"LLM tokens - prompt: {prompt_tokens}, completion: {completion_tokens}, total: {total_tokens}"
                )
                logger.info(
                    f"session_id: {session_id}, trace_id: {trace_id}, user_id: {user_id}"
                )

        except Exception as e:
            logger.error(f"LLM 流式请求异常: {str(e)}")
            yield {"success": False, "error": f"请求异常: {str(e)}"}

    def get_config_info(self) -> Dict[str, Any]:
        return {
            "base_url": self.base_url,
            "api_key_configured": bool(self.api_key),
            "api_key_length": len(self.api_key) if self.api_key else 0,
        }
