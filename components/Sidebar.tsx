'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { CodeHighlight } from './CodeHighlight'
import { Sparkles, Info } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type StreamEvent =
  | { kind: 'delta'; data: { field: string; text: string } }
  | { kind: 'result'; data?: Record<string, unknown> }
  | { kind: 'error'; data?: { message?: string } }
  | { kind: 'done'; data?: Record<string, unknown> }
  | { kind: string; data?: Record<string, unknown> }

async function readEventStream(response: Response, onEvent: (event: StreamEvent) => void) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Missing response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  const processBuffer = () => {
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary).replace(/\r/g, '')
      buffer = buffer.slice(boundary + 2)
      const dataLine = rawEvent
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('data:'))

      if (dataLine) {
        const payload = dataLine.slice(5).trim()
        if (payload.length > 0) {
          try {
            onEvent(JSON.parse(payload))
          } catch (error) {
            console.error('Failed to parse stream payload', error, payload)
          }
        }
      }

      boundary = buffer.indexOf('\n\n')
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        processBuffer()
        break
      }

      buffer += decoder.decode(value, { stream: true })
      processBuffer()
    }
  } finally {
    reader.releaseLock()
  }
}

interface SidebarProps {
  sessionId: string
  os: string
  cpu: string
  gpu: string
  onInsertCommand?: (command: string) => void
}

export function Sidebar({
  sessionId,
  os,
  cpu,
  gpu,
  onInsertCommand,
}: SidebarProps) {
  // Generate tab state
  const [goal, setGoal] = useState('')
  const [suggestion, setSuggestion] = useState<{
    command: string
    explanation: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const suggestionAbortRef = useRef<AbortController | null>(null)

  // Explain tab state
  const [commandToExplain, setCommandToExplain] = useState('')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const explainAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      suggestionAbortRef.current?.abort()
      explainAbortRef.current?.abort()
    }
  }, [])

  const handleGenerate = async () => {
    if (!goal.trim()) return

    suggestionAbortRef.current?.abort()
    const abortController = new AbortController()
    suggestionAbortRef.current = abortController

    setIsGenerating(true)
    setSuggestion(null)

    try {
      const response = await fetch('/api/ai/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          os,
          cpu,
          gpu,
          goal,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Generate request failed: ${response.status}`)
      }

      await readEventStream(response, (event) => {
        if (event.kind === 'delta') {
          const field =
            typeof event.data?.field === 'string' ? event.data.field : undefined
          const text = typeof event.data?.text === 'string' ? event.data.text : ''
          if (!field || !text) return

          setSuggestion((prev) => {
            const next = prev ?? { command: '', explanation: '' }
            if (field === 'command') {
              return { ...next, command: next.command + text }
            }
            if (field === 'explanation') {
              return { ...next, explanation: next.explanation + text }
            }
            return next
          })
        } else if (event.kind === 'result') {
          const data = event.data ?? {}
          setSuggestion({
            command: typeof data.command === 'string' ? data.command : '',
            explanation: typeof data.explanation === 'string' ? data.explanation : '',
          })
        } else if (event.kind === 'error') {
          throw new Error(event.data?.message ?? 'Unknown AI error')
        }
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error('Generate error:', error)
      setSuggestion(null)
    } finally {
      if (suggestionAbortRef.current === abortController) {
        suggestionAbortRef.current = null
      }
      setIsGenerating(false)
    }
  }

  const handleGoalKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isGenerating && goal.trim()) {
        handleGenerate()
      }
    }
  }

  const handleExplain = async () => {
    if (!commandToExplain.trim()) return

    explainAbortRef.current?.abort()
    const abortController = new AbortController()
    explainAbortRef.current = abortController

    setIsExplaining(true)
    setExplanation('')

    try {
      const response = await fetch('/api/ai/explain/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          os,
          cpu,
          gpu,
          command: commandToExplain,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Explain request failed: ${response.status}`)
      }

      await readEventStream(response, (event) => {
        if (event.kind === 'delta') {
          const text = typeof event.data?.text === 'string' ? event.data.text : ''
          if (!text) return
          setExplanation((prev) => `${prev ?? ''}${text}`)
        } else if (event.kind === 'result') {
          const finalText = event.data?.explanation
          if (typeof finalText === 'string') {
            setExplanation(finalText)
          }
        } else if (event.kind === 'error') {
          throw new Error(event.data?.message ?? 'Unknown AI error')
        }
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error('Explain error:', error)
      setExplanation(null)
    } finally {
      if (explainAbortRef.current === abortController) {
        explainAbortRef.current = null
      }
      setIsExplaining(false)
    }
  }

  const handleExplainKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isExplaining && commandToExplain.trim()) {
        handleExplain()
      }
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card">
      <Tabs defaultValue="generate" className="flex h-full flex-col">
        <TabsList className="m-4 mb-0">
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="explain" className="gap-2">
            <Info className="h-4 w-4" />
            Explain
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="goal" className="text-muted-foreground">
                What do you want to achieve?
              </Label>
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={handleGoalKeyDown}
                placeholder="E.g., Find all large files in the current directory"
                className="mt-2 min-h-[100px]"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !goal.trim()}
              className="w-full"
            >
              {isGenerating ? 'Generating...' : 'Generate Command'}
            </Button>

            {suggestion && (
              <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Suggested Command
                  </Label>
                  <div className="mt-2 rounded-lg border border-border bg-[#050505] p-3">
                    <div className="terminal-scroll overflow-x-auto font-mono text-sm text-foreground">
                      <div className="min-w-max">
                        <CodeHighlight
                          code={suggestion.command}
                          lang="bash"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onInsertCommand?.(suggestion.command)}
                  className="w-full"
                >
                  Insert to Prompt
                </Button>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    Explanation
                  </Label>
                  <p className="mt-2 text-sm text-foreground">
                    {suggestion.explanation}
                  </p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="explain" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="command" className="text-muted-foreground">
                What should MagiTerm explain?
              </Label>
              <Textarea
                id="command"
                value={commandToExplain}
                onChange={(e) => setCommandToExplain(e.target.value)}
                onKeyDown={handleExplainKeyDown}
                placeholder="Ask about any command or terminal concept"
                className="mt-2 min-h-[80px]"
              />
            </div>

            <Button
              onClick={handleExplain}
              disabled={isExplaining || !commandToExplain.trim()}
              className="w-full"
            >
              {isExplaining ? 'Analyzing...' : 'Ask AI'}
            </Button>

            {explanation && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
                <Label className="text-xs text-muted-foreground">
                  Breakdown
                </Label>
                <div className="markdown-content text-sm leading-relaxed text-foreground [&>*:not(:last-child)]:mb-2 [&_code]:rounded [&_code]:bg-muted/60 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-[#050505] [&_pre]:p-3 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {explanation}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
