from typing import Any

from app.models.base import BaseResponse
from app.utils.status_codes import BAD_REQUEST, INTERNAL_SERVER_ERROR, OK, UNAUTHORIZED
from app.utils.trace import get_trace_context


def success_response(
    data: Any = None, message: str = "Succeed", code: int = OK
) -> BaseResponse:
    """成功响应"""
    # 获取 trace 上下文
    trace_context = get_trace_context()

    return BaseResponse(code=code, message=message, data=data, trace=trace_context)


def error_response(
    message: str = "Failed", data: Any = None, code: int = BAD_REQUEST
) -> BaseResponse:
    """错误响应"""
    # 获取 trace 上下文
    trace_context = get_trace_context()

    return BaseResponse(code=code, message=message, data=data, trace=trace_context)


def unauthorized_response(message: str = "Failed", data: Any = None) -> BaseResponse:
    """无权限响应"""
    # 获取 trace 上下文
    trace_context = get_trace_context()

    return BaseResponse(
        code=UNAUTHORIZED, message=message, data=data, trace=trace_context
    )


def server_error_response(message: str = "Failed", data: Any = None) -> BaseResponse:
    """服务器错误响应"""
    # 获取 trace 上下文
    trace_context = get_trace_context()

    return BaseResponse(
        code=INTERNAL_SERVER_ERROR, message=message, data=data, trace=trace_context
    )


class ResponseBuilder:
    info = staticmethod(success_response)
    error = staticmethod(error_response)
    unauthorized = staticmethod(unauthorized_response)
    server_error = staticmethod(server_error_response)


res = ResponseBuilder()
