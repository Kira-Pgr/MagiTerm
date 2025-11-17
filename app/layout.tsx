import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { Terminal } from 'lucide-react'
import { AuthNav } from '@/components/AuthNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MagiTerm - AI-Powered Terminal Simulator',
  description:
    'An imaginary terminal powered by AI that can execute, explain, and suggest commands',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col">
          {/* Top Navigation */}
          <header className="border-b border-border bg-card">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
              <div className="flex items-center gap-10">
                <Link href="/" className="flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 p-2">
                    <Terminal className="h-5 w-5 text-gray-100" />
                  </div>
                  <span className="text-xl font-bold">MagiTerm</span>
                </Link>

                <nav className="flex items-center gap-6">
                  <Link
                    href="/terminal"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Sessions
                  </Link>
                  <Link
                    href="/about"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    About
                  </Link>
                </nav>
              </div>

              <AuthNav />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  )
}
