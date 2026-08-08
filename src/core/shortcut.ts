export interface ExtensionCommand {
  name?: string
  shortcut?: string
}

/** Returns Chrome's assigned command string without product-local fallback copy. */
export function assignedShortcut(commands: readonly ExtensionCommand[]): string {
  return commands.find((command) => command.name === '_execute_action')?.shortcut?.trim() ?? ''
}
