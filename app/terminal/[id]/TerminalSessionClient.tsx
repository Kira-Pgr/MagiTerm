'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Shell, type ShellHandle } from '@/components/Shell'
import { Sidebar } from '@/components/Sidebar'
import { Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface CommandData {
  id: string
  input: string
  output: string | null
  createdAt: string
}

interface SessionData {
  id: string
  title: string
  os: string
  cpu: string
  gpu: string
  cwd: string
  commands: CommandData[]
}

interface SessionSpecsProps {
  os: string
  cpu: string
  gpu: string
}

interface TerminalSessionClientProps {
  sessionId: string
}

function SessionSpecs({ os, cpu, gpu }: SessionSpecsProps) {
  const truncateWords = (value: string, maxWords = 9) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return { text: '—', fullText: '', truncated: false }
    }
    const words = trimmed.split(/\s+/)
    if (words.length <= maxWords) {
      return { text: trimmed, fullText: trimmed, truncated: false }
    }
    return {
      text: `${words.slice(0, maxWords).join(' ')}...`,
      fullText: trimmed,
      truncated: true,
    }
  }

  const renderSpec = (label: string, value: string) => {
    const { text, fullText, truncated } = truncateWords(value)
    return (
      <div className="group relative flex items-center gap-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
        <span className="rounded-full border border-border px-3 py-1 text-sm text-foreground">
          {text}
        </span>
        {truncated && (
          <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden w-64 -translate-x-1/2 translate-y-3 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/90 px-3 py-2 text-left text-xs text-white shadow-2xl transition-opacity group-hover:block">
            {fullText}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      {renderSpec('OS', os)}
      {renderSpec('CPU', cpu)}
      {renderSpec('GPU', gpu)}
    </div>
  )
}

export function TerminalSessionClient({ sessionId }: TerminalSessionClientProps) {
  const router = useRouter()

  const [session, setSession] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const shellRef = useRef<ShellHandle>(null)

  const redirectIfUnauthorized = useCallback(
    (response: Response, payload: any) => {
      const unauthorized =
        response.status === 401 ||
        payload?.errors?.some(
          (err: { message?: string }) => err.message?.toLowerCase().includes('unauthorized') ?? false
        )

      if (unauthorized) {
        router.push('/login')
        return true
      }

      return false
    },
    [router]
  )

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetSession($id: ID!) {
              session(id: $id) {
                id
                title
                os
                cpu
                gpu
                cwd
                commands {
                  id
                  input
                  output
                  createdAt
                }
              }
            }
          `,
          variables: { id: sessionId },
        }),
      })

      const result = await response.json()

      if (redirectIfUnauthorized(response, result)) {
        return
      }

      const { data } = result
      if (data?.session) {
        setSession(data.session)
      }
    } catch (error) {
      console.error('Failed to fetch session:', error)
    } finally {
      setIsLoading(false)
    }
  }, [redirectIfUnauthorized, sessionId])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const handleCommandSubmit = useCallback(
    async (command: string): Promise<string | undefined> => {
      try {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              mutation RunCommand($sessionId: ID!, $input: String!) {
                runCommand(sessionId: $sessionId, input: $input) {
                  id
                }
              }
            `,
            variables: {
              sessionId,
              input: command,
            },
          }),
        })

        const result = await response.json()

        if (redirectIfUnauthorized(response, result)) {
          throw new Error('Unauthorized')
        }

        const commandId = result?.data?.runCommand?.id as string | undefined
        const firstError = result?.errors?.[0]?.message
        if (!response.ok || !commandId || firstError) {
          const errorMessage = firstError || 'Failed to create command record'
          throw new Error(errorMessage)
        }

        return commandId
      } catch (error) {
        console.error('Failed to create command record:', error)
        throw error
      }
    },
    [redirectIfUnauthorized, sessionId]
  )

  const handleInsertCommand = (command: string) => {
    shellRef.current?.setInputValue(command)
    shellRef.current?.focusInput()
  }

  const createNewSession = async () => {
    if (!session) {
      return
    }

    try {
      const fallbackOs = session.os.trim() || 'ubuntu'
      const fallbackCpu = session.cpu.trim() || 'Intel Xeon Silver'
      const fallbackGpu = session.gpu.trim() || 'NVIDIA RTX 4090'
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateSession($os: String!, $title: String, $cpu: String!, $gpu: String!) {
              createSession(os: $os, title: $title, cpu: $cpu, gpu: $gpu) {
                id
              }
            }
          `,
          variables: {
            os: fallbackOs,
            cpu: fallbackCpu,
            gpu: fallbackGpu,
            title: 'New Session',
          },
        }),
      })

      const result = await response.json()

      if (redirectIfUnauthorized(response, result)) {
        return
      }

      const { data } = result
      if (data?.createSession?.id) {
        router.push(`/terminal/${data.createSession.id}`)
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">Session not found</p>
          <Link href="/terminal">
            <Button variant="outline">Back to Sessions</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top Bar */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/terminal">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">{session.title}</h1>
          </div>

          <div className="flex items-center gap-4">
            <SessionSpecs os={session.os} cpu={session.cpu} gpu={session.gpu} />

            <Button onClick={createNewSession} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Terminal (70%) */}
        <div className="w-[70%] p-4">
          <Shell
            ref={shellRef}
            sessionId={sessionId}
            os={session.os}
            onCommandSubmit={handleCommandSubmit}
            initialCommands={session.commands || []}
          />
        </div>

        {/* Sidebar (30%) */}
        <div className="w-[30%] border-l border-border p-4">
          <Sidebar
            sessionId={sessionId}
            os={session.os}
            cpu={session.cpu}
            gpu={session.gpu}
            onInsertCommand={handleInsertCommand}
          />
        </div>
      </div>
    </div>
  )
}


