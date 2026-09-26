const HTML_TAG = /<(p|div|br|h[1-3]|ul|ol|li|strong|b|em|i|u|s|blockquote|pre|code|span|mark|hr)\b/i
const DROP = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'LINK',
  'META',
  'IMG',
  'VIDEO',
  'AUDIO',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT',
  'SVG',
])
const ALLOWED = new Set([
  'P',
  'BR',
  'DIV',
  'SPAN',
  'H1',
  'H2',
  'H3',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'STRIKE',
  'DEL',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'CODE',
  'A',
  'HR',
  'MARK',
])

export function looksLikeHtml(body: string): boolean {
  return HTML_TAG.test(body)
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function toEditorHtml(body: string): string {
  const raw = String(body ?? '').replace(/\r\n/g, '\n')
  if (!raw.trim()) return '<p><br></p>'
  if (looksLikeHtml(raw)) return sanitizeNoteHtml(raw) || '<p><br></p>'
  return raw
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function notePlainText(body: string): string {
  if (!body) return ''
  return body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function plainPreview(body: string, max = 88): string {
  const text = notePlainText(body).replace(/\s+/g, ' ')
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export function countWords(body: string): { words: number; chars: number } {
  const text = notePlainText(body)
  if (!text) return { words: 0, chars: 0 }
  return { words: text.split(/\s+/).length, chars: text.length }
}

function scrubAttrs(el: Element) {
  const tag = el.tagName
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on') || name === 'srcdoc' || name === 'srcset' || name === 'src') {
      el.removeAttribute(attr.name)
      continue
    }
    if (tag === 'A') {
      if (name === 'href') {
        const href = attr.value.trim()
        if (!/^(https?:|mailto:|#)/i.test(href)) el.removeAttribute('href')
        else el.setAttribute('rel', 'noopener noreferrer')
      } else if (name !== 'rel') {
        el.removeAttribute(attr.name)
      }
      continue
    }
    if (tag === 'UL' && name === 'class') {
      el.setAttribute('class', /\bnote-check\b/.test(attr.value) ? 'note-check' : '')
      if (!el.getAttribute('class')) el.removeAttribute('class')
      continue
    }
    if (tag === 'LI' && name === 'data-check') {
      el.setAttribute('data-check', attr.value === '1' ? '1' : '0')
      continue
    }
    if ((tag === 'SPAN' || tag === 'MARK') && name === 'style') {
      const bg = attr.value.match(/background(?:-color)?\s*:\s*([^;]+)/i)
      if (bg) el.setAttribute('style', `background:${bg[1]!.trim()}`)
      else el.removeAttribute('style')
      continue
    }
    el.removeAttribute(attr.name)
  }
}

function cleanEl(el: Element) {
  for (const child of [...el.children]) {
    const tag = child.tagName
    if (DROP.has(tag)) {
      child.remove()
      continue
    }
    cleanEl(child)
    if (!ALLOWED.has(tag)) {
      child.replaceWith(...child.childNodes)
      continue
    }
    scrubAttrs(child)
  }
}

function stripDangerous(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

export function sanitizeNoteHtml(html: string): string {
  const stripped = stripDangerous(html)
  if (typeof DOMParser === 'undefined') return stripped
  const doc = new DOMParser().parseFromString(`<div>${stripped}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  cleanEl(root)
  return root.innerHTML
}

export function stampNow(): string {
  const d = new Date()
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
}
