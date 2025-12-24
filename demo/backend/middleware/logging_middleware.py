import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.utils.logger import log
from backend.utils.trace import generate_trace_id, set_trace_id


class LoggingMiddleware(BaseHTTPMiddleware):
    """日志中间件"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 生成或获取 trace ID
        trace_id = request.headers.get("X-Trace-ID") or generate_trace_id()
        set_trace_id(trace_id)

        # 记录请求开始时间
        start_time = time.time()

        # 获取请求信息
        method = request.method
        url = str(request.url)

        try:
            # 处理请求
            response = await call_next(request)

            # 计算处理时间
            process_time = time.time() - start_time

            # 添加处理时间和 trace ID 到响应头
            response.headers["X-Process-Time"] = str(process_time)
            response.headers["X-Trace-ID"] = trace_id

            return response

        except Exception as e:
            # 记录错误日志
            process_time = time.time() - start_time
            log.error(
                "请求异常",
                method=method,
                url=url,
                error=str(e),
                process_time=f"{process_time:.3f}s",
                trace_id=trace_id,
            )
            raise
