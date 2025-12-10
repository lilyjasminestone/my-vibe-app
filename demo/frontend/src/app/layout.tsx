import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'

import { Footer } from '@/components/Footer'
import 'markdown-flow-ui/dist/markdown-flow-ui.css'
import 'markdown-flow-ui/dist/markdown-flow-ui-lib.css'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  fallback: ['Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
})

export const metadata: Metadata = {
  description:
    'Interactive MarkdownFlow playground for creating and testing workflows',
  icons: {
    icon: '/logo-color.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      style={{ colorScheme: 'light' }}
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-inter antialiased">
        <div className="h-screen flex flex-col">
          <div className="flex-1 overflow-hidden">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  )
}
