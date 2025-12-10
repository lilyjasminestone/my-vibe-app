import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 自定义规则配置
  {
    name: "custom-rules",
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // TypeScript 相关规则
      "@typescript-eslint/no-explicit-any": "warn", // 改为 warn，开发阶段更友好
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn", // 改为 warn，不阻断开发
        { prefer: "type-imports" }
      ],

      // React 相关规则
      "react-hooks/exhaustive-deps": "warn", // 改为 warn，避免阻断开发
      "react/jsx-no-leaked-render": "error",
      "react/jsx-key": "error",
      "react/no-unescaped-entities": "error",
      "react/self-closing-comp": ["error", {
        "component": true,
        "html": true
      }],

      // 代码质量规则
      "no-console": "warn",
      "no-debugger": "error",
      "no-unused-expressions": "error",
      "no-duplicate-imports": "error",
      "no-var": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],

      // 代码风格规则 - 调整为 warn，不阻断开发
      "semi": ["warn", "never"],
      "quotes": ["warn", "single", { "avoidEscape": true }],
      "comma-dangle": ["warn", "always-multiline"],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "indent": "off", // Disabled due to potential stack overflow with complex code
      "max-len": ["warn", {
        "code": 120,
        "ignoreUrls": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true
      }],

      // Next.js 特定规则
      "@next/next/no-page-custom-font": "warn",
      "@next/next/no-img-element": "error",
      "@next/next/no-html-link-for-pages": "error",

      // 导入规则 - 调整为 warn，保持代码整洁但不阻断开发
      "import/order": ["warn", {
        "groups": [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "newlines-between": "always",
        "alphabetize": {
          "order": "asc",
          "caseInsensitive": true
        }
      }],

      // 安全相关规则
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-script-url": "error"
    }
  },

  // 特殊文件规则配置
  {
    name: "config-files",
    files: ["**/*.config.{js,ts,mjs}", "**/*.setup.{js,ts}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-var-requires": "off"

    }
  },

  // 测试文件规则配置
  {
    name: "test-files",
    files: ["**/__tests__/**/*", "**/*.{test,spec}.{js,ts,jsx,tsx}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    }
  },

  // 忽略特定文件
  {
    name: "ignored-files",
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "*.min.js",
      "public/**",
      "coverage/**",
      ".env*"
    ]
  }
];

export default eslintConfig;
