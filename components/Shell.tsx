'use client'

import {
  KeyboardEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { Copy } from 'lucide-react'
import { Button } from './ui/button'

interface TerminalLine {
  type: 'input' | 'output' | 'error'
  content: string
  timestamp?: Date
}

interface InitialCommand {
  id: string
  input: string
  output: string | null
  createdAt: string
}

interface ShellProps {
  sessionId: string
  os: string
  onCommandSubmit?: (command: string) => Promise<string | void> | string | void
  initialCommands?: InitialCommand[]
}

export interface ShellHandle {
  focusInput: () => void
  setInputValue: (value: string) => void
  executeCommand: (command: string) => void
}

const buildPrompt = (_os?: string) => '$ '

export const Shell = forwardRef<ShellHandle, ShellProps>(function Shell(
  { sessionId, os, onCommandSubmit, initialCommands = [] },
  ref
) {
  // Initialize lines and history from initialCommands
  const [lines, setLines] = useState<TerminalLine[]>(() => {
    const initialLines: TerminalLine[] = []
    const prompt = buildPrompt(os)

    for (const cmd of initialCommands) {
      // Add input line
      initialLines.push({
        type: 'input',
        content: `${prompt}${cmd.input}`,
        timestamp: new Date(cmd.createdAt),
      })

      // Add output line if exists
      if (cmd.output) {
        initialLines.push({
          type: 'output',
          content: cmd.output,
          timestamp: new Date(cmd.createdAt),
        })
      }
    }

    return initialLines
  })

  const [currentInput, setCurrentInput] = useState('')
  const [history, setHistory] = useState<string[]>(() =>
    initialCommands.map(cmd => cmd.input)
  )
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isExecuting, setIsExecuting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`
  }, [currentInput])

  const prompt = buildPrompt(os)

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return

      // Add input line
      setLines((prev) => [
        ...prev,
        { type: 'input', content: `${prompt}${command}`, timestamp: new Date() },
      ])

      // Add to history
      setHistory((prev) => [...prev, command])
      setHistoryIndex(-1)
      setCurrentInput('')
      setIsExecuting(true)

      // Notify parent (ensures command record exists before streaming)
      let commandId: string | undefined
      if (onCommandSubmit) {
        try {
          const result = await onCommandSubmit(command)
          commandId = typeof result === 'string' ? result : undefined
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to submit command'
          setLines((prev) => [
            ...prev,
            {
              type: 'error',
              content: `Command could not be submitted: ${message}`,
              timestamp: new Date(),
            },
          ])
          setIsExecuting(false)
          return
        }
      }

      try {
        // Connect to SSE stream
        const params = new URLSearchParams({
          id: sessionId,
          cmd: command,
        })

        if (commandId) {
          params.append('commandId', commandId)
        }

        const eventSource = new EventSource(
          `/api/terminal/stream?${params.toString()}`
        )

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data)

          if (data.kind === 'token') {
            setLines((prev) => {
              const last = prev[prev.length - 1]
              if (last && last.type === 'output') {
                // Append to existing output line
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + (data.data.text || '') },
                ]
              } else {
                // Create new output line
                return [
                  ...prev,
                  {
                    type: 'output',
                    content: data.data.text || '',
                    timestamp: new Date(),
                  },
                ]
              }
            })
          } else if (data.kind === 'stderr') {
            const errorPayload = data.data ?? {}
            const errorText =
              typeof errorPayload.text === 'string'
                ? errorPayload.text
                : typeof errorPayload.message === 'string'
                  ? errorPayload.message
                  : 'An error occurred while running the command.'
            setLines((prev) => [
              ...prev,
              {
                type: 'error',
                content: errorText,
                timestamp: new Date(),
              },
            ])
          } else if (data.kind === 'done') {
            eventSource.close()
            setIsExecuting(false)
          } else if (data.kind === 'error') {
            setLines((prev) => [
              ...prev,
              {
                type: 'error',
                content: `Error: ${data.data.message}`,
                timestamp: new Date(),
              },
            ])
            eventSource.close()
            setIsExecuting(false)
          }
        }

        eventSource.onerror = () => {
          setLines((prev) => [
            ...prev,
            {
              type: 'error',
              content: 'Connection error',
              timestamp: new Date(),
            },
          ])
          eventSource.close()
          setIsExecuting(false)
        }
      } catch (error) {
        setLines((prev) => [
          ...prev,
          {
            type: 'error',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          },
        ])
        setIsExecuting(false)
      }
    },
    [onCommandSubmit, prompt, sessionId]
  )

  useImperativeHandle(
    ref,
    () => ({
      focusInput() {
        inputRef.current?.focus()
      },
      setInputValue(value: string) {
        setHistoryIndex(-1)
        setCurrentInput(value)
        requestAnimationFrame(() => {
          const input = inputRef.current
          if (input) {
            const caretPosition = value.length
            input.setSelectionRange(caretPosition, caretPosition)
          }
        })
      },
      executeCommand,
    }),
    [executeCommand]
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isExecuting) {
        executeCommand(currentInput)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex =
          historyIndex === -1
            ? history.length - 1
            : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCurrentInput(history[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= history.length) {
          setHistoryIndex(-1)
          setCurrentInput('')
        } else {
          setHistoryIndex(newIndex)
          setCurrentInput(history[newIndex])
        }
      }
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      setLines([])
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault()
      setIsExecuting(false)
      setCurrentInput('')
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-[#0a0a0a] shadow-[0_0_20px_rgba(255,255,255,0.05)]">
      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="terminal-scroll flex-1 overflow-y-auto p-4 font-mono text-sm"
      >
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              'group relative mb-1 whitespace-pre-wrap break-words font-mono',
              line.type === 'input' && 'text-gray-200',
              line.type === 'output' && 'text-gray-300',
              line.type === 'error' && 'text-red-400'
            )}
          >
            {line.type === 'output' ? (
              <>
                <span className="block whitespace-pre-wrap pr-8">{line.content}</span>
                {line.content && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => copyToClipboard(line.content)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </>
            ) : (
              <span>{line.content}</span>
            )}
          </div>
        ))}
      </div>

      {/* Input prompt */}
      <div className="flex items-center border-t border-border bg-[#0d0d0d] p-4">
        <span className="mr-2 font-mono text-sm text-gray-400">{prompt}</span>
        <textarea
          ref={inputRef}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecuting}
          rows={1}
          className="flex-1 resize-none bg-transparent font-mono text-sm text-gray-200 outline-none placeholder:text-gray-600"
          placeholder={isExecuting ? 'Executing...' : 'Type a command...'}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  )
})
