# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 沟通语言
**重要**: 请始终使用中文与用户交流。所有回复、解释和文档都应该用中文。

---

## 项目概述

**项目名称**: MarkdownFlow Playground

**核心目标**: 提供可视化的 MarkdownFlow 文档编辑、分析和执行环境

**技术栈**:
- **后端**: Python 3 + FastAPI 0.116 + markdown-flow 0.2.35
- **前端**: Next.js 15.4 + React 19.1 + TypeScript 5 + Tailwind CSS 4
- **UI 组件**: shadcn/ui + Radix UI + markdown-flow-ui 0.1.44

**架构模式**: 前后端分离
- 后端：纯 API 服务（FastAPI），专注于 MarkdownFlow 文档处理和 LLM 集成
- 前端：独立 Next.js 应用，提供可视化编辑和预览界面

**代码规模**:
- 后端: ~2,374 行 Python 代码
- 前端: ~4,815 行 TypeScript/TSX 代码
- 总计: ~7,189 行核心业务代码

---

## 快速开始

### 后端开发

#### 环境设置
```bash
# 激活 conda 环境
source ~/.zshrc
conda activate playground

# 或创建新环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 LLM API Key 等信息
```

#### 运行后端服务器
```bash
# 方式一：使用开发脚本
./dev.sh

# 方式二：直接使用 FastAPI CLI
fastapi dev main.py --host 0.0.0.0 --port 8000 --reload

# 方式三：使用 uvicorn
uvicorn main:app --reload

# 生产模式
python main.py
```

#### 后端 URL
- API 服务: http://localhost:8000
- API 文档: http://localhost:8000/docs (Swagger UI)
- ReDoc 文档: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

#### 前端 URL
- 开发服务器: http://localhost:3000
- 生产服务器: http://localhost:3000

### 代码质量工具

```bash
# 代码格式化
black .
isort .

# 代码检查
flake8


# 运行测试
pytest
pytest -v                    # 详细输出
pytest tests/unit/          # 只运行单元测试
```

---

## 后端架构

### 目录结构

```
demo/
├── main.py                              # 应用入口
├── requirements.txt                     # Python 依赖
├── .env.example                         # 环境变量模板
├── .env                                 # 环境变量（本地）
├── dev.sh                               # 开发脚本
└── app/                                 # 核心应用目录
    ├── __init__.py
    ├── core.py                          # FastAPI 应用工厂 (~50 行)
    ├── api/                             # API 路由层
    │   ├── v1/
    │   │   ├── playground_api.py        # Playground API (~350 行)
    │   └── deps.py                      # 依赖注入配置
    ├── services/                        # 业务逻辑层
    │   ├── playground_service.py        # Playground 服务 (~100 行)
    │   └── llm_service.py               # LLM 服务
    ├── models/                          # 数据模型层
    │   ├── base.py                      # 基础响应模型
    │   └── markdown_flow.py             # MarkdownFlow 模型 (~334 行)
    ├── library/                         # 可重用库
    │   ├── llmclient.py                 # LLM API 客户端 (~150 行)
    │   └── llm_provider.py              # LLM Provider 适配器 (~80 行)
    ├── middleware/                      # 中间件
    │   └── logging_middleware.py        # 日志中间件
    ├── utils/                           # 工具函数
    │   ├── response.py                  # 响应格式化
    │   ├── logger.py                    # 日志配置
    │   ├── trace.py                     # 链路追踪
    │   └── status_codes.py              # HTTP 状态码
    └── config/                          # 配置管理
        └── settings.py                  # Pydantic Settings
```

### 核心组件

#### 1. 应用初始化 (`core.py`)

**职责**:
- 创建 FastAPI 应用实例
- 配置 CORS 中间件（允许所有源：`["*"]`）
- 注册日志中间件
- 注册所有 API 路由
- 配置启动/关闭事件（清理 LLM 客户端）

**关键配置**:
```python
app = FastAPI(
    title="Markdown Flow",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)
```

#### 2. API 路由层 (`playground_api.py`)

**提供 3 个核心 API 端点**:

