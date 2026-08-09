const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  'summary',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function elementIn(path: readonly EventTarget[], selector: string): boolean {
  return path.some(
    (item) =>
      item instanceof Element &&
      (item.matches(selector) ||
        (item instanceof HTMLElement &&
          (item.isContentEditable || item.contentEditable === 'true'))),
  )
}

export function ownsDocumentShortcut(path: readonly EventTarget[]): boolean {
  const pickerOwned = path.some((item) => {
    if (item instanceof ShadowRoot)
      return (
        item.host instanceof HTMLElement && item.host.hasAttribute('data-elements-extension-root')
      )
    return item instanceof HTMLElement && item.hasAttribute('data-elements-extension-root')
  })
  return !pickerOwned && !elementIn(path, INTERACTIVE_SELECTOR)
}

/** Keyboard-generated clicks use detail 0 and must retain the page's native action. */
export function allowsNativeKeyboardActivation(
  path: readonly EventTarget[],
  detail: number,
): boolean {
  return detail === 0 && elementIn(path, INTERACTIVE_SELECTOR)
}
