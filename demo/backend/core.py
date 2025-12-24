from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config.settings import settings
from backend.middleware.logging_middleware import LoggingMiddleware


def create_app() -> FastAPI:
    """创建FastAPI应用实例"""

    # 创建应用实例
    app = FastAPI(
        title=settings.app_name,
        description=settings.app_description,
        version=settings.app_version,
        debug=settings.debug,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 添加日志中间件
    app.add_middleware(LoggingMiddleware)

    # 配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    from backend.api.v1.playground_api import playground_api_router

    app.include_router(playground_api_router, prefix=settings.api_prefix)

    # 关闭事件
    @app.on_event("shutdown")
    async def shutdown_event():
        # 清理全局 LLM 客户端
        from backend.services import llm_service, playground_service

        await llm_service.cleanup_llm_client()
        await playground_service.cleanup_playground_llm_client()

    return app
