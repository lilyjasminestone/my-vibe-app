import warnings
from datetime import datetime

import uvicorn

from backend.config.settings import settings
from backend.core import create_app



# 抑制 asyncio "Task was destroyed but it is pending!" 警告
# 这在 Windows 上（没有 uvloop）使用 SSE 流式响应时很常见
warnings.filterwarnings("ignore", message=".*Task was destroyed but it is pending.*")

# 创建应用实例
app = create_app()


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app", host=settings.host, port=settings.port, reload=settings.debug
    )
