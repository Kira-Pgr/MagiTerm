'use client'

import { useEffect, useState } from 'react'
import { highlightCode } from '@/lib/highlight'

interface CodeHighlightProps {
  code: string
  lang?: string
  className?: string
  inline?: boolean
}

const stripWrapper = (markup: string) => {
  return markup
    .replace(/^<pre.*?><code.*?>/s, '')
    .replace(/<\/code><\/pre>$/s, '')
}

export function CodeHighlight({
  code,
  lang = 'bash',
  className = '',
  inline = false,
}: CodeHighlightProps) {
  const [html, setHtml] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    highlightCode(code, lang).then((result) => {
      setHtml(result)
      setIsLoading(false)
    })
  }, [code, lang])

  if (inline) {
    if (isLoading) {
      return (
        <code className={`text-sm text-gray-300 ${className}`}>{code}</code>
      )
    }

    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: stripWrapper(html) }}
      />
    )
  }

  return (
    <div className={className}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
