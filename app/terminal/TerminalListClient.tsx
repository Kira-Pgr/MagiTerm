'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Terminal, Clock } from 'lucide-react'
import { OS_PRESETS, CPU_PRESETS, GPU_PRESETS } from '@/lib/system-presets'

interface Session {
  id: string
  title: string
  os: string
  cpu: string
  gpu: string
  createdAt: string
  updatedAt: string
}

export function TerminalListClient() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  // New session form
  const [newOsOption, setNewOsOption] = useState(OS_PRESETS[0].value)
  const [customOsInput, setCustomOsInput] = useState('')
  const [newCpuOption, setNewCpuOption] = useState(CPU_PRESETS[0])
  const [customCpuInput, setCustomCpuInput] = useState('')
  const [newGpuOption, setNewGpuOption] = useState(GPU_PRESETS[0])
  const [customGpuInput, setCustomGpuInput] = useState('')
  const [newTitle, setNewTitle] = useState('')

  const resolvedNewOs = useMemo(
    () => (newOsOption === 'custom' ? customOsInput.trim() : newOsOption),
    [newOsOption, customOsInput]
  )
  const resolvedNewCpu = useMemo(
    () => (newCpuOption === 'custom' ? customCpuInput.trim() : newCpuOption),
    [newCpuOption, customCpuInput]
  )
  const resolvedNewGpu = useMemo(
    () => (newGpuOption === 'custom' ? customGpuInput.trim() : newGpuOption),
    [newGpuOption, customGpuInput]
  )

  const isFormValid =
    resolvedNewOs.length > 0 && resolvedNewCpu.length > 0 && resolvedNewGpu.length > 0

  useEffect(() => {
    fetchSessions()
  }, [])

  const redirectIfUnauthorized = useCallback((response: Response, payload: any) => {
    const hasUnauthorizedError =
      response.status === 401 ||
      payload?.errors?.some(
        (err: { message?: string }) => err.message?.toLowerCase().includes('unauthorized') ?? false
      )

    if (hasUnauthorizedError) {
      router.push('/login')
      return true
    }

    return false
  }, [router])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              me {
                sessions {
                  id
                  title
                  os
                  cpu
                  gpu
                  createdAt
                  updatedAt
                }
              }
            }
          `,
        }),
      })

      const result = await response.json()

      if (redirectIfUnauthorized(response, result)) {
        return
      }

      const { data } = result
      if (data?.me?.sessions) {
        setSessions(data.me.sessions)
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createSession = async () => {
    if (!isFormValid) {
      return
    }

    setIsCreating(true)

    try {
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
            os: resolvedNewOs,
            cpu: resolvedNewCpu,
            gpu: resolvedNewGpu,
            title: newTitle || 'New Session',
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
    } finally {
      setIsCreating(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const formatOsLabel = (os: string) => {
    const words = os.trim().split(/\s+/)
    if (words.length <= 2) {
      return os
    }
    return `${words.slice(0, 2).join(' ')}...`
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Terminal Sessions</h1>
        <p className="text-muted-foreground">Manage your AI-powered terminal sessions</p>
      </div>

      {/* New Session Card */}
      <div className="mb-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Create New Session</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 lg:col-span-1">
            <Label htmlFor="title">Session Title (optional)</Label>
            <Input
              id="title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="My Terminal Session"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="os">Operating System</Label>
            <Select
              value={newOsOption}
              onValueChange={(value) => {
                setNewOsOption(value)
                if (value !== 'custom') {
                  setCustomOsInput('')
                }
              }}
            >
              <SelectTrigger id="os" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OS_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newOsOption === 'custom' && (
              <Input
                className="mt-2"
                placeholder="E.g., Debian 12"
                value={customOsInput}
                onChange={(e) => setCustomOsInput(e.target.value)}
              />
            )}
          </div>
          <div>
            <Label htmlFor="cpu">CPU</Label>
            <Select
              value={newCpuOption}
              onValueChange={(value) => {
                setNewCpuOption(value)
                if (value !== 'custom') {
                  setCustomCpuInput('')
                }
              }}
            >
              <SelectTrigger id="cpu" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CPU_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {preset === 'custom' ? 'Custom...' : preset}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newCpuOption === 'custom' && (
              <Input
                className="mt-2"
                placeholder="E.g., Apple M4 Max"
                value={customCpuInput}
                onChange={(e) => setCustomCpuInput(e.target.value)}
              />
            )}
          </div>
          <div>
            <Label htmlFor="gpu">GPU</Label>
            <Select
              value={newGpuOption}
              onValueChange={(value) => {
                setNewGpuOption(value)
                if (value !== 'custom') {
                  setCustomGpuInput('')
                }
              }}
            >
              <SelectTrigger id="gpu" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GPU_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {preset === 'custom' ? 'Custom...' : preset}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newGpuOption === 'custom' && (
              <Input
                className="mt-2"
                placeholder="E.g., NVIDIA H100"
                value={customGpuInput}
                onChange={(e) => setCustomGpuInput(e.target.value)}
              />
            )}
          </div>
        </div>
        <Button
          onClick={createSession}
          disabled={isCreating || !isFormValid}
          className="mt-4 gap-2"
        >
          <Plus className="h-4 w-4" />
          {isCreating ? 'Creating...' : 'Create Session'}
        </Button>
      </div>

      {/* Sessions List */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Your Sessions</h2>

        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Terminal className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No sessions yet. Create your first session above!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/terminal/${session.id}`}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-gray-600 hover:shadow-lg"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-lg bg-muted p-2">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs uppercase">
                    {formatOsLabel(session.os)}
                  </span>
                </div>

                <h3 className="mb-2 text-lg font-semibold group-hover:text-gray-200">
                  {session.title}
                </h3>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>CPU: {session.cpu}</p>
                  <p>GPU: {session.gpu}</p>
                </div>

                <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDate(session.updatedAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