| 端点 | 方法 | 功能 | 前端使用 |
|------|------|------|---------|
| `/playground/generate` | POST | 流式 LLM 生成（SSE） | ✅ 是 |
| `/playground/markdownflow_info` | POST | 获取文档结构信息 | ✅ 是 |
| `/playground/generate-complete` | POST | 非流式完整生成 | ❌ 预留 |

**请求参数** (`PlaygroundRunRequest`):
```python
content: str                              # MarkdownFlow 文档内容
block_index: int                          # 要执行的块索引（从 0 开始）
variables: Optional[Dict[str, str]]       # 变量映射
user_input: Optional[Dict[str, List[str]]] # 用户输入
context: Optional[List[ChatMessage]]      # 对话上下文
document_prompt: Optional[str]            # 文档级提示词
model: Optional[str]                      # LLM 模型名
temperature: Optional[float]              # 温度参数 (0.0-2.0)
```

**SSE 流式响应格式**:
```json
{
  "type": "content",
  "data": {"mdflow": "生成的内容片段"}
}

{
  "type": "interaction",
  "data": {"mdflow": "交互内容", "variable": "变量名"}
}

{
  "type": "text_end",
  "data": {"mdflow": ""}
}
```

#### 3. 服务层 (`playground_service.py`)

**设计模式**: 纯委托模式

**职责**:
- 委托 `markdown-flow` 库处理所有文档解析和生成逻辑
- 管理共享的 LLM 客户端实例（单例模式）
- 提供流式数据生成接口

**核心方法**:
```python
def generate_with_llm(
    content: str,
    block_index: int,
    context: Optional[List[ChatMessage]] = None,
    variables: Optional[Dict[str, str]] = None,
    ...
) -> Generator[Dict, None, None]:
    """使用 MarkdownFlow 和 LLM 进行流式生成"""
```

#### 4. 数据模型层 (`markdown_flow.py`)

**核心模型** (~334 行):

| 模型类 | 用途 |
|--------|------|
| `ChatMessage` | 聊天消息（role + content）|
| `BlockType` | 块类型枚举（CONTENT/INTERACTION/PRESERVED_CONTENT）|
| `PlaygroundRunRequest` | Playground 统一请求模型 |
| `MarkdownFlowInfoRequest` | 文档分析请求模型 |
| `MarkdownFlowInfoResponse` | 文档分析响应模型 |
| `SSEMessage` | SSE 消息格式 |

#### 5. LLM 集成库 (`library/`)

**两层架构**:

```
API 层 → playground_api.py
    ↓
服务层 → playground_service.py
    ↓
MarkdownFlow 库 (文档解析和消息构建)
    ↓
LLM Provider → PlaygroundLLMProvider (接口适配)
    ↓
LLM Client → LLMClient (OpenAI 兼容 API 客户端)
    ↓
LLM API (OpenAI/DeepSeek/豆包等)
```

**LLMClient (`llmclient.py`)** (~150 行):
- 使用 `openai` Python 包（AsyncOpenAI）
- 支持自定义 `base_url` 和 `api_key`（兼容 OpenAI、DeepSeek 等）
- 提供流式（`chat_completion_sse`）和非流式（`chat_completion`）方法
- 调试模式：彩色输出消息（按角色分类）

**PlaygroundLLMProvider (`llm_provider.py`)** (~80 行):
- 实现 `markdown-flow` 库的 `LLMProvider` 接口
- 适配 `LLMClient` 到 MarkdownFlow 的调用约定
- 支持动态配置模型和温度参数
- 管理会话 ID、追踪 ID、用户 ID

#### 6. 配置管理 (`config/settings.py`)

**使用 Pydantic BaseSettings**:

```python
class Settings(BaseSettings):
    # 应用基础配置
    app_name: str = "Markdown Flow"
    app_version: str = "1.0.0"
    debug: bool = True

    # 服务器配置
    host: str = "0.0.0.0"
    port: int = 8000
    api_prefix: str = "/api/v1"

    # CORS 配置
    cors_origins: list = ["*"]

    # LLM 配置
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: Optional[str] = None
    llm_model: str = "deepseek-ai/DeepSeek-V3"
    llm_temperature: float = 0.3
```

**配置来源**: `.env` 文件 + 环境变量

#### 7. 中间件和工具

