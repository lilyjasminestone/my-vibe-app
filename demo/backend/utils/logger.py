import inspect
import logging
import sys
from types import FrameType
from typing import Any, Optional

from backend.config.settings import settings
from app.utils.trace import get_trace_id


class TraceFilter(logging.Filter):
    """日志过滤器，添加 trace ID"""

    def filter(self, record: logging.LogRecord) -> bool:
        trace_id = get_trace_id()
        record.trace_id = trace_id or "NO_TRACE"
        return True


class StandardFormatter(logging.Formatter):
    """标准文本格式化器"""

    def __init__(self):
        # 使用传统的日志格式：时间 - 级别 - 路径 - trace_id - 消息
        super().__init__(
            fmt="%(asctime)s - %(levelname)s - %(pathname)s:%(lineno)d - %(trace_id)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    def format(self, record: logging.LogRecord) -> str:
        # 确保 trace_id 属性存在
        if not hasattr(record, "trace_id"):
            record.trace_id = "NO_TRACE"

        # 处理额外字段
        if hasattr(record, "extra_fields") and record.extra_fields:
            extra_info = " | ".join(
                [f"{k}={v}" for k, v in record.extra_fields.items()]
            )
            record.message = f"{record.getMessage()} | {extra_info}"
        else:
            record.message = record.getMessage()

        return super().format(record)


def log_with_context(level: str, message: str, *args: Any, **kwargs: Any) -> None:
    """带上下文的日志记录"""
    extra_fields = kwargs
    if args:
        extra_fields["args"] = args
    logger = logging.getLogger("app")
    # 获取调用栈信息，追溯到 log.info/log.error 的实际调用点
    frame: Optional[FrameType] = inspect.currentframe()
    if (
        frame is not None
        and frame.f_back is not None
        and frame.f_back.f_back is not None
    ):
        frame = frame.f_back.f_back
        filename = frame.f_code.co_filename
        lineno = frame.f_lineno
        funcname = frame.f_code.co_name
    else:
        filename = "<unknown>"
        lineno = 0
        funcname = "<unknown>"
    record = logger.makeRecord(
        name=logger.name,
        level=getattr(logging, level.upper()),
        fn=filename,
        lno=lineno,
        msg=message,
        args=(),
        exc_info=None,
        func=funcname,
    )
    record.extra_fields = extra_fields
    logger.handle(record)


def log_info(message: str, *args: Any, **kwargs: Any) -> None:
    log_with_context("INFO", message, *args, **kwargs)


def log_warning(message: str, *args: Any, **kwargs: Any) -> None:
    log_with_context("WARNING", message, *args, **kwargs)


def log_error(message: str, *args: Any, **kwargs: Any) -> None:
    log_with_context("ERROR", message, *args, **kwargs)


def log_debug(message: str, *args: Any, **kwargs: Any) -> None:
    log_with_context("DEBUG", message, *args, **kwargs)


def setup_logger() -> logging.Logger:
    logger = logging.getLogger("app")
    logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        formatter = StandardFormatter()
        console_handler.setFormatter(formatter)
        # 添加 trace 过滤器
        trace_filter = TraceFilter()
        console_handler.addFilter(trace_filter)
        logger.addHandler(console_handler)
    return logger


logger = setup_logger()


class LogWrapper:
    def info(self, message: str, *args: Any, **kwargs: Any) -> None:
        log_info(message, *args, **kwargs)

    def warning(self, message: str, *args: Any, **kwargs: Any) -> None:
        log_warning(message, *args, **kwargs)

    def error(self, message: str, *args: Any, **kwargs: Any) -> None:
        log_error(message, *args, **kwargs)

    def debug(self, message: str, *args: Any, **kwargs: Any) -> None:
        log_debug(message, *args, **kwargs)


log = LogWrapper()
