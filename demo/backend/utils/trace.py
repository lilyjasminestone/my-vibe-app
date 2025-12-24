import contextvars
import uuid
from typing import Optional

# 创建上下文变量来存储 trace_id
trace_id_var = contextvars.ContextVar("trace_id", default=None)


def generate_trace_id() -> str:
    """生成唯一的 trace ID"""
    return str(uuid.uuid4()).replace("-", "")


def get_trace_id() -> Optional[str]:
    """获取当前上下文的 trace ID"""
    return trace_id_var.get()


def set_trace_id(trace_id: str) -> None:
    """设置当前上下文的 trace ID"""
    trace_id_var.set(trace_id)


def get_trace_context() -> str:
    """获取 trace 上下文信息"""
    trace_id = get_trace_id()
    return trace_id or "NO_TRACE"
