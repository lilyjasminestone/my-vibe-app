"""
Markdown-Flow 相关的 Pydantic 模型
"""

from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class InputType(str, Enum):
    """用户输入类型"""

    CLICK = "click"  # 从预定义选项中选择
    TEXT = "text"  # 开放式文本输入


class BlockType(str, Enum):
    """区块类型"""

    CONTENT = "content"  # 内容区块
    INTERACTION = "interaction"  # 交互区块
    PRESERVED_CONTENT = "preserved_content"  # 保留内容区块


class ChatMessage(BaseModel):
    """聊天消息模型"""

    role: Literal["system", "user", "assistant", "function", "tool", "developer"]
    content: str


class MarkdownFlowRequest(BaseModel):
    """Markdown-Flow 处理请求模型"""

    content: str


class Block(BaseModel):
    """区块结构"""

    content: str  # 区块内容
    block_type: BlockType  # 区块类型
    index: Optional[int] = 0  # 区块索引
    variables: Optional[List[str]] = []  # 区块中包含的变量名
    is_interaction: Optional[bool] = False  # 是否为交互块

    class Config:
        use_enum_values = True  # 序列化时使用枚举值


class BlockSplitResponse(BaseModel):
    """区块列表响应模型"""

    blocks: List[Block]  # 区块列表
    total_count: int  # 总区块数


class VariableExtractResponse(BaseModel):
    """变量提取响应模型"""

    variables: List[str]
    total_count: int


class PromptBuildRequest(BaseModel):
    """提示词构建请求模型"""

    content: str
    block_index: int
    context: Optional[List[ChatMessage]] = None
    variables: Optional[Dict[str, str]] = None
    user_input: Optional[Dict[str, List[str]]] = None


class PromptBuildResponse(BaseModel):
    """提示词构建响应模型"""

    prompt: str  # 处理后的用户消息内容（变量已替换）
    block_used: Block  # 原始块内容
    variables_replaced: Dict[str, str]  # 实际替换的变量
    input_context: List[ChatMessage]  # 输入的原始 context
    final_context: List[ChatMessage]  # 最终构建的完整 context（包含系统消息和用户消息）


class VariableValidateRequest(BaseModel):
    """变量验证请求模型"""

    content: str
    variables: Dict[str, str]


class VariableValidateResponse(BaseModel):
    """变量验证响应模型"""

    is_valid: bool
    missing_variables: List[str]
    provided_variables: List[str]
    required_variables: List[str]


class PlaygroundRunRequest(BaseModel):
    """Playground 统一预览请求模型"""

    content: str  # markdownflow 原文
    block_index: int  # 现在要处理第几个块
    context: Optional[List[ChatMessage]] = None  # 上下文，要携带的上下文
    variables: Optional[Dict[str, str]] = None  # 变量映射，k-v结构用来替换变量
    user_input: Optional[Dict[str, List[str]]] = (
        None  # 用户输入，遇到互动块时用户的输入
    )
    document_prompt: Optional[str] = None  # 设置 markdownflow 的文档系统提示词
    interaction_prompt: Optional[str] = None  # 设置交互块渲染提示词
    interaction_error_prompt: Optional[str] = None  # 设置交互错误提示词
    model: Optional[str] = None  # LLM模型名称，用于在服务层设置 LLMProvider
    temperature: Optional[float] = Field(
        None,
        ge=0.0,
        le=2.0,
        description="LLM温度参数，取值范围0.0-2.0，None表示使用系统默认值",
    )
    output_language: Optional[str] = Field(
        None,
        description="输出语言 locale code (e.g., 'zh', 'en', 'zh-CN', 'en-US')，用于设置 LLM 输出语言",
    )


class LLMGenerateRequest(BaseModel):
    """LLM 生成请求模型"""

    content: str
    block_index: int
    context: Optional[List[ChatMessage]] = None
    variables: Optional[Dict[str, str]] = None
    model: Optional[str] = None
    user_input: Optional[Dict[str, List[str]]] = None


class LLMGenerateResponse(BaseModel):
    """LLM 生成响应模型"""

    content: str  # LLM 生成的内容
    prompt_used: str  # 实际使用的提示词
    model_used: str  # 实际使用的模型
    block_used: Block  # 使用的块内容
    variables_replaced: Dict[str, str]  # 替换的变量


class UserInput(BaseModel):
    """用户输入信息模型"""

    content: str  # 用户输入内容
    input_type: InputType  # 输入方式
    context: str  # 用户交互前阅读的内容
    variable_name: str  # 要赋值的变量名


class InputValidationResult(BaseModel):
    """输入验证结果模型"""

    is_valid: bool  # 输入是否有效
    processed_value: Optional[str] = None  # 处理后的赋值
    error_message: Optional[str] = None  # 无效时的错误消息
    guidance: Optional[str] = None  # 重试指导
    needs_llm: bool = False  # 是否需要LLM处理


class InteractionInputRequest(BaseModel):
    """交互输入处理请求模型"""

    content: str  # Markdown文档内容
    block_index: int  # 交互区块索引
    user_input: UserInput  # 用户输入信息


