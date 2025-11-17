import { codeToHtml } from 'shiki'

export async function highlightCode(code: string, lang: string = 'bash') {
  try {
    const html = await codeToHtml(code, {
      lang,
      theme: 'github-dark-dimmed',
    })
    return html
  } catch {
    // Fallback to plain code
    return `<pre><code>${code}</code></pre>`
  }
}