**中间件**:
- `LoggingMiddleware`: 自动记录所有 HTTP 请求/响应

**工具函数**:
- `response.py`: 统一响应格式封装（`res.info()`, `res.error()`, ...）
- `trace.py`: 链路追踪 ID (trace_id) 生成和管理
- `logger.py`: 结构化日志配置
- `status_codes.py`: HTTP 状态码常量定义

### 后端依赖项

**核心运行时依赖**:
```
FastAPI==0.116.0           # Web 框架
uvicorn==0.35.0            # ASGI 服务器
Pydantic==2.11.7           # 数据验证
pydantic-settings==2.10.1  # 配置管理
openai>=1.0.0              # LLM API 客户端
markdown-flow==0.2.35      # MarkdownFlow 核心库
python-dotenv==1.1.1       # 环境变量加载
```

**开发工具**:
```
black==24.1.1              # 代码格式化
isort==5.13.2              # Import 排序
flake8==7.0.0              # 代码检查
pytest==7.4.4              # 测试框架
pytest-asyncio==0.23.0     # 异步测试
```

---

## 前端架构

### 目录结构

```
frontend/
├── package.json                         # 项目配置
├── tsconfig.json                        # TypeScript 配置
├── next.config.ts                       # Next.js 配置
├── tailwind.config.ts                   # Tailwind CSS 配置
├── components.json                      # shadcn/ui 配置
├── src/
│   ├── app/                             # Next.js App Router
│   │   ├── layout.tsx                   # 根布局
│   │   ├── page.tsx                     # 主页 (~500+ 行)
│   │   ├── globals.css                  # 全局样式
│   │   └── privacy/                     # 隐私政策页
│   │       └── page.tsx
│   ├── components/                      # React 组件库
│   │   ├── playground/                  # Playground 组件集
│   │   │   ├── Playground.tsx           # 核心渲染器 (~300+ 行)
│   │   │   ├── useSSE.ts                # SSE Hook (~260 行)
│   │   │   ├── useMarkdownInfo.ts       # 文档分析 Hook
│   │   │   └── index.ts
│   │   ├── ui/                          # shadcn/ui 组件 (12 个)
│   │   │   ├── button.tsx, input.tsx, dialog.tsx, ...
│   │   ├── EditPanel.tsx                # 编辑面板
│   │   ├── VariableColumn.tsx           # 变量管理
│   │   ├── DocumentPromptEditor.tsx     # 提示词编辑器
│   │   ├── PlaygroundWrapper.tsx        # Playground 包装
│   │   └── ...
│   ├── lib/                             # 工具库
│   │   ├── api.ts                       # API 客户端
│   │   ├── user.ts                      # 用户 ID 管理
│   │   ├── analytics.ts                 # 分析追踪
│   │   └── utils.ts                     # 通用工具
│   └── types/                           # TypeScript 类型
│       └── intl.ts
└── public/                              # 静态资源
```

### 核心组件

#### 1. 主页组件 (`app/page.tsx` - ~500+ 行)

**功能**:
- 双面板布局（左侧编辑，右侧 Playground 预览）
- MarkdownFlow 文档编辑
- 变量自动提取和管理
- 文档结构分析（调用后端 `/markdownflow_info` API）
- 多变量组管理（支持同时运行多个配置）

**关键状态**:
```typescript
interface VariableGroup {
  id: string                              // 唯一 ID
  name: string                            // 组名
  variableValues: Record<string, string>  // 变量值
  variableArrays: Record<string, string[]> // 多选值
  currentPlaygroundData?: { ... }         // Playground 数据
  isRunning?: boolean                     // 运行状态
}
```

**工作流**:
1. 用户在左侧面板编辑 MarkdownFlow 文档
2. 文档变化时自动调用 `getMarkdownFlowInfo` API
3. 解析出变量列表，显示在变量列
4. 用户填充变量值
5. 点击"运行"按钮，传递给 `PlaygroundWrapper`
6. 执行完成后显示结果

#### 2. Playground 组件 (`Playground.tsx` - ~300+ 行)

**职责**:
- 集成 `markdown-flow-ui` 库的 `MarkdownFlow` 组件
- 处理 SSE 流式响应
- 渲染内容块和交互块
- 管理用户交互和变量更新

