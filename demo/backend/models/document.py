from pydantic import BaseModel, Field

class SaveDocumentRequest(BaseModel):
    """保存文档请求模型"""
    title: str = Field(..., min_length=1, description="文档标题")
    content: str = Field(..., description="MarkdownFlow 内容")

class SaveDocumentResponseData(BaseModel):
    """保存文档响应数据"""
    file_path: str = Field(..., description="保存的文件路径")
