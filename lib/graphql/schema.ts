import type {
  Command as CommandModel,
  TerminalEvent,
  TerminalSession,
  UserProfile as UserProfileModel,
} from '@prisma/client'
import { createSchema } from 'graphql-yoga'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { runSuggest, runExplain } from '@/lib/agents'
import { getCommandHistory } from '@/lib/history'

const typeDefs = /* GraphQL */ `
  scalar DateTime
  scalar JSON

  interface Node {
    id: ID!
  }

  type UserProfile implements Node {
    id: ID!
    userId: String!
    createdAt: DateTime!
    sessions: [Session!]!
  }

  type Session implements Node {
    id: ID!
    userId: String!
    os: String!
    title: String!
    seed: Int!
    cpu: String!
    gpu: String!
    cwd: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    commands: [Command!]!
    events: [SessionEvent!]!
  }

  type Command implements Node {
    id: ID!
    sessionId: String!
    input: String!
    output: String
    tokensIn: Int!
    tokensOut: Int!
    latencyMs: Int!
    createdAt: DateTime!
    session: Session!
  }

  type SessionEvent implements Node {
    id: ID!
    sessionId: String!
    kind: String!
    data: JSON!
    ts: DateTime!
    session: Session!
  }

  type Query {
    session(id: ID!): Session
    me: UserProfile
    node(id: ID!): Node
  }

  type Mutation {
    createSession(
      os: String!
      title: String
      seed: Int
      cpu: String
      gpu: String
      cwd: String
    ): Session!

    runCommand(sessionId: ID!, input: String!): Command!

    generate(sessionId: ID!, os: String!, cpu: String!, gpu: String!, goal: String!): JSON!

    explain(sessionId: ID!, os: String!, cpu: String!, gpu: String!, command: String!): JSON!
  }
`

type CreateSessionArgs = {
  os: string
  title?: string
  seed?: number
  cpu?: string
  gpu?: string
  cwd?: string
}

type GenerateArgs = {
  sessionId: string
  os: string
  cpu: string
  gpu: string
  goal: string
}

type ExplainArgs = {
  sessionId: string
  os: string
  cpu: string
  gpu: string
  command: string
}

const sanitizeConfigValue = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

const resolvers = {
  Query: {
    async session(_parent: unknown, { id }: { id: string }) {
      const userId = await requireAuth()
      return prisma.terminalSession.findFirst({
        where: { id, userId },
      })
    },
    async me() {
      const userId = await requireAuth()
      return prisma.userProfile.findUnique({
        where: { userId },
      })
    },
    async node(_parent: unknown, { id }: { id: string }) {
      // Simple Node resolver - can be enhanced
      const userId = await requireAuth()

      // Try to find as session
      const session = await prisma.terminalSession.findFirst({
        where: { id, userId },
      })
      if (session) return { ...session, __typename: 'Session' as const }

      // Try to find as command
      const command = await prisma.command.findFirst({
        where: {
          id,
          session: { userId },
        },
      })
      if (command) return { ...command, __typename: 'Command' as const }

      return null
    },
  },
  Mutation: {
    async createSession(_parent: unknown, args: CreateSessionArgs) {
      const userId = await requireAuth()

      const os = sanitizeConfigValue(args.os, 'ubuntu')
      const cpu = sanitizeConfigValue(args.cpu, 'Intel Xeon Silver')
      const gpu = sanitizeConfigValue(args.gpu, 'NVIDIA RTX 4090')

      return prisma.terminalSession.create({
        data: {
          userId,
          os,
          title: args.title || 'New Session',
          seed: args.seed || 0,
          cpu,
          gpu,
          cwd: args.cwd || '/',
        },
      })
    },
    async runCommand(
      _parent: unknown,
      { sessionId, input }: { sessionId: string; input: string }
    ) {
      const userId = await requireAuth()

      // Verify session ownership
      const session = await prisma.terminalSession.findFirst({
        where: { id: sessionId, userId },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      // Create command record (output will be filled by SSE stream)
      return prisma.command.create({
        data: {
          sessionId,
          input,
        },
      })
    },
    async generate(_parent: unknown, args: GenerateArgs) {
      const userId = await requireAuth()

      const session = await prisma.terminalSession.findFirst({
        where: { id: args.sessionId, userId },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      const history = await getCommandHistory(args.sessionId)

      const result = await runSuggest({
        os: sanitizeConfigValue(args.os, session.os),
        cpu: sanitizeConfigValue(args.cpu, session.cpu),
        gpu: sanitizeConfigValue(args.gpu, session.gpu),
        goal: args.goal,
        commandHistory: history,
      })

      return result.output
    },
    async explain(_parent: unknown, args: ExplainArgs) {
      const userId = await requireAuth()

      const session = await prisma.terminalSession.findFirst({
        where: { id: args.sessionId, userId },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      const history = await getCommandHistory(args.sessionId)

      const result = await runExplain({
        os: sanitizeConfigValue(args.os, session.os),
        cpu: sanitizeConfigValue(args.cpu, session.cpu),
        gpu: sanitizeConfigValue(args.gpu, session.gpu),
        command: args.command,
        commandHistory: history,
      })

      return result.output
    },
  },
  Session: {
    async commands(parent: TerminalSession) {
      return prisma.command.findMany({
        where: { sessionId: parent.id },
        orderBy: { createdAt: 'asc' },
      })
    },
    async events(parent: TerminalSession) {
      return prisma.terminalEvent.findMany({
        where: { sessionId: parent.id },
        orderBy: { ts: 'asc' },
      })
    },
  },
  Command: {
    async session(parent: CommandModel) {
      return prisma.terminalSession.findUnique({
        where: { id: parent.sessionId },
      })
    },
  },
  SessionEvent: {
    async session(parent: TerminalEvent) {
      return prisma.terminalSession.findUnique({
        where: { id: parent.sessionId },
      })
    },
  },
  UserProfile: {
    async sessions(parent: UserProfileModel) {
      return prisma.terminalSession.findMany({
        where: { userId: parent.userId },
        orderBy: { createdAt: 'desc' },
      })
    },
  },
}

export const schema = createSchema({
  typeDefs,
  resolvers,
})