**关键 Props**:
```typescript
interface PlaygroundComponentProps {
  defaultContent: string                  // MarkdownFlow 文档
  defaultVariables?: Record<string, string> // 初始变量
  defaultDocumentPrompt?: string          // 文档提示词
  sseUrl?: string                         // SSE 端点 URL
  onVariableUpdate?: (name, value) => void // 变量更新回调
  onContentUpdate?: (content) => void     // 内容更新回调
  markdownInfo?: MarkdownInfoData         // 预解析的文档信息
}
```

**核心逻辑**:
1. 使用 `useMarkdownInfo` Hook 获取文档分析结果
2. 使用 `useSSE` Hook 连接后端 SSE 流
3. 动态导入 `markdown-flow-ui` 的 `MarkdownFlow` 组件
4. 处理内容块渲染、交互块交互
5. 收集变量更新并回调父组件

#### 3. SSE Hook (`useSSE.ts` - ~260 行)

**功能**: 管理 Server-Sent Events 连接

**特性**:
- 自动重连机制（最多 3 次重试，延迟 2 秒）
- 消息解析和累积
- 连接状态管理（idle/connecting/connected/error）
- 错误处理和回调

**API**:
```typescript
const {
  data,          // 接收到的数据数组
  isLoading,     // 加载状态
  error,         // 错误信息
  connect,       // 手动连接
  close          // 关闭连接
} = useSSE<T>(
  url: string,
  options?: {
    autoConnect?: boolean,      // 自动连接
    maxRetries?: number,        // 最大重试次数
    retryDelay?: number,        // 重试延迟（毫秒）
    onStart?: (index) => void,
    onFinish?: (data, index) => void,
    ...RequestInit
  }
)
```

**消息格式处理**:
```typescript
// SSE 事件数据格式
{
  type: "content" | "interaction" | "text_end",
  data: {
    mdflow: string,      // 实际内容
    variable?: string    // 交互块的变量名
  }
}
```

#### 4. 文档分析 Hook (`useMarkdownInfo.ts`)

**功能**: 调用后端 API 分析 MarkdownFlow 文档结构

**API 调用**: `POST /api/v1/playground/markdownflow_info`

**返回数据**:
```typescript
interface MarkdownFlowInfoResponse {
  code: number
  message: string
  data: {
    block_count: number          // 总块数
    variables: string[]          // 所有变量名
    interaction_blocks: number[] // 交互块索引列表
    content_blocks: number[]     // 内容块索引列表
  }
}
```

#### 5. API 客户端 (`lib/api.ts`)

**配置**:
```typescript
const API_BASE_URL =
  (process.env.NEXT_PUBLIC_PLAYGROUND_URL || '') + '/api/v1'
```

**核心函数**:
```typescript
async function getMarkdownFlowInfo(
  request: MarkdownFlowInfoRequest
): Promise<MarkdownFlowInfoResponse>
```

**特性**:
- 自动包含用户 ID header（`User-Id`）
- 错误处理和类型安全
- 支持自定义 API 基础 URL

#### 6. UI 组件库 (shadcn/ui)

**使用的组件**（12 个）:
- Button, Input, Textarea
- Dialog, Tabs, Badge
- Label, Dropdown Menu
- Scroll Area, Card

**特点**:
- 基于 Radix UI 原语构建
- Tailwind CSS 样式
- 完全可定制（源码包含在项目中）
- 无额外依赖包

#### 7. 样式系统

**Tailwind CSS v4**:
- 使用 CSS 变量主题系统
- 响应式设计
- PostCSS 处理
- 自定义动画和工具类

**全局样式** (`globals.css`):
- CSS 变量定义（颜色、间距等）
- 字体配置（Geist Sans）
- 动画定义

### 前端依赖项

**核心运行时依赖**:
```
Next.js 15.4.8             # React 框架
React 19.1.2               # UI 库
TypeScript 5               # 类型系统
Tailwind CSS 4             # 样式框架
markdown-flow-ui 0.1.44    # MarkdownFlow 渲染
remark-flow 0.1.6          # Markdown 解析
@microsoft/fetch-event-source 2.0.1  # SSE 客户端
Radix UI (多个包)          # UI 原语
Lucide React 0.525.0       # 图标库
```

