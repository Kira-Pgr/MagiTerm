type FieldDeltaListener = (payload: {
  field: string
  delta: string
  fullValue: string
}) => void

type FieldCompleteListener = (payload: { field: string; value: string }) => void

enum FieldStage {
  SearchingKey,
  AfterKey,
  WaitingForStringStart,
  Collecting,
  Complete,
}

const WHITESPACE_REGEX = /\s/

export class JsonFieldStreamDecoder {
  private readonly keyPattern: string
  private stage: FieldStage = FieldStage.SearchingKey
  private keyIndex = 0
  private collectingBuffer = ''
  private escapeActive = false
  private unicodeDigitsRemaining = 0
  private lastEmittedLength = 0
  private currentValue = ''

  constructor(
    private readonly field: string,
    private readonly listeners: {
      onDelta?: FieldDeltaListener
      onComplete?: FieldCompleteListener
    } = {}
  ) {
    this.keyPattern = `"${field}"`
  }

  processChunk(chunk: string) {
    if (this.stage === FieldStage.Complete) {
      return
    }

    for (let i = 0; i < chunk.length && this.stage !== FieldStage.Complete; i++) {
      const char = chunk[i]
      switch (this.stage) {
        case FieldStage.SearchingKey:
          this.processKeyChar(char)
          break
        case FieldStage.AfterKey:
          this.processPostKeyChar(char)
          break
        case FieldStage.WaitingForStringStart:
          this.processStringStartChar(char)
          break
        case FieldStage.Collecting:
          this.processValueChar(char)
          break
        case FieldStage.Complete:
        default:
          break
      }
    }
  }

  get value() {
    return this.currentValue
  }

  private processKeyChar(char: string) {
    const expected = this.keyPattern[this.keyIndex]
    if (char === expected) {
      this.keyIndex += 1
      if (this.keyIndex === this.keyPattern.length) {
        this.stage = FieldStage.AfterKey
        this.keyIndex = 0
      }
      return
    }

    this.keyIndex = char === this.keyPattern[0] ? 1 : 0
  }

  private processPostKeyChar(char: string) {
    if (char === ':') {
      this.stage = FieldStage.WaitingForStringStart
      return
    }

    if (WHITESPACE_REGEX.test(char)) {
      return
    }

    this.resetSearchAndReprocess(char)
  }

  private processStringStartChar(char: string) {
    if (WHITESPACE_REGEX.test(char)) {
      return
    }

    if (char === '"') {
      this.stage = FieldStage.Collecting
      this.collectingBuffer = ''
      this.escapeActive = false
      this.unicodeDigitsRemaining = 0
      this.lastEmittedLength = 0
      return
    }

    this.resetSearchAndReprocess(char)
  }

  private processValueChar(char: string) {
    if (this.unicodeDigitsRemaining > 0) {
      this.collectingBuffer += char
      this.unicodeDigitsRemaining -= 1
      if (this.unicodeDigitsRemaining === 0) {
        this.escapeActive = false
        this.emitDelta()
      }
      return
    }

    if (this.escapeActive) {
      this.collectingBuffer += char
      if (char === 'u') {
        this.unicodeDigitsRemaining = 4
      } else {
        this.escapeActive = false
        this.emitDelta()
      }
      return
    }

    if (char === '\\') {
      this.collectingBuffer += char
      this.escapeActive = true
      return
    }

    if (char === '"') {
      this.finalizeValue()
      return
    }

    this.collectingBuffer += char
    this.emitDelta()
  }

  private emitDelta() {
    if (this.collectingBuffer.length === 0) {
      return
    }

    try {
      const decoded = JSON.parse(`"${this.collectingBuffer}"`)
      if (decoded.length > this.lastEmittedLength) {
        const delta = decoded.slice(this.lastEmittedLength)
        this.lastEmittedLength = decoded.length
        this.currentValue = decoded
        this.listeners.onDelta?.({
          field: this.field,
          delta,
          fullValue: decoded,
        })
      }
    } catch {
      // buffer does not yet form a valid JSON string (e.g., dangling escape)
    }
  }

  private finalizeValue() {
    try {
      const decoded = JSON.parse(`"${this.collectingBuffer}"`)
      if (decoded.length > this.lastEmittedLength) {
        const delta = decoded.slice(this.lastEmittedLength)
        this.lastEmittedLength = decoded.length
        this.currentValue = decoded
        if (delta.length > 0) {
          this.listeners.onDelta?.({
            field: this.field,
            delta,
            fullValue: decoded,
          })
        }
      }
      this.listeners.onComplete?.({ field: this.field, value: decoded })
    } catch {
      // ignore parse errors on completion; downstream will rely on final output payload
    } finally {
      this.stage = FieldStage.Complete
      this.collectingBuffer = ''
      this.escapeActive = false
      this.unicodeDigitsRemaining = 0
    }
  }

  private resetSearchAndReprocess(char: string) {
    this.stage = FieldStage.SearchingKey
    this.keyIndex = 0
    this.processKeyChar(char)
  }
}

