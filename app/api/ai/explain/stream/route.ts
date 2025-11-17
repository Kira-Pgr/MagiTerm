import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { runExplain } from '@/lib/agents'
import { getCommandHistory } from '@/lib/history'
import { JsonFieldStreamDecoder } from '@/lib/ai-streaming'

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

const encoder = new TextEncoder()

const encodeEvent = (payload: unknown) =>
  encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)

const sanitizeConfigValue = (value: string | undefined, fallback: string) => {
  if (!value) return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()
    const { sessionId, os, cpu, gpu, command } = await request.json()

    if (!sessionId || !command) {
      return new Response('Missing sessionId or command', { status: 400 })
    }

    const session = await prisma.terminalSession.findFirst({
      where: { id: sessionId, userId },
      select: { os: true, cpu: true, gpu: true },
    })

    if (!session) {
      return new Response('Session not found', { status: 404 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const history = await getCommandHistory(sessionId)
          let latestExplanation = ''

          const explanationParser = new JsonFieldStreamDecoder('explanation', {
            onDelta: ({ delta, fullValue }) => {
              latestExplanation = fullValue
              controller.enqueue(
                encodeEvent({
                  kind: 'delta',
                  data: { field: 'explanation', text: delta },
                })
              )
            },
          })

          const result = await runExplain({
            os: sanitizeConfigValue(os, session.os),
            cpu: sanitizeConfigValue(cpu, session.cpu),
            gpu: sanitizeConfigValue(gpu, session.gpu),
            command,
            commandHistory: history,
            onStreamChunk: (chunk) => {
              explanationParser.processChunk(chunk)
            },
          })

          const finalPayload = {
            explanation: latestExplanation || result.output.explanation,
            tokensIn: result.usageInputTokens,
            tokensOut: result.usageOutputTokens,
            latencyMs: result.latencyMs,
          }

          controller.enqueue(encodeEvent({ kind: 'result', data: finalPayload }))
          controller.enqueue(encodeEvent({ kind: 'done' }))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          controller.enqueue(encodeEvent({ kind: 'error', data: { message } }))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: STREAM_HEADERS })
  } catch (error) {
    console.error('[explain-stream] error', error)
    return new Response('Internal server error', { status: 500 })
  }
}