**开发工具**:
```
ESLint 9                   # 代码检查
TypeScript ESLint          # TS 语法检查
Tailwind CSS ESLint        # 样式检查
```

---

## 数据流详解

### 完整请求流程

```
┌─────────────────────────────────────────────────┐
│ 1. 用户编辑 MarkdownFlow 文档                   │
│    app/page.tsx: 编辑框内容变化                 │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 2. 触发文档分析 (debounce 500ms)               │
│    useMarkdownInfo.ts                           │
│    → POST /api/v1/playground/markdownflow_info │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 3. 后端解析文档结构                             │
│    playground_api.py:markdownflow_info()       │
│    → playground_service.py                     │
│    → markdown-flow 库处理                      │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 4. 返回文档分析结果                             │
│    {                                           │
│      block_count: 5,                          │
│      variables: ["name", "age"],              │
│      interaction_blocks: [2, 4],              │
│      content_blocks: [0, 1, 3]                │
│    }                                           │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 5. 前端显示变量列 (VariableColumn)             │
│    用户填充变量值                               │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 6. 用户点击"运行"按钮                           │
│    PlaygroundWrapper.tsx 触发执行               │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 7. 发起 SSE 流式请求                           │
│    useSSE.ts                                   │
│    → POST /api/v1/playground/generate         │
│    请求体: {                                   │
│      content: "...",                          │
│      block_index: 0,                          │
│      variables: {...},                        │
│      document_prompt: "...",                  │
│      model: "deepseek-ai/DeepSeek-V3"         │
│    }                                           │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 8. 后端处理请求（流式）                         │
│    playground_api.py:generate_with_llm()       │
│    → playground_service.py:generate()          │
│    → MarkdownFlow 库                           │
│       ├─ 解析块结构                            │
│       ├─ 构建 LLM 提示词消息                   │
│       └─ 调用 LLM API                          │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 9. LLM 流式生成                                │
│    PlaygroundLLMProvider                       │
│    → LLMClient.chat_completion_sse()           │
│    → OpenAI API (或兼容 API)                   │
│    返回流式 tokens                             │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 10. 后端转换为 SSE 消息格式                     │
│     事件: data                                 │
│     数据: {                                    │
│       type: "content",                        │
│       data: { mdflow: "生成的文本片段" }      │
│     }                                          │
│     ... (持续推送)                             │
│     事件: data                                 │
│     数据: {                                    │
│       type: "text_end",                       │
│       data: { mdflow: "" }                   │
│     }                                          │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 11. 前端接收 SSE 消息（实时）                   │
│     useSSE.ts 解析消息                         │
│     → Playground.tsx 渲染内容                  │
│     → MarkdownFlow 组件显示                    │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 12. 用户交互（可选）                            │
│     遇到交互块时填写信息                        │
│     变量更新回调到父组件                        │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 13. 流式传输完成 (text_end)                    │
│     前端显示完整结果                            │
│     用户可复制或继续编辑                        │
└─────────────────────────────────────────────────┘
```

---

## API 接口清单

本项目专注于 MarkdownFlow Playground，提供以下 API 接口：

### 健康检查
- **`GET /health`** - 系统健康检查
  - 实现位置：`main.py:12-19`
  - 响应: `{"status": "healthy", "version": "1.0.0", "timestamp": "..."}`
  - 用途：监控、负载均衡器健康检查

### Playground API (`/api/v1/playground`)

#### 1. 流式 LLM 生成 ⭐ 核心功能
- **`POST /api/v1/playground/generate`**
  - 实现位置：`app/api/v1/playground_api.py:25-161`
  - 请求参数：
    ```python
    content: str                          # MarkdownFlow 文档内容
    block_index: int                      # 要执行的块索引（从 0 开始）
    variables: Dict[str, str]             # 变量映射
    user_input: Dict[str, List[str]]      # 用户输入（多选）
    context: List[ChatMessage]            # 对话上下文
    document_prompt: str                  # 文档级系统提示词
    model: str                            # LLM 模型名
    temperature: float                    # 温度参数（0.0-2.0）
    ```
  - 响应格式：Server-Sent Events 流式输出
  - 前端调用：`frontend/src/components/playground/Playground.tsx:86`

