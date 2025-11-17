import { prisma } from '@/lib/db'

export type CommandHistoryEntry = {
  input: string
  output: string | null
}

const DEFAULT_HISTORY_LIMIT = 10

export async function getCommandHistory(
  sessionId: string,
  limit: number = DEFAULT_HISTORY_LIMIT
) {
  const commands = await prisma.command.findMany({
    where: {
      sessionId,
      output: {
        not: null,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      input: true,
      output: true,
    },
    take: limit,
  })

  return commands.reverse() as CommandHistoryEntry[]
}

