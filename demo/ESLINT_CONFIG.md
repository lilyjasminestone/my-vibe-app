# ESLint 配置说明

## 配置概览

本项目使用 ESLint 9 的新配置格式（flat config）进行代码质量检查。配置文件位于 `eslint.config.mjs`。

## 配置结构

### 1. 基础配置
- 扩展 Next.js 官方配置：`next/core-web-vitals`、`next/typescript`
- 使用 `@eslint/eslintrc` 实现向后兼容

### 2. 自定义规则配置

#### TypeScript 相关规则
- `@typescript-eslint/no-explicit-any`: "error" - 禁用 any 类型
- `@typescript-eslint/no-unused-vars`: "error" - 检查未使用变量（忽略以 _ 开头的变量）
- `@typescript-eslint/consistent-type-imports`: "error" - 强制使用类型导入

#### React 相关规则
- `react-hooks/exhaustive-deps`: "error" - 检查 hook 依赖
- `react/jsx-no-leaked-render`: "error" - 防止条件渲染泄漏
- `react/jsx-key`: "error" - 检查 key 属性
- `react/self-closing-comp`: "error" - 强制自闭合标签

#### 代码质量规则
- `no-console`: "warn" - 警告 console 语句
- `no-debugger`: "error" - 禁用 debugger
- `no-unused-expressions`: "error" - 禁用未使用表达式
- `prefer-const`: "error" - 优先使用 const
- `eqeqeq`: "error" - 强制使用严格相等
- `curly`: "error" - 强制使用花括号

#### 代码风格规则
- `semi`: "never" - 不使用分号
- `quotes`: "single" - 使用单引号
- `comma-dangle`: "always-multiline" - 多行时使用尾随逗号
- `object-curly-spacing`: "always" - 对象花括号内空格
- `max-len`: 120 字符 - 最大行长度限制

#### Next.js 特定规则
- `@next/next/no-page-custom-font`: "warn" - 检查字体加载
- `@next/next/no-img-element`: "error" - 使用 Next.js Image 组件
- `@next/next/no-html-link-for-pages`: "error" - 使用 Next.js Link

#### 导入规则
- `import/order`: 导入排序规则
  - builtin → external → internal → parent → sibling → index
  - 分组间空行
  - 字母排序

#### 安全规则
- `no-eval`: "error" - 禁用 eval
- `no-implied-eval`: "error" - 禁用隐式 eval
- `no-script-url`: "error" - 禁用 script: URL

### 3. 特殊文件配置

#### 配置文件
- 文件：`**/*.config.{js,ts,mjs}`, `**/*.setup.{js,ts}`
- 允许使用 console.log 和 require

#### 测试文件
- 文件：`**/__tests__/**/*`, `**/*.{test,spec}.{js,ts,jsx,tsx}`
- 允许使用 console.log 和 any 类型

### 4. 忽略文件
- `node_modules/**`
- `.next/**`
- `out/**`, `dist/**`, `build/**`
- `*.min.js`
- `public/**`
- `coverage/**`
- `.env*`

## 使用的脚本

### 基础命令
```bash
npm run lint          # 运行 lint 检查
npm run lint:fix      # 自动修复可修复的问题
npm run lint:strict   # 严格模式（警告也会失败）
npm run type-check    # TypeScript 类型检查
```

### 开发建议

#### 1. 开发流程
1. 编写代码时实时使用 IDE ESLint 插件
2. 提交前运行 `npm run lint:fix` 自动修复
3. 手动修复无法自动修复的问题
4. 运行 `npm run type-check` 检查类型错误

#### 2. 常见问题及解决方案

**问题：console 语句警告**
```javascript
// 开发环境使用
if (process.env.NODE_ENV === 'development') {
  console.log('debug info')
}

// 或使用调试工具替代
import debug from 'debug'
const log = debug('app:component')
log('debug info')
```

**问题：any 类型错误**
```javascript
// 错误
function process(data: any) {}

// 正确
function process(data: unknown) {}
function process<T>(data: T) {}
function process(data: Record<string, unknown>) {}
```

**问题：未使用变量**
```javascript
// 错误
catch (error) {}

// 正确
catch (_error) {}
catch (error) {
  console.error(error)
}
```

#### 3. IDE 配置建议

**VS Code**
```json
{
  "eslint.experimental.useFlatConfig": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": false
}
```

## Next.js 集成

在 `next.config.ts` 中已启用 ESLint：
```typescript
eslint: {
  ignoreDuringBuilds: false,
  dirs: ['src'], // 只检查 src 目录
}
```

构建时会自动运行 ESLint 检查，确保代码质量。

## 配置维护

当需要修改规则时：

1. 更新 `eslint.config.mjs`
2. 运行 `npm run lint` 测试配置
3. 使用 `npm run lint:fix` 批量修复
4. 更新此文档说明新规则

## 配置文件历史

- **v1.0**: 初始配置，基于 Next.js 默认配置
- **v2.0**: 添加完整的自定义规则集
- **v3.0**: 使用 ESLint 9 flat config 格式