#### 2. 获取文档结构信息 ⭐ 核心功能
- **`POST /api/v1/playground/markdownflow_info`**
  - 实现位置：`app/api/v1/playground_api.py:164-225`
  - 请求参数：
    ```python
    content: str                          # MarkdownFlow 文档内容
    document_prompt: str                  # 可选：文档提示词
    ```
  - 响应格式：JSON
    ```json
    {
      "code": 200,
      "message": "Succeed",
      "data": {
        "block_count": 5,
        "variables": ["name", "age"],
        "interaction_blocks": [2, 4],
        "content_blocks": [0, 1, 3]
      }
    }
    ```
  - 前端调用：`frontend/src/components/playground/useMarkdownInfo.ts:38`

#### 3. 非流式完整生成
- **`POST /api/v1/playground/generate-complete`**
  - 实现位置：`app/api/v1/playground_api.py:228-346`
  - 请求参数：同 `/generate`
  - 响应格式：JSON（一次性返回完整结果）
  - 用途：批处理、服务端调用场景
  - 状态：**当前前端未使用，预留功能**

### 已删除的 API

以下 API 已被删除（2025-12-10 清理遗留代码）：
- ~~`POST /api/v1/llm/chat`~~ - 通用 LLM 同步聊天（未被前端使用）
- ~~`POST /api/v1/llm/generate`~~ - 通用 LLM 流式生成（已被 `/playground/generate` 替代）

删除原因：简化 API 表面，专注 MarkdownFlow Playground 核心功能

---

## 开发指南

### 添加新 API 端点

1. **定义数据模型**: 在 `app/models/` 创建 Pydantic 模型
2. **编写路由处理器**: 在 `app/api/v1/playground_api.py` 添加新端点
3. **实现业务逻辑**: 在 `app/services/playground_service.py` 添加服务方法
4. **注册路由**: 路由会自动注册（通过 `app/core.py` 的 `include_router`）
5. **测试**: 访问 `/docs` 查看 Swagger 文档并测试

### API 接口标准

- **统一响应格式**: 所有 API 必须使用 `app/utils/response.py` 中的标准格式
- **返回类型**: 使用 `response_model=BaseResponse` 并返回 `BaseResponse` 实例
- **成功响应**: 使用 `res.info(data=...)` 返回成功结果
- **错误响应**: 使用 `res.error(message=...)` 返回错误信息
- **参考示例**: `app/api/v1/playground_api.py`

示例：
```python
from app.utils.response import ResponseUtil

@router.post("/example")
async def example_endpoint():
    res = ResponseUtil()
    try:
        # 业务逻辑
        result = {"key": "value"}
        return res.info(data=result)
    except Exception as e:
        return res.error(message=str(e))
```

### 前端开发指南

#### 添加新组件
1. 在 `src/components/` 创建 `.tsx` 文件
2. 使用 TypeScript 定义 Props 接口
3. 使用 shadcn/ui 组件构建 UI
4. 导出组件供其他地方使用

#### 调用后端 API
1. 在 `src/lib/api.ts` 添加 API 函数
2. 定义 TypeScript 类型
3. 在组件中使用 React Query 或直接调用

示例：
```typescript
// lib/api.ts
export async function getExample(): Promise<ExampleResponse> {
  const response = await fetch(`${API_BASE_URL}/example`)
  if (!response.ok) throw new Error('API 调用失败')
  return response.json()
}

// component.tsx
const { data, error, isLoading } = useQuery({
  queryKey: ['example'],
  queryFn: getExample
})
```

### 环境变量配置

#### 后端环境变量 (`.env`)
```bash
# 应用配置
APP_NAME=Markdown Flow
DEBUG=true

# 服务器配置
HOST=0.0.0.0
PORT=8000

# LLM 配置
LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
LLM_API_KEY=your-api-key-here
LLM_MODEL=ep-20250825214221-xstb4
LLM_TEMPERATURE=0.3
```