class BlockInfoResponse(BaseModel):
    """区块信息响应模型"""

    block_type: BlockType
    index: int
    has_variables: bool
    variables: List[str]
    is_interaction: bool


class InteractionInputResponse(BaseModel):
    """交互输入处理响应模型"""

    validation_result: InputValidationResult
    block_info: BlockInfoResponse


class ValidationPromptRequest(BaseModel):
    """验证提示生成请求模型"""

    content: str  # Markdown文档内容
    block_index: int  # 交互区块索引
    user_input: UserInput  # 用户输入信息
    document_prompt: Optional[str] = None  # 文档级别的处理提示


class ValidationPromptResponse(BaseModel):
    """验证提示响应模型"""

    prompt_messages: List[ChatMessage]  # 验证提示消息
    needs_llm: bool  # 是否需要LLM处理
    metadata: Optional[Dict] = None  # 元数据


class InteractionTestRequest(BaseModel):
    """交互测试请求模型"""

    content: str  # Markdown文档内容
    block_index: int  # 交互区块索引
    user_input: str  # 用户输入内容
    input_type: InputType = InputType.TEXT  # 输入类型
    validation_template: Optional[str] = None  # 验证模板
    target_variable: Optional[str] = None  # 目标变量名
    context: Optional[List[ChatMessage]] = None  # 上下文消息列表，用于多轮对话


class InteractionTestResponse(BaseModel):
    """交互测试响应模型"""

    user_input: str  # 用户输入
    validation_needed: bool  # 是否需要验证
    validation_prompt: Optional[str] = None  # 验证提示
    llm_response: Optional[str] = None  # LLM响应
    validation_result: Optional[InputValidationResult] = None  # 验证结果
    extracted_variables: Optional[Dict[str, str]] = None  # 提取的变量
    success: bool  # 整体是否成功
    message: str  # 结果消息


# ===== 补全缺失的核心方法响应模型 =====


class DocumentResponse(BaseModel):
    """文档内容响应模型"""

    document: str  # 文档内容


class DocumentPromptSetResponse(BaseModel):
    """设置文档提示响应模型"""

    success: bool  # 是否设置成功
    message: str = "文档提示设置成功"  # 结果消息


class SingleBlockResponse(BaseModel):
    """单个区块响应模型"""

    block: Block  # 区块信息


# ===== 补全请求模型 =====


class DocumentPromptSetRequest(BaseModel):
    """设置文档提示请求模型"""

    content: str  # Markdown文档内容
    document_prompt: Optional[str] = None  # 文档提示


class SingleBlockRequest(BaseModel):
    """单个区块请求模型"""

    content: str  # Markdown文档内容
    index: int  # 区块索引


class MarkdownFlowInfoRequest(BaseModel):
    """Markdown-Flow 信息统计请求模型"""

    content: str  # Markdown文档内容
    document_prompt: Optional[str] = None  # 文档系统提示词
    output_language: Optional[str] = Field(
        None,
        description="输出语言 locale code (e.g., 'zh', 'en')，用于设置交互块渲染语言",
    )


class MarkdownFlowInfoResponse(BaseModel):
    """Markdown-Flow 信息统计响应模型"""

    block_count: Optional[int] = None  # 块总数
    variables: Optional[List[str]] = None  # 变量列表
    interaction_blocks: List[int] = []  # 交互区块索引
    content_blocks: List[int] = []  # 内容区块索引


# ===== SSE 流式响应相关模型 =====


class SSEMessageType(str, Enum):
    """SSE 消息类型枚举"""

    CONTENT = "content"  # 内容块消息
    INTERACTION = "interaction"  # 交互块消息
    TEXT_END = "text_end"  # 文本结束消息


class ContentSSEData(BaseModel):
    """内容块 SSE 数据模型"""

    mdflow: str = Field(..., description="MarkdownFlow 内容")


class InteractionSSEData(BaseModel):
    """交互块 SSE 数据模型"""

    mdflow: str = Field(..., description="MarkdownFlow 交互内容")
    variable: str = Field(..., description="变量名")


class TextEndSSEData(BaseModel):
    """结束标记 SSE 数据模型"""

    mdflow: str = Field(default="", description="MarkdownFlow 结束标记，通常为空字符串")


class SSEMessage(BaseModel):
    """SSE 消息基础模型"""

    type: SSEMessageType = Field(..., description="消息类型")
    data: ContentSSEData | InteractionSSEData | TextEndSSEData = Field(
        ..., description="消息数据，统一使用 mdflow 字段"
    )

    class Config:
        use_enum_values = True


# ===== 历史记录相关模型 =====


class HistoryItem(BaseModel):
    """历史记录项模型"""

    id: int = Field(..., description="记录ID")
    created_at: str = Field(..., description="创建时间")
    content_preview: str = Field(..., description="内容预览（前50字）")
    block_count: int = Field(..., description="生成的区块数量")


class HistoryResponse(BaseModel):
    """历史记录列表响应模型"""

    history: List[HistoryItem] = Field(..., description="历史记录列表")
    total: int = Field(..., description="总记录数")
