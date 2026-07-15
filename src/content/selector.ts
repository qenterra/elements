function escapeIdentifier(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)
}

function isUnique(selector: string, element: Element): boolean {
  try {
    const matches = document.querySelectorAll(selector)
    return matches.length === 1 && matches[0] === element
  } catch {
    return false
  }
}

function nthChild(element: Element): number {
  let index = 1
  let sibling = element.previousElementSibling
  while (sibling) {
    index += 1
    sibling = sibling.previousElementSibling
  }
  return index
}

/** Return the first short selector that uniquely identifies the element. */
export function getUniqueSelector(element: Element): string | null {
  if (element.tagName === 'BODY') return 'body'
  if (element.tagName === 'HTML') return 'html'

  const id = element.getAttribute('id')
  if (id && isUnique(`#${escapeIdentifier(id)}`, element)) return `#${escapeIdentifier(id)}`

  const parts: string[] = []
  let current: Element | null = element

  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase()
    const classes = Array.from(current.classList)
      .filter((name) => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(name))
      .slice(0, 2)
      .map(escapeIdentifier)
    const classPart = classes.length ? `.${classes.join('.')}` : ''
    const candidate = `${tag}${classPart}`
    parts.unshift(candidate)

    const selector = parts.join(' > ')
    if (isUnique(selector, element)) return selector

    const indexed = `${tag}${classPart}:nth-child(${nthChild(current)})`
    parts[0] = indexed
    if (isUnique(parts.join(' > '), element)) return parts.join(' > ')

    current = current.parentElement
  }

  const fallback = parts.join(' > ')
  return fallback && isUnique(fallback, element) ? fallback : null
}

export function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector)
    return true
  } catch {
    return false
  }
}
