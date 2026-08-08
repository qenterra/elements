/** Splits Chrome's registered command shortcut into visual keycaps. */
export function shortcutKeycaps(shortcut: string | undefined): string[] {
  return (shortcut ?? '')
    .split('+')
    .map((key) => key.trim())
    .filter(Boolean)
}
