# Vercel Deployment Debugging Summary

## 1. Current Status (2025-12-25)
- **Python Runtime**: ✅ Working. Verified via `/api/test` returning 200 OK.
- **File Structure**: ✅ Fixed. Conflicting `api/index.py` has been deleted.
- **Routing**: ⚠️ Partially Working. Next.js is rewriting requests to `/api/test`, but the application returns `405 Method Not Allowed`.

## 2. Key Findings
1.  **404 Error (Solved)**: Caused by `demo/app` folder conflicting with Next.js App Router. Renamed to `demo/backend`.
2.  **405 Error (Root Cause)**:
    -   Initially caused by `api/index.py` being treated as a static directory index by Vercel.
    -   We deleted `api/index.py` and moved logic to `api/test.py`.
    -   Current 405 is likely due to **FastAPI Route Mismatch** or **Missing Environment Variables**.
3.  **Infrastructure**:
    -   `vercel.json` is currently NOT in use (relying on Next.js config).
    -   `next.config.ts` rewrites `/api/v1/:path*` -> `/api/test`.

## 3. Critical Files
- **`demo/api/test.py`**: The current entry point. Contains a wrapper to catch FastAPI startup errors (500s) and return them as JSON.
- **`demo/next.config.ts`**: Handles routing.
- **`demo/backend/core.py`**: The FastAPI application factory.

## 4. Next Steps for New Session
1.  **Verify Wrapper Deployment**: Access `/api/test` directly.
    -   If it returns `{"status": "ok"}` (Old version) -> Deployment didn't update `test.py`.
    -   If it returns `{"error": "FastAPI Initialization Failed"}` -> We found the bug! Missing Env Vars.
2.  **Fix Environment Variables**: Vercel likely needs `OPENAI_API_KEY` etc. defined in the Project Settings.
3.  **Adjust Route Prefix**: FastAPI might be receiving the wrong path (e.g. `/api/test` instead of `/api/v1/chat`). We may need to strip the prefix in `api/test.py`.

## 5. How to Continue
Upload this file to the new chat session and ask the AI to:
> "Follow step 4 in the summary to debug the 405 error on api/test."

---

## 6. Environment Variables (Vercel)
- Required
  - LLM_API_KEY: Your OpenAI-compatible API key
- Optional
  - NEXT_PUBLIC_PLAYGROUND_URL: Set when using a custom domain to avoid relative URL issues
  - FASTAPI_ROOT_PATH: Set to "/api/test" (Python Function base path)

## 7. Routing Fix Applied
- Next.js rewrites now preserve path segments:
  - source: /api/v1/:path*
  - destination: /api/test/:path*
- FastAPI reads root_path from FASTAPI_ROOT_PATH and mounts accordingly.

---

## 8. Plan A：独立后端部署（Render）
- 目标
  - 将 FastAPI 独立部署为 Web 服务，前端通过 NEXT_PUBLIC_PLAYGROUND_URL 指向该服务域名
- 文件
  - Dockerfile：容器化后端
  - render.yaml：Render 蓝图，build/start 命令与环境变量
- 步骤
  1. 在 Render 仪表盘创建 “New Web Service”，选择仓库根目录的 demo 子目录
  2. 自动识别 render.yaml 或手动设置：
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  3. 环境变量：
     - ENV_FILE = .env.production
     - LLM_API_KEY = 你的 OpenAI 兼容 Key
     - LLM_BASE_URL = https://api.openai.com/v1（如使用兼容平台请改成相应地址）
  4. 部署完成后获得后端域名，例如：https://markdownflow-api.onrender.com
  5. 在 Vercel 项目设置中配置：
     - NEXT_PUBLIC_PLAYGROUND_URL = 后端域名（不含尾部斜杠）
  6. 重新部署前端，前端将使用独立后端域名调用 API。

## 9. 本地联调
- 后端：`ENV_FILE=.env.development uvicorn main:app --host 127.0.0.1 --port 8000`
- 前端：`.env.development` 已设定 `NEXT_PUBLIC_PLAYGROUND_URL=http://127.0.0.1:8000`
- 验证：
  - GET /health → 200
  - POST /api/v1/playground/markdownflow_info → 200
  - POST /api/v1/playground/generate → SSE（若未配 LLM_API_KEY，会返回错误消息而不是 405）
