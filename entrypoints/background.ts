import { browser, type Browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { hybridStorage } from '../src/core/storage'

const BACKUP_KEY_PATTERN = /^settings$|^web:|^webMeta$/

const ACTION_ICONS = {
  active: { 16: 'icons/action_active_16.png', 32: 'icons/action_active.png' },
  inactive: { 16: 'icons/action_inactive_16.png', 32: 'icons/action_inactive.png' },
  unavailable: { 16: 'icons/action_unavailable_16.png', 32: 'icons/action_unavailable.png' },
} as const

function setIcon(tabId: number, active: boolean): Promise<void> {
  return Promise.all([
    browser.action.setIcon({
      path: active ? ACTION_ICONS.active : ACTION_ICONS.inactive,
      tabId,
    }),
    browser.action.setTitle({ title: 'Elements', tabId }),
  ]).then(() => undefined)
}

async function setUnavailable(tabId: number): Promise<void> {
  await Promise.all([
    browser.action.setIcon({ path: ACTION_ICONS.unavailable, tabId }),
    browser.action.setTitle({ title: 'Elements [unavailable for this tab]', tabId }),
  ])
}

async function activeTab(): Promise<Browser.tabs.Tab | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  return tab?.id !== undefined && tab.id >= 0 ? tab : undefined
}

async function refreshActionState(): Promise<void> {
  const tab = await activeTab()
  if (tab?.id === undefined || tab.id < 0) return

  if (!tab.url?.startsWith('http')) {
    await setUnavailable(tab.id)
    return
  }

  try {
    const active = await browser.tabs.sendMessage(tab.id, { action: 'getStatus' })
    await setIcon(tab.id, Boolean(active))
  } catch {
    await setIcon(tab.id, false)
  }
}

async function toggleActiveTab(): Promise<void> {
  const tab = await activeTab()
  if (tab?.id === undefined || tab.id < 0) return

  try {
    await browser.tabs.sendMessage(tab.id, { action: 'toggle' })
    return
  } catch {
    // Tabs that predate installation may not have a content script yet.
  }

  try {
    await browser.scripting.executeScript({
      files: ['content-scripts/content.js'],
      target: { tabId: tab.id },
    })
    await browser.tabs.sendMessage(tab.id, { action: 'toggle' })
  } catch {
    // Protected browser pages correctly remain unavailable.
  }
}

let metadataWrite: Promise<void> = Promise.resolve()

function updateSiteMetadata(website: string, data: string): Promise<void> {
  // Serializing read-modify-write operations avoids lost updates when two
  // tabs commit edits at nearly the same time.
  metadataWrite = metadataWrite.then(async () => {
    const meta = await hybridStorage.get<Record<string, number>>('webMeta', {})
    if (data === '[]') delete meta[website]
    else meta[website] = Date.now()
    await hybridStorage.set('webMeta', meta)
  })
  return metadataWrite
}

async function exportSettings(): Promise<string> {
  const entries = (await hybridStorage.entries()).filter(([, value]) => value !== '[]')
  return JSON.stringify({ ...Object.fromEntries(entries), version: 1 }, null, 2)
}

async function importSettings(data: string): Promise<'SUCCESS' | string> {
  try {
    const parsed: unknown = JSON.parse(data)
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
      throw new Error('Invalid version in data')
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter(([key]) => BACKUP_KEY_PATTERN.test(key))

    const existingKeys = (await hybridStorage.entries())
      .map(([key]) => key)
      .filter((key) => BACKUP_KEY_PATTERN.test(key))

    await hybridStorage.remove(existingKeys)
    await hybridStorage.setMany(entries)
    return 'SUCCESS'
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown import error'
  }
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(toggleActiveTab)
  browser.tabs.onActivated.addListener(() => void refreshActionState())
  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status === 'complete') void refreshActionState()
  })
  void refreshActionState()

  browser.runtime.onMessage.addListener(async (message: {
    action?: string
    active?: boolean
    website?: string
    data?: string
  }, sender) => {
    switch (message.action) {
      case 'status':
        if (sender.tab?.id !== undefined) await setIcon(sender.tab.id, Boolean(message.active))
        return undefined
      case 'open_options':
        await browser.runtime.openOptionsPage()
        return undefined
      case 'get_saved_elms':
        return hybridStorage.get(`web:${message.website ?? ''}`, '[]')
      case 'set_saved_elms':
        if (!message.website || message.data === undefined) return false
        if (message.data === '[]') await hybridStorage.remove(`web:${message.website}`)
        else await hybridStorage.set(`web:${message.website}`, message.data)
        await updateSiteMetadata(message.website, message.data)
        return true
      case 'get_settings':
        return hybridStorage.get('settings', '{}')
      case 'set_settings':
        await hybridStorage.set('settings', message.data ?? '{}')
        return true
      case 'get_hotkey': {
        const commands = await browser.commands.getAll()
        return commands[0]?.shortcut || 'No key set'
      }
      case 'goto_hotkey_settings':
        await browser.tabs.create({
          active: true,
          url: /Firefox/i.test(navigator.userAgent) ? 'about:addons' : 'chrome://extensions/shortcuts',
        })
        return undefined
      case 'export_settings':
        return exportSettings()
      case 'import_settings':
        return importSettings(message.data ?? '')
      default:
        return undefined
    }
  })
})
