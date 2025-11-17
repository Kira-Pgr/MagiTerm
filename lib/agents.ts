import { Agent, RunContext, Runner, user, withTrace } from '@openai/agents'
import { z } from 'zod'
import type { CommandHistoryEntry } from '@/lib/history'
import type { AgentInputItem } from '@openai/agents'

export interface AgentContext {
  os: string
  cpu: string
  gpu: string
}

export interface ExecuteParams extends AgentContext {
  input: string
  commandHistory?: CommandHistoryEntry[]
}

export interface SuggestParams extends AgentContext {
  goal: string
  commandHistory?: CommandHistoryEntry[]
}

export interface ExplainParams extends AgentContext {
  command: string
  commandHistory?: CommandHistoryEntry[]
}

interface MagitermExecuteContext {
  stateOs: string
  stateCpu: string
  stateGpu: string
}

interface MagitermExplainContext {
  stateOs: string
  stateCpu: string
  stateGpu: string
}

interface MagitermSuggestContext {
  stateOs: string
  stateCpu: string
  stateGpu: string
}

const MagitermExecuteSchema = z.object({ output: z.string() })
const MagitermExplainSchema = z.object({ explanation: z.string() })
const MagitermSuggestSchema = z.object({
  command: z.string(),
  explanation: z.string(),
})

const TRACE_METADATA = {
  __trace_source__: 'magiterm',
}

const magitermExecuteInstructions = (
  runContext: RunContext<MagitermExecuteContext>
) => {
  const { stateOs, stateCpu, stateGpu } = runContext.context
  return `You are a terminal simulator of an imaginary system.
System Information:
Hostname: MagiTerm
OS: ${stateOs}
CPU: ${stateCpu}
GPU: ${stateGpu}

Provide only the command output as specified by the user instruction, formatted strictly according to the provided JSON schema.`
}

const magitermExplainInstructions = (
  runContext: RunContext<MagitermExplainContext>
) => {
  const { stateOs, stateCpu, stateGpu } = runContext.context

  return `You are a terminal simulator of an imaginary system.
System Information:
Hostname: MagiTerm
OS: ${stateOs}
CPU: ${stateCpu}
GPU: ${stateGpu}

Explain the command according to the context.`
}

const magitermSuggestInstructions = (
  runContext: RunContext<MagitermSuggestContext>
) => {
  const { stateOs, stateCpu, stateGpu } = runContext.context
  return `You are a terminal simulator of an imaginary system.
System Information:
Hostname: MagiTerm
OS: ${stateOs}
CPU: ${stateCpu}
GPU: ${stateGpu}

Suggest the most appropriate commands to execute based on the user query. 
Only suggest one command. `
}

const executeModel = getExecuteModel()
const magitermExecute = new Agent({
  name: 'MagiTerm: Execute',
  instructions: magitermExecuteInstructions,
  model: executeModel,
  outputType: MagitermExecuteSchema,
  modelSettings: createModelSettings(getExecuteReasoningEnabled(), getExecuteReasoningEffort()),
})

const explainModel = getExplainModel()
const magitermExplain = new Agent({
  name: 'MagiTerm: Explain',
  instructions: magitermExplainInstructions,
  model: explainModel,
  outputType: MagitermExplainSchema,
  modelSettings: createModelSettings(getExplainReasoningEnabled(), getExplainReasoningEffort()),
})

const suggestModel = getSuggestModel()
const magitermSuggest = new Agent({
  name: 'MagiTerm: Suggest',
  instructions: magitermSuggestInstructions,
  model: suggestModel,
  outputType: MagitermSuggestSchema,
  modelSettings: createModelSettings(getSuggestReasoningEnabled(), getSuggestReasoningEffort()),
})

const ensureApiKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }
}

function getExecuteModel() {
  return process.env.AGENT_MODEL_EXECUTE || 'gpt-5.1'
}

function getExplainModel() {
  return process.env.AGENT_MODEL_EXPLAIN || 'gpt-5.1'
}

function getSuggestModel() {
  return process.env.AGENT_MODEL_SUGGEST || 'gpt-5.1'
}

function getExecuteReasoningEnabled() {
  return process.env.AGENT_REASONING_ENABLED_EXECUTE !== 'false'
}

function getExplainReasoningEnabled() {
  return process.env.AGENT_REASONING_ENABLED_EXPLAIN !== 'false'
}

function getSuggestReasoningEnabled() {
  return process.env.AGENT_REASONING_ENABLED_SUGGEST !== 'false'
}

function getExecuteReasoningEffort() {
  return (process.env.AGENT_REASONING_EFFORT_EXECUTE || 'low') as 'low' | 'medium' | 'high'
}

function getExplainReasoningEffort() {
  return (process.env.AGENT_REASONING_EFFORT_EXPLAIN || 'low') as 'low' | 'medium' | 'high'
}

function getSuggestReasoningEffort() {
  return (process.env.AGENT_REASONING_EFFORT_SUGGEST || 'low') as 'low' | 'medium' | 'high'
}

