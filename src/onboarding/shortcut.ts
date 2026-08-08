export type ShortcutPlatform = 'mac' | 'windows' | 'linux' | 'cros' | undefined

const modifierOrder = new Map([
  ['command', 0],
  ['macctrl', 1],
  ['ctrl', 1],
  ['alt', 2],
  ['shift', 3],
])

function displayKey(key: string, platform: ShortcutPlatform): string {
  switch (key.toLowerCase()) {
    case 'command':
      return platform === 'mac' ? '⌘' : 'Command'
    case 'macctrl':
    case 'ctrl':
      return platform === 'mac' ? '⌃' : 'Ctrl'
    case 'alt':
      return platform === 'mac' ? '⌥' : 'Alt'
    case 'shift':
      return platform === 'mac' ? '⇧' : 'Shift'
    default:
      return key.length === 1 ? key.toUpperCase() : key
  }
}

/** Canonicalizes Chrome's registered command shortcut for QDS keycap presentation. */
export function shortcutKeycaps(
  shortcut: string | undefined,
  platform: ShortcutPlatform = undefined,
): string[] {
  return (shortcut ?? '')
    .split('+')
    .map((key) => key.trim())
    .filter(Boolean)
    .sort((left, right) => {
      const leftOrder = modifierOrder.get(left.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = modifierOrder.get(right.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
      return leftOrder - rightOrder
    })
    .map((key) => displayKey(key, platform))
}
