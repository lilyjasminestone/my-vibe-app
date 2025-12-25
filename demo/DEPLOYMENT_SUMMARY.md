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
