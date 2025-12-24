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

    # 调试中间件：拦截所有 POST 请求并返回 debug 信息
    from fastapi.responses import JSONResponse
    @app.middleware("http")
    async def debug_middleware(request: Request, call_next):
        if request.method == "POST":
             # 仅拦截 playground 相关的请求，避免影响其他
            if "playground" in request.url.path:
                return JSONResponse({
                    "debug": "Middleware intercepted POST",
                    "path": request.url.path,
                    "method": request.method,
                    "base_url": str(request.base_url),
                    "root_path": request.scope.get("root_path", ""),
                })
        return await call_next(request)

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

    # 注册标准的 API 前缀 (通常是 /api/v1)
    app.include_router(playground_api_router, prefix=settings.api_prefix)

    # 额外注册一个 /v1 前缀，以防 Vercel 自动剥离了 /api
    # 如果 settings.api_prefix 已经是 /v1，这里会重复，但 FastAPI 允许 (只是多了一个路由入口)
    if settings.api_prefix.startswith("/api"):
        stripped_prefix = settings.api_prefix.replace("/api", "", 1)
        if stripped_prefix:
            app.include_router(playground_api_router, prefix=stripped_prefix)

    # Debug: Catch-all route to debug path issues
    from fastapi import Request
    @app.post("/{full_path:path}")
    async def catch_all(full_path: str, request: Request):
        return {
            "message": "Debug: Path not found in router but caught by catch-all",
            "path": full_path,
            "method": request.method,
            "headers": dict(request.headers),
            "base_url": str(request.base_url),
            "root_path": request.scope.get("root_path", ""),
            "path_info": request.scope.get("path", "")
        }



    # 关闭事件
    @app.on_event("shutdown")
    async def shutdown_event():
        # 清理全局 LLM 客户端
        from backend.services import llm_service, playground_service

        await llm_service.cleanup_llm_client()
        await playground_service.cleanup_playground_llm_client()

    return app
