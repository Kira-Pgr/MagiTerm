import type { Prisma, TerminalSession } from '@prisma/client'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { runExecute } from '@/lib/agents'
import type { ExecuteEvent } from '@/lib/agents'
import { getCommandHistory } from '@/lib/history'

type PersistedEvent = {
  sessionId: string
  kind: ExecuteEvent['kind']
  data: Prisma.JsonValue
}

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

const encoder = new TextEncoder()

const appendErrorText = (buffer: string, payload: unknown) => {
  let text = ''
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof (payload as { message?: string }).message === 'string'
  ) {
    text = payload.message
  } else if (
    payload &&
    typeof payload === 'object' &&
    'text' in payload &&
    typeof (payload as { text?: string }).text === 'string'
  ) {
    text = payload.text
  } else if (typeof payload === 'string') {
    text = payload
  }

  if (!text) {
    return buffer
  }

  return buffer ? `${buffer}\n${text}` : text
}

async function finalizeCommandRecord(
  commandId: string,
  output: string | null,
  latencyMs: number,
  tokensIn: number,
  tokensOut: number
) {
  try {
    await prisma.command.update({
      where: { id: commandId },
      data: {
        output,
        latencyMs,
        tokensIn,
        tokensOut,
      },
    })
  } catch (error) {
    console.error('Failed to finalize command output', error)
  }
}

function createExecuteStream({
  session,
  sessionId,
  input,
  commandId,
}: {
  session: Pick<TerminalSession, 'os' | 'cpu' | 'gpu'>
  sessionId: string
  input: string
  commandId: string
}) {
  return new ReadableStream({
    async start(controller) {
      const startTime = Date.now()
      let outputBuffer = ''
      let errorBuffer = ''
      let tokensIn = 0
      let tokensOut = 0
      let encounteredError = false
      const eventBatch: PersistedEvent[] = []
      let lastFlush = Date.now()

      const flushEvents = async () => {
        if (eventBatch.length === 0) return
        try {
          await prisma.terminalEvent.createMany({
            data: eventBatch.splice(0),
          })
        } catch (error) {
          console.error('Failed to persist terminal events', error)
        }
      }

      const finalize = async () => {
        const latencyMs = Date.now() - startTime
        let finalOutput: string | null = null

        if (outputBuffer.length > 0) {
          finalOutput = outputBuffer
        } else if (encounteredError && errorBuffer.length > 0) {
          finalOutput = `Error: ${errorBuffer}`.trim()
        }

        await finalizeCommandRecord(
          commandId,
          finalOutput,
          latencyMs,
          tokensIn,
          tokensOut
        )
      }

      try {
        const commandHistory = await getCommandHistory(sessionId)
        const generator = runExecute({
          os: session.os,
          cpu: session.cpu,
          gpu: session.gpu,
          input,
          commandHistory,
        })

        for await (const event of generator) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

          eventBatch.push({
            sessionId,
            kind: event.kind,
            data: event.data as Prisma.JsonValue,
          })

          if (event.kind === 'token') {
            outputBuffer += event.data.text || ''
          } else if (event.kind === 'stderr') {
            encounteredError = true
            errorBuffer = appendErrorText(errorBuffer, event.data)
          } else if (event.kind === 'status') {
            if (typeof event.data.tokensIn === 'number') {
              tokensIn = event.data.tokensIn
            }
            if (typeof event.data.tokensOut === 'number') {
              tokensOut = event.data.tokensOut
            }
            if (typeof event.data.exitCode === 'number' && event.data.exitCode !== 0) {
              encounteredError = true
            }
          }

          const now = Date.now()
          if (now - lastFlush > 200) {
            await flushEvents()
            lastFlush = now
          }
        }

        await flushEvents()
        await finalize()

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ kind: 'done' })}\n\n`))
      } catch (error) {
        encounteredError = true
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errorBuffer = appendErrorText(errorBuffer, errorMsg)

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ kind: 'error', data: { message: errorMsg } })}\n\n`
          )
        )

        await flushEvents()
        await finalize()
      } finally {
        controller.close()
      }
    },
  })
}

async function ensureCommandRecord({
  sessionId,
  input,
  commandId,
}: {
  sessionId: string
  input: string
  commandId?: string | null
}) {
  if (commandId) {
    const existingById = await prisma.command.findFirst({
      where: { id: commandId, sessionId },
    })
    if (existingById) {
      return existingById
    }
  }

  const existingByInput = await prisma.command.findFirst({
    where: { sessionId, input },
    orderBy: { createdAt: 'desc' },
  })

  if (existingByInput) {
    return existingByInput
  }

  return prisma.command.create({
    data: {
      sessionId,
      input,
    },
  })
}

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth()
    const { searchParams } = new URL(request.url)

    const sessionId = searchParams.get('id')
    const input = searchParams.get('cmd')
    const commandIdParam = searchParams.get('commandId')

    if (!sessionId || !input) {
      return new Response('Missing sessionId or cmd', { status: 400 })
    }

    // Verify session ownership
    const session = await prisma.terminalSession.findFirst({
      where: { id: sessionId, userId },
    })

    if (!session) {
      return new Response('Session not found', { status: 404 })
    }

    // Ensure command exists so we can persist output later
    const command = await ensureCommandRecord({
      sessionId,
      input,
      commandId: commandIdParam,
    })
    const stream = createExecuteStream({
      session,
      sessionId,
      input,
      commandId: command.id,
    })

    return new Response(stream, {
      headers: STREAM_HEADERS,
    })
  } catch (error) {
    console.error('SSE stream error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()
    const body = await request.json()

    const { sessionId, input, commandId: commandIdParam } = body

    if (!sessionId || !input) {
      return new Response('Missing sessionId or input', { status: 400 })
    }

    // Verify session ownership
    const session = await prisma.terminalSession.findFirst({
      where: { id: sessionId, userId },
    })

    if (!session) {
      return new Response('Session not found', { status: 404 })
    }

    const command = await ensureCommandRecord({
      sessionId,
      input,
      commandId: commandIdParam,
    })
    const stream = createExecuteStream({
      session,
      sessionId,
      input,
      commandId: command.id,
    })

    return new Response(stream, {
      headers: STREAM_HEADERS,
    })
  } catch (error) {
    console.error('SSE stream error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
