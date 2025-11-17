'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

const sequences = [
  {
    command: '> boot --os=shakespearean',
    response: '[Booting... "To boot, or not to boot, that is the query..."]',
  },
  {
    command: '> lshw --cpu_type=quantum --cores=4096',
    response: '[...Simulating 4096-qubit processor...]',
  },
  {
    command: '> connect --host=dream.server --user=oneironaut',
    response: '[...Connected. Welcome to the collective unconscious.]',
  },
  {
    command: '> make --target=coffee',
    response: "[Error: No 'beans' found in /dev/kitchen. (Yet.)]",
  },
]

type Phase = 'command' | 'response' | 'idle'

export function HeroTerminal({ className }: { className?: string }) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('command')
  const [commandText, setCommandText] = useState('')
  const [responseText, setResponseText] = useState('')

  const currentSequence = useMemo(() => sequences[index], [index])

  useEffect(() => {
    let commandInterval: ReturnType<typeof setInterval> | undefined
    let responseInterval: ReturnType<typeof setInterval> | undefined
    let responseTimeout: ReturnType<typeof setTimeout> | undefined
    let nextTimeout: ReturnType<typeof setTimeout> | undefined

    setCommandText('')
    setResponseText('')
    setPhase('command')

    let commandPointer = 0
    let responsePointer = 0

    const typeCommand = () => {
      commandInterval = setInterval(() => {
        commandPointer += 1
        setCommandText(currentSequence.command.slice(0, commandPointer))

        if (commandPointer >= currentSequence.command.length) {
          if (commandInterval) clearInterval(commandInterval)
          setPhase('idle')
          responseTimeout = setTimeout(() => {
            setPhase('response')
            typeResponse()
          }, 500)
        }
      }, 45)
    }

    const typeResponse = () => {
      responseInterval = setInterval(() => {
        responsePointer += 1
        setResponseText(currentSequence.response.slice(0, responsePointer))

        if (responsePointer >= currentSequence.response.length) {
          if (responseInterval) clearInterval(responseInterval)
          setPhase('idle')
          nextTimeout = setTimeout(() => {
            setIndex((prev) => (prev + 1) % sequences.length)
          }, 1200)
        }
      }, 35)
    }

    typeCommand()

    return () => {
      if (commandInterval) clearInterval(commandInterval)
      if (responseInterval) clearInterval(responseInterval)
      if (responseTimeout) clearTimeout(responseTimeout)
      if (nextTimeout) clearTimeout(nextTimeout)
    }
  }, [currentSequence])

  const showCommandCursor =
    phase === 'command' && commandText.length < currentSequence.command.length
  const showResponseCursor =
    phase === 'response' && responseText.length < currentSequence.response.length

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_rgba(2,6,23,0.95))] shadow-[0_20px_60px_rgba(15,23,42,0.7)] backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-white/60">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-4">MagiTerm Shell</span>
      </div>
      <div className="space-y-4 px-5 py-6 font-mono text-sm text-white">
        <p className="text-lime-200">
          {commandText}
          {showCommandCursor && (
            <span className="ml-1 inline-block animate-pulse text-white">▌</span>
          )}
        </p>
        <p className="text-cyan-200/90">
          {responseText}
          {showResponseCursor && (
            <span className="ml-1 inline-block animate-pulse text-white">▌</span>
          )}
        </p>
      </div>
    </div>
  )
}