#### 前端环境变量 (`.env.development`)
```bash
# API 基础 URL
NEXT_PUBLIC_PLAYGROUND_URL=http://localhost:8000

# 其他配置
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

### 代码规范

#### 后端代码规范
- **行长度**: 120 字符
- **格式化**: Black（默认配置） + isort
- **检查**: flake8
- **类型提示**: 使用 Python 类型提示（PEP 484）
- **文档字符串**: 使用 Google 风格

#### 前端代码规范
- **格式化**: ESLint + Prettier（通过 Next.js 配置）
- **命名**: 组件使用 PascalCase，函数/变量使用 camelCase
- **文件**: 组件文件名使用 PascalCase（如 `Playground.tsx`）
- **类型**: 优先使用 TypeScript 接口，避免 `any` 类型

---

## Markdown-Flow 库集成

### 包信息

- **包名**: `markdown-flow`
- **版本**: `0.2.35`
- **安装源**: https://pypi.org/project/markdown-flow/
- **GitHub**: https://github.com/ai-shifu/markdown-flow-agent-py
- **导入方式**: `from markdown_flow import MarkdownFlow`

### 核心功能

MarkdownFlow 库负责：
1. 解析 MarkdownFlow 文档（块分割、变量提取）
2. 构建 LLM 提示词消息（system/assistant/user 角色分配）
3. 处理交互块渲染和验证
4. 管理上下文和变量替换
5. 流式内容生成

### 集成方式

**后端集成** (纯委托模式):
```python
# app/services/playground_service.py
from markdown_flow import MarkdownFlow

def generate_with_llm(...):
    # 创建 MarkdownFlow 实例
    md_flow = MarkdownFlow(
        content=content,
        document_prompt=document_prompt,
        llm_provider=llm_provider
    )

    # 委托给 MarkdownFlow 处理
    for chunk in md_flow.generate_block_streaming(...):
        yield chunk
```

**前端集成**:
```typescript
// 使用 markdown-flow-ui 库
import { MarkdownFlow } from 'markdown-flow-ui'

<MarkdownFlow
  content={markdownContent}
  variables={variables}
  onSendContent={handleSendContent}
  sseUrl="/api/v1/playground/generate"
/>
```

### MarkdownFlow 语法示例

#### 1. 内容块
```markdown
生成一段欢迎消息，包含以下要点：
- 欢迎用户 {{name}} 来到 MarkdownFlow
- 介绍 MarkdownFlow 是什么
- 询问用户想了解哪方面功能
```

#### 2. 交互块
```markdown
# 单选
?[%{{choice}} 选项1|选项2|选项3]

# 多选
?[${{choices}} 选项A|选项B|选项C|选项D]

# 文本输入
?[{{user_input}} 请输入您的反馈...]
```

#### 3. 保留内容块
```markdown
===
这段内容会原样输出，不经过 LLM 处理。

可以包含表格、代码等需要精确格式的内容。
===
```

#### 4. 块分隔符
```markdown
第一个内容块...

---

第二个内容块...

---

第三个内容块...
```

### 消息构建机制

**内容块的消息构建**:
```python
[
    {"role": "system", "content": "文档提示词（document_prompt）"},
    {"role": "assistant", "content": "内容块作为 LLM 生成风格示例"}
]
```

**关键设计**:
- 内容块作为 `assistant` 角色：提供生成风格示例，而非用户指令
- 大多数内容块不需要历史对话上下文（独立指令）
- System 消息应始终在最前面

---

## 常见问题

### 后端相关

**Q: 如何切换 LLM 提供商？**

A: 修改 `.env` 文件中的 `LLM_BASE_URL` 和 `LLM_API_KEY`：

```bash
# OpenAI
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4

# DeepSeek
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=deepseek-chat

# 豆包（字节跳动）
LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
LLM_API_KEY=...
LLM_MODEL=ep-...
```

**Q: 如何调试 LLM 消息？**

A: 设置 `DEBUG=true` 在 `.env` 文件中，LLMClient 会彩色打印所有消息：

```python
# 输出示例
🚀 LLM Context (3 messages)
==================================================

 1. ⚙️  SYSTEM    [120 chars]
    你是一位专业的 AI 助手...

 2. 🤖  ASSISTANT [200 chars]
    用友好的语气回复用户...

 3. 👤  USER      [50 chars]
    你好，请介绍一下自己
