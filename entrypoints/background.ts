import { browser, type Browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { hybridStorage } from '../src/core/storage'

const BACKUP_KEY_PATTERN = /^settings$|^web:|^webMeta$|^webPaused$/

const ACTION_ICONS = {
  active: { 16: 'icons/action_active_16.png', 32: 'icons/action_active.png' },
  inactive: { 16: 'icons/action_inactive_16.png', 32: 'icons/action_inactive.png' },
  unavailable: { 16: 'icons/action_unavailable_16.png', 32: 'icons/action_unavailable.png' },
} as const

const BADGE_COLOR = '#22d3ee'
const BADGE_COLOR_PAUSED = '#8991a1'

function getLocalizedMessage(key: string, fallback: string): string {
  const i18n = browser.i18n as unknown as { getMessage: (name: string) => string }
  return i18n.getMessage(key) || fallback
}

function siteKeyFromUrl(url: string | undefined): string | null {
  if (!url?.startsWith('http')) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function getPausedSites(): Promise<string[]> {
  const paused = parseJson<unknown>(await hybridStorage.get('webPaused', '[]'), [])
  return Array.isArray(paused) ? paused.filter((site): site is string => typeof site === 'string') : []
}

async function setPausedSite(website: string, paused: boolean): Promise<void> {
  const sites = new Set(await getPausedSites())
  if (paused) sites.add(website)
  else sites.delete(website)
  if (sites.size) await hybridStorage.set('webPaused', JSON.stringify([...sites]))
  else await hybridStorage.remove('webPaused')
}

async function setBadge(tabId: number, count: number, paused: boolean): Promise<void> {
  try {
    await browser.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' })
    await browser.action.setBadgeBackgroundColor({ tabId, color: paused ? BADGE_COLOR_PAUSED : BADGE_COLOR })
    const action = browser.action as unknown as { setBadgeTextColor?: (details: { tabId: number; color: string }) => Promise<void> }
    await action.setBadgeTextColor?.({ tabId, color: '#0f1013' })
  } catch {
    // A tab can disappear between the event and the badge update.
  }
}

async function refreshBadgeFromStorage(tabId: number, url: string | undefined): Promise<void> {
  const site = siteKeyFromUrl(url)
  if (!site) {
    await setBadge(tabId, 0, false)
    return
  }
  const rules = parseJson<unknown[]>(await hybridStorage.get(`web:${site}`, '[]'), [])
  const paused = (await getPausedSites()).includes(site)
  await setBadge(tabId, Array.isArray(rules) ? rules.length : 0, paused)
}

function setIcon(tabId: number, active: boolean): Promise<void> {
  return Promise.all([
    browser.action.setIcon({
      path: active ? ACTION_ICONS.active : ACTION_ICONS.inactive,
      tabId,
    }),
    browser.action.setTitle({ title: getLocalizedMessage('extensionName', 'Elements'), tabId }),
  ]).then(() => undefined)
}

async function setUnavailable(tabId: number): Promise<void> {
  await Promise.all([
    browser.action.setIcon({ path: ACTION_ICONS.unavailable, tabId }),
    browser.action.setTitle({ title: getLocalizedMessage('backgroundUnavailable', 'Elements — unavailable on this tab'), tabId }),
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

  await refreshBadgeFromStorage(tab.id, tab.url)
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

function mergeRuleLists(existingRaw: unknown, incomingRaw: unknown): string {
  const asList = (value: unknown): Array<Record<string, unknown>> => {
    const parsed = parseJson<unknown>(value, [])
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []
  }
  const ruleKey = (rule: Record<string, unknown>) => `${String(rule.action ?? 'hide')}:${String(rule.selector ?? '')}`

  const incoming = asList(incomingRaw)
  const incomingKeys = new Set(incoming.map(ruleKey))
  const kept = asList(existingRaw).filter((rule) => !incomingKeys.has(ruleKey(rule)))
  return JSON.stringify([...kept, ...incoming])
}

async function importSettings(data: string, mode: 'replace' | 'merge'): Promise<'SUCCESS' | string> {
  try {
    const parsed: unknown = JSON.parse(data)
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
      throw new Error('Invalid version in data')
    }

    const incoming = Object.entries(parsed as Record<string, unknown>)
      .filter(([key]) => BACKUP_KEY_PATTERN.test(key))

    if (mode === 'replace') {
      const existingKeys = (await hybridStorage.entries())
        .map(([key]) => key)
        .filter((key) => BACKUP_KEY_PATTERN.test(key))
      await hybridStorage.remove(existingKeys)
      await hybridStorage.setMany(incoming)
      return 'SUCCESS'
    }

    const existing = new Map((await hybridStorage.entries()).filter(([key]) => BACKUP_KEY_PATTERN.test(key)))
    const merged: Array<[string, unknown]> = []
    for (const [key, value] of incoming) {
      if (key.startsWith('web:')) {
        merged.push([key, mergeRuleLists(existing.get(key), value)])
      } else if (key === 'webMeta') {
        const current = existing.get('webMeta')
        const currentMeta = current && typeof current === 'object' ? current as Record<string, unknown> : {}
        const incomingMeta = value && typeof value === 'object' ? value as Record<string, unknown> : {}
        merged.push([key, { ...currentMeta, ...incomingMeta }])
      } else if (key === 'webPaused') {
        const currentPaused = parseJson<unknown>(existing.get('webPaused'), [])
        const incomingPaused = parseJson<unknown>(value, [])
        const union = new Set([
          ...(Array.isArray(currentPaused) ? currentPaused : []),
          ...(Array.isArray(incomingPaused) ? incomingPaused : []),
        ])
        merged.push([key, JSON.stringify([...union])])
      } else if (key === 'settings' && !existing.has('settings')) {
        merged.push([key, value])
      }
    }
    await hybridStorage.setMany(merged)
    return 'SUCCESS'
  } catch (error) {
    return error instanceof Error ? error.message : 'IMPORT_FAILED'
  }
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(toggleActiveTab)
  browser.tabs.onActivated.addListener(() => void refreshActionState())
  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status === 'complete') void refreshActionState()
  })
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      // A relative URL resolves against the extension origin.
      void browser.tabs.create({ url: '/onboarding.html' })
    }
  })
  void refreshActionState()

  async function handleMessage(message: {
    action?: string
    active?: boolean
    website?: string
    data?: string
    mode?: string
    count?: number
    paused?: boolean
  }, sender: Browser.runtime.MessageSender): Promise<unknown> {
    switch (message.action) {
      case 'status':
        if (sender.tab?.id !== undefined) await setIcon(sender.tab.id, Boolean(message.active))
        return undefined
      case 'badge':
        if (sender.tab?.id !== undefined) {
          await setBadge(sender.tab.id, message.count ?? 0, Boolean(message.paused))
        }
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
      case 'get_paused':
        return message.website ? (await getPausedSites()).includes(message.website) : false
      case 'set_paused':
        if (!message.website) return false
        await setPausedSite(message.website, message.data === 'true')
        return true
      case 'get_hotkey': {
        const commands = await browser.commands.getAll()
        return commands[0]?.shortcut || getLocalizedMessage('pickerNoShortcut', 'No shortcut set')
      }
      case 'goto_hotkey_settings':
        await browser.tabs.create({
          active: true,
          url: /Firefox/i.test(navigator.userAgent) ? 'about:addons' : 'chrome://extensions/shortcuts',
        })
        return undefined
      case 'import_settings':
        return importSettings(message.data ?? '', message.mode === 'merge' ? 'merge' : 'replace')
      default:
        return undefined
    }
  }

  // Native Chrome ignores a Promise returned from an onMessage listener, so
  // responses must go through sendResponse with the channel kept open.
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handleMessage(message as Parameters<typeof handleMessage>[0], sender)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse(undefined))
    return true
  })
})
