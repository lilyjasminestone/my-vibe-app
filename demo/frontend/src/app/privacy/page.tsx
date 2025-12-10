'use client'

import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back to home link */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-primary hover:text-primary/80 transition-colors text-sm"
          >
            ← 返回首页
          </Link>
        </div>

        <div className="prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold mb-6">隐私政策</h1>
          <p className="text-muted-foreground mb-8">最后更新：2025 年 8 月</p>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4">概述</h2>
              <p>
                MarkdownFlow 体验台尊重并保护您的隐私。我们承诺以透明的方式处理您的数据。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">数据处理</h2>
              <p>为了提供服务并改进产品：</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>
                  <strong>匿名保存</strong>：您的数据会以匿名方式保存，用于调试分析
                </li>
                <li>
                  <strong>不关联身份</strong>：所有数据都使用临时匿名标识符，不会关联您的真实身份
                </li>
                <li>
                  <strong>加密传输</strong>：数据传输使用加密连接确保安全
                </li>
                <li>
                  <strong>第三方服务</strong>：我们使用第三方 AI 服务（如 DeepSeek）处理内容生成
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">本地存储</h2>
              <p>为了改善用户体验，我们在您的浏览器中存储一些数据：</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>
                  <strong>编辑内容</strong>：保存您的编辑内容，避免意外丢失
                </li>
                <li>
                  <strong>临时标识</strong>：匿名的用户 ID 和会话 ID，有效期 30 天
                </li>
                <li>
                  <strong>技术 Cookie</strong>：仅使用必要的技术性 Cookie 维持基本功能
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">联系我们</h2>
              <p>如有疑问，请联系我们：</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>
                  GitHub: <a href="https://github.com/ai-shifu/markdown-flow/issues"
                    target="_blank"
                    rel="noopener"
                    className="text-primary hover:text-primary/80">
                    提交 Issue
                  </a>
                </li>
                <li>
                  网站: <a href="https://ai-shifu.com"
                    target="_blank"
                    rel="noopener"
                    className="text-primary hover:text-primary/80">
                    ai-shifu.com
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