// Create model settings based on reasoning toggle
function createModelSettings(reasoningEnabled: boolean, reasoningEffort: 'low' | 'medium' | 'high') {
  if (reasoningEnabled) {
    return {
      reasoning: {
        effort: reasoningEffort,
        summary: 'auto' as const,
      },
      store: true,
    }
  }

  // For models that don't support reasoning or when reasoning is disabled
  // Balanced settings for consistent yet natural terminal simulation
  return {
    temperature: 0.8,
    topP: 0.9,
    maxTokens: 4096,
    store: true,
  }
}

const createRunner = () =>
  new Runner({
    traceMetadata: TRACE_METADATA,
  })

const HISTORY_PLACEHOLDER = '{command_input_output_history}'
const NO_HISTORY_TEXT = 'No previous commands have been executed in this session.'

const buildContext = (context: AgentContext) => ({
  stateOs: context.os,
  stateCpu: context.cpu,
  stateGpu: context.gpu,
})

const formatCommandHistoryPrompt = (history: CommandHistoryEntry[] | undefined) => {
  if (!history || history.length === 0) {
    return `${HISTORY_PLACEHOLDER}\n${NO_HISTORY_TEXT}`
  }

  const formattedEntries = history
    .map((entry, index) => {
      const output =
        entry.output && entry.output.trim().length > 0 ? entry.output.trimEnd() : '(no output)'
      return `Command ${index + 1}\nInput: ${entry.input}\nOutput:\n${output}`
    })
    .join('\n\n')

  return `${HISTORY_PLACEHOLDER}\n${formattedEntries}`
}

const buildConversationMessages = (
  history: CommandHistoryEntry[] | undefined,
  nextInput: string
): AgentInputItem[] => {
  const messages: AgentInputItem[] = []

  messages.push(user(formatCommandHistoryPrompt(history)))

  messages.push(user(nextInput))
  return messages
}

type ExecuteTokenEvent = {
  kind: 'token'
  data: { text: string }
}

type ExecuteStderrEvent = {
  kind: 'stderr'
  data: { message: string }
}

type ExecuteStatusEvent = {
  kind: 'status'
  data: {
    message: string
    exitCode?: number
    tokensIn?: number
    tokensOut?: number
  }
}

export type ExecuteEvent =
  | ExecuteTokenEvent
  | ExecuteStderrEvent
  | ExecuteStatusEvent

export async function* runExecute(
  params: ExecuteParams
): AsyncGenerator<ExecuteEvent> {
  ensureApiKey()

  yield {
    kind: 'status' as const,
    data: { message: 'Processing command...' },
  }

  try {
    const runner = createRunner()
    const result = await withTrace('magiterm.execute', async () =>
      runner.run(
        magitermExecute,
        buildConversationMessages(params.commandHistory, params.input),
        {
          context: buildContext(params),
        }
      )
    )

    const usage = result.rawResponses.at(-1)?.usage

    const agentOutput = result.finalOutput?.output

    if (agentOutput === undefined || agentOutput === null) {
      throw new Error('Agent result is undefined')
    }

    const rawOutput = agentOutput
    const normalizedOutput =
      rawOutput.length === 0
        ? '\n'
        : rawOutput.endsWith('\n')
          ? rawOutput
          : `${rawOutput}\n`

    if (normalizedOutput.length > 0) {
      yield {
        kind: 'token' as const,
        data: { text: normalizedOutput },
      }
    }

    yield {
      kind: 'status' as const,
      data: {
        message: 'Complete',
        exitCode: 0,
          tokensIn: usage?.inputTokens ?? 0,
          tokensOut: usage?.outputTokens ?? 0,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    yield {
      kind: 'stderr' as const,
      data: { message },
    }
    yield {
      kind: 'status' as const,
      data: { message: 'Failed', exitCode: 1 },
    }
  }
}

type AgentRunResult<TOutput> = {
  output: TOutput
  usageInputTokens: number
  usageOutputTokens: number
  latencyMs: number
}

const createAgentRunResult = <TOutput>(
  finalOutput: TOutput | undefined,
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
  latencyMs: number
): AgentRunResult<TOutput> => {
  if (!finalOutput) {
    throw new Error('Agent result is undefined')
  }

  return {
    output: finalOutput,
    usageInputTokens: usage?.inputTokens ?? 0,
    usageOutputTokens: usage?.outputTokens ?? 0,
    latencyMs,
  }
}

export async function runSuggest(params: SuggestParams) {
  ensureApiKey()
  const runner = createRunner()
  const start = Date.now()

  const result = await withTrace('magiterm.suggest', async () =>
    runner.run(
      magitermSuggest,
      buildConversationMessages(params.commandHistory, params.goal),
      { context: buildContext(params) }
    )
  )

  const usage = result.rawResponses.at(-1)?.usage
  return createAgentRunResult(result.finalOutput, usage, Date.now() - start)
}

export async function runExplain(params: ExplainParams) {
  ensureApiKey()
  const runner = createRunner()
  const start = Date.now()

  const result = await withTrace('magiterm.explain', async () =>
    runner.run(
      magitermExplain,
      buildConversationMessages(params.commandHistory, params.command),
      { context: buildContext(params) }
    )
  )

  const usage = result.rawResponses.at(-1)?.usage
  return createAgentRunResult(result.finalOutput, usage, Date.now() - start)
}
