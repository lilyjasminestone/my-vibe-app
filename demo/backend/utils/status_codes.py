"""
HTTP 状态码常量
"""

# 成功状态码
OK = 200

# 客户端错误状态码
BAD_REQUEST = 400
UNAUTHORIZED = 401
FORBIDDEN = 403
NOT_FOUND = 404

# 服务器错误状态码
INTERNAL_SERVER_ERROR = 500

# 状态码描述
STATUS_MESSAGES = {
    OK: "Request successful",
    BAD_REQUEST: "Bad request",
    UNAUTHORIZED: "Unauthorized",
    FORBIDDEN: "Forbidden",
    NOT_FOUND: "Resource not found",
    INTERNAL_SERVER_ERROR: "Internal server error",
}
