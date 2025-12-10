from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BaseResponse(BaseModel):
    """基础响应模型"""

    code: int = 200
    message: str = "Succeed"
    data: Optional[dict] = None
    trace: Optional[str] = None


class BaseModelWithTime(BaseModel):
    """带时间戳的基础模型"""

    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = Field(default_factory=datetime.now)


class ChatMessage(BaseModel):
    """
    聊天消息模型

    用于表示对话上下文中的单条消息，包括系统提示词、用户消息和助手回复。
    """

    role: str = Field(
        ...,
        description="消息角色类型",
        examples=["system", "user", "assistant"],
        json_schema_extra={
            "enum": ["system", "user", "assistant"],
            "title": "消息角色",
            "description": """
            - system: 系统提示词，用于设定AI的角色、行为规则和专业背景
            - user: 用户发送的消息，包括问题、指令或对话内容
            - assistant: AI助手的回复消息，可用作回复风格示例
            """,
        },
    )
    content: str = Field(
        ...,
        description="消息的具体内容文本",
        min_length=1,
        examples=[
            "你是一位专业的编程教师，擅长用通俗易懂的方式解释复杂概念",
            "请帮我解释一下Python中的装饰器是什么？",
            "装饰器是Python中的一个强大特性，它允许你在不修改原函数代码的情况下，为函数添加额外的功能...",
        ],
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "role": "system",
                    "content": "你是一位专业的编程教师，擅长用通俗易懂的方式解释复杂概念",
                },
                {"role": "user", "content": "请帮我解释一下Python中的装饰器是什么？"},
                {
                    "role": "assistant",
                    "content": "装饰器是Python中的一个强大特性，它允许你在不修改原函数代码的情况下，为函数添加额外的功能...",
                },
            ]
        }
