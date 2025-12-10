import os
from typing import Optional

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# 支持指定环境变量文件
env_file = os.getenv("ENV_FILE", ".env")
load_dotenv(env_file)


class Settings(BaseSettings):
    """应用配置类"""

    # 应用基础配置
    app_name: str = "Markdown Flow"
    app_description: str = "Playground"
    app_version: str = "1.0.0"
    debug: bool = True

    # 服务器配置
    host: str = "0.0.0.0"
    port: int = 8000

    # API 配置
    api_prefix: str = "/api/v1"

    # 跨域配置
    cors_origins: list = ["*"]

    # 日志配置
    log_level: str = "INFO"

    # LLM 配置
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: Optional[str] = None
    llm_model: str = "deepseek-ai/DeepSeek-V3"
    llm_temperature: float = 0.3

    class Config:
        env_file = ".env"
        case_sensitive = False


# 创建全局配置实例
settings = Settings()
