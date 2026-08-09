import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'textarea:not(:disabled)',
  'select:not(:disabled)',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  initialRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
  restoreFallbackRef?: RefObject<HTMLElement | null>,
  preferFallback = false,
): void {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return
    const root = container.getRootNode()
    const previous = root instanceof ShadowRoot ? root.activeElement : document.activeElement
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
      )

    const initial = initialRef.current ?? focusables()[0]
    initial?.focus()

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const focused = root instanceof ShadowRoot ? root.activeElement : document.activeElement
      if (event.shiftKey && focused === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeydown)
    return () => {
      container.removeEventListener('keydown', handleKeydown)
      if (preferFallback && restoreFallbackRef?.current?.isConnected) {
        restoreFallbackRef.current.focus()
      } else if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !previous.matches(':disabled')
      ) {
        previous.focus()
      } else {
        restoreFallbackRef?.current?.focus()
      }
    }
  }, [active, containerRef, initialRef, restoreFallbackRef, preferFallback])
}