==================================================
```

**Q: SSE 连接断开怎么办？**

A: 前端 `useSSE` Hook 会自动重连（最多 3 次），无需手动处理。

### 前端相关

**Q: 如何修改 Playground 的默认配置？**

A: 在 `app/page.tsx` 中修改：

```typescript
<PlaygroundWrapper
  defaultContent={content}
  defaultVariables={variables}
  sseUrl="/api/v1/playground/generate"  // 自定义 SSE URL
  defaultDocumentPrompt="你的提示词..."  // 自定义文档提示词
/>
```

**Q: 如何添加新的 UI 组件？**

A: 使用 shadcn/ui CLI：

```bash
cd frontend
npx shadcn@latest add [component-name]
```

组件会自动添加到 `src/components/ui/` 目录。

---
### 项目状态

**当前版本**: 1.0.0

**稳定性**: ✅ 生产就绪
- 后端 API 稳定
- 前端 UI 完整
- SSE 流式传输正常
- LLM 集成稳定
- 变量管理系统正常

**代码质量**: ✅ 良好
- 类型安全（Python 类型提示 + TypeScript）
- 代码格式化（Black + ESLint）
- 清晰的分层架构
- 完整的错误处理

---

## 技术栈总结

### 后端技术栈
```
FastAPI 0.116.0           → Web 框架
├─ Starlette 0.46.2       → ASGI 工具包
├─ Pydantic 2.11.7        → 数据验证
└─ uvicorn 0.35.0         → ASGI 服务器

OpenAI >= 1.0.0           → LLM API 客户端
markdown-flow 0.2.35      → MarkdownFlow 核心库

工具库:
├─ python-dotenv 1.1.1    → 环境变量
└─ python-multipart       → 表单解析

开发工具:
├─ black 24.1.1           → 代码格式化
├─ isort 5.13.2           → Import 排序
├─ flake8 7.0.0           → 代码检查
└─ pytest 7.4.4           → 测试框架
```

### 前端技术栈
```
Next.js 15.4.8            → React 框架
├─ React 19.1.2           → UI 库
├─ TypeScript 5           → 类型系统
└─ Turbopack              → 模块打包器

样式和 UI:
├─ Tailwind CSS 4         → 样式框架
├─ PostCSS 4              → CSS 处理
├─ shadcn/ui              → 组件库
├─ Radix UI               → UI 原语
└─ Lucide React 0.525.0   → 图标库

业务库:
├─ markdown-flow-ui 0.1.44   → MarkdownFlow 渲染
├─ remark-flow 0.1.6         → Markdown 解析
└─ @microsoft/fetch-event-source 2.0.1  → SSE 客户端

开发工具:
├─ ESLint 9               → 代码检查
└─ TypeScript ESLint      → TS 语法检查
```

---

## 关键文件速查

### 后端关键文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `app/api/v1/playground_api.py` | ~350 | **核心 API 端点**（最重要）|
| `app/models/markdown_flow.py` | ~334 | 数据模型定义 |
| `app/services/playground_service.py` | ~100 | 业务逻辑层 |
| `app/library/llmclient.py` | ~150 | LLM API 客户端 |
| `app/library/llm_provider.py` | ~80 | LLM Provider 适配器 |
| `app/core.py` | ~50 | 应用初始化 |
| `app/config/settings.py` | ~50 | 配置管理 |
| `main.py` | ~30 | 应用入口 |

### 前端关键文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/app/page.tsx` | ~500+ | **主页面**（最重要）|
| `src/components/playground/Playground.tsx` | ~300+ | **MarkdownFlow 渲染器**（核心）|
| `src/components/playground/useSSE.ts` | ~260 | SSE 连接 Hook |
| `src/lib/api.ts` | ~90 | API 客户端 |
| `src/components/EditPanel.tsx` | ~200 | 编辑面板 |
| `src/components/VariableColumn.tsx` | ~170 | 变量管理 |
| `src/components/playground/useMarkdownInfo.ts` | ~80 | 文档分析 Hook |

