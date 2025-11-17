'use client'

import { useState, type KeyboardEvent } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { CodeHighlight } from './CodeHighlight'
import { Sparkles, Info } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

  // Explain tab state
  const [commandToExplain, setCommandToExplain] = useState('')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isExplaining, setIsExplaining] = useState(false)

  const handleGenerate = async () => {
    if (!goal.trim()) return

    setIsGenerating(true)
    setSuggestion(null)

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation Generate($sessionId: ID!, $os: String!, $cpu: String!, $gpu: String!, $goal: String!) {
              generate(sessionId: $sessionId, os: $os, cpu: $cpu, gpu: $gpu, goal: $goal)
            }
          `,
          variables: { sessionId, os, cpu, gpu, goal },
        }),
      })

      const { data } = await response.json()
      if (data?.generate) {
        setSuggestion(data.generate)
      }
    } catch (error) {
      console.error('Generate error:', error)
    } finally {
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

    setIsExplaining(true)
    setExplanation(null)

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation Explain($sessionId: ID!, $os: String!, $cpu: String!, $gpu: String!, $command: String!) {
              explain(sessionId: $sessionId, os: $os, cpu: $cpu, gpu: $gpu, command: $command)
            }
          `,
          variables: {
            sessionId,
            os,
            cpu,
            gpu,
            command: commandToExplain,
          },
        }),
      })

      const { data } = await response.json()
      if (data?.explain) {
        setExplanation(data.explain.explanation)
      }
    } catch (error) {
      console.error('Explain error:', error)
    } finally {
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
