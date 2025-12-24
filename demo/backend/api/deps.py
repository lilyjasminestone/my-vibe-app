"""
API 依赖注入函数
统一管理所有服务的依赖注入
"""

from backend.services.playground_service import PlayGroundService


def get_playground_service() -> PlayGroundService:
    """获取 PlayGround 演示服务实例"""
    return PlayGroundService()
