#!/bin/bash

# 依赖安装更新
# pip install -r requirements.txt


# 设置环境变量文件路径
export ENV_FILE=".env"
# 启动 FastAPI 开发服务器
fastapi dev main.py --reload
