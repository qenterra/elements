import { browser, type Browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { migratePersistedEdits, normalizeSettings } from '../src/core/model'
import {
  PROTOCOL_VERSION,
  isExtensionRequest,
  type ContentCommand,
  type ExtensionRequest,
  type ProtocolResult,
} from '../src/core/protocol'
import { RuleRepository, repositoryErrorCode } from '../src/core/repository'
import { siteKeyFromUrl } from '../src/core/site'
import { hybridStorage } from '../src/core/storage'

const ACTION_ICONS = {
  active: { 16: 'icons/action_active_16.png', 32: 'icons/action_active.png' },
  inactive: { 16: 'icons/action_inactive_16.png', 32: 'icons/action_inactive.png' },
  unavailable: { 16: 'icons/action_unavailable_16.png', 32: 'icons/action_unavailable.png' },
} as const

const BADGE_COLOR = '#22d3ee'
const BADGE_COLOR_PAUSED = '#8991a1'
const repository = new RuleRepository(hybridStorage)

function getLocalizedMessage(key: string, fallback: string): string {
  const i18n = browser.i18n as unknown as { getMessage: (name: string) => string }
  return i18n.getMessage(key) || fallback
}

function ok<T>(data: T): ProtocolResult<T> {
  return { ok: true, data }
}

function failure(error: string): ProtocolResult<never> {
  return { ok: false, error }
}

type ContentCommandBody = ContentCommand extends infer Command
  ? Command extends { v: 2 }
    ? Omit<Command, 'v'>
    : never
  : never

function contentCommand(command: ContentCommandBody): ContentCommand {
  return { ...command, v: PROTOCOL_VERSION } as ContentCommand
}

async function getHotkey(): Promise<string> {
  try {
    const commands = await browser.commands.getAll()
    return (
      commands.find((command) => command.name === '_execute_action')?.shortcut ||
      getLocalizedMessage('pickerNoShortcut', 'No shortcut set')
    )
  } catch {
    return getLocalizedMessage('pickerNoShortcut', 'No shortcut set')
  }
}

async function setBadge(tabId: number, count: number, paused: boolean): Promise<void> {
  try {
    await browser.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' })
    await browser.action.setBadgeBackgroundColor({
      tabId,
      color: paused ? BADGE_COLOR_PAUSED : BADGE_COLOR,
    })
    const action = browser.action as unknown as {
      setBadgeTextColor?: (details: { tabId: number; color: string }) => Promise<void>
    }
    await action.setBadgeTextColor?.({ tabId, color: '#0f1013' })
  } catch {
    // A tab can disappear between the event and the badge update.
  }
}

async function refreshBadgeFromStorage(tabId: number, url: string | undefined): Promise<void> {
  const site = url ? siteKeyFromUrl(url) : null
  if (!site) {
    await setBadge(tabId, 0, false)
    return
  }
  const snapshot = await repository.getSiteSnapshot(site)
  await setBadge(tabId, snapshot.rules.length, snapshot.paused)
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
    browser.action.setTitle({
      title: getLocalizedMessage('backgroundUnavailable', 'Elements — unavailable on this tab'),
      tabId,
    }),
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

  if (!tab.url || !siteKeyFromUrl(tab.url)) {
    await setUnavailable(tab.id)
    return
  }

  await refreshBadgeFromStorage(tab.id, tab.url)
  try {
    const active = await browser.tabs.sendMessage(
      tab.id,
      contentCommand({ type: 'picker.getStatus' }),
    )
    await setIcon(tab.id, Boolean(active))
  } catch {
    await setIcon(tab.id, false)
  }
}

async function toggleActiveTab(): Promise<void> {
  const tab = await activeTab()
  if (tab?.id === undefined || tab.id < 0 || !tab.url || !siteKeyFromUrl(tab.url)) return

  try {
    await browser.tabs.sendMessage(tab.id, contentCommand({ type: 'picker.toggle' }))
    return
  } catch {
    // Tabs that predate installation may not have a content script yet.
  }

  try {
    await browser.scripting.executeScript({
      files: ['content-scripts/content.js'],
      target: { tabId: tab.id },
    })
    await browser.tabs.sendMessage(tab.id, contentCommand({ type: 'picker.toggle' }))
  } catch {
    await setUnavailable(tab.id)
  }
}

async function broadcastSiteChange(site?: string, origin?: string): Promise<void> {
  const tabs = await browser.tabs.query({})
  await Promise.allSettled(
    tabs.flatMap((tab): Array<Promise<unknown>> => {
      if (tab.id === undefined || tab.id < 0 || !tab.url) return []
      const tabSite = siteKeyFromUrl(tab.url)
      if (!tabSite || (site && tabSite !== site)) return []
      return [
        browser.tabs.sendMessage(
          tab.id,
          contentCommand({
            type: 'site.changed',
            site: tabSite,
            ...(origin ? { origin } : {}),
          }),
        ),
        refreshBadgeFromStorage(tab.id, tab.url),
      ]
    }),
  )
}

async function handleRequest(
  request: ExtensionRequest,
  sender: Browser.runtime.MessageSender,
): Promise<ProtocolResult<unknown>> {
  const incognito = sender.tab?.incognito === true
  try {
    switch (request.type) {
      case 'picker.status':
        if (sender.tab?.id !== undefined) await setIcon(sender.tab.id, request.active)
        return ok(undefined)
      case 'picker.ui.load':
        if (sender.tab?.id === undefined) return failure('TAB_REQUIRED')
        await browser.scripting.executeScript({
          files: ['elements-ui.js'],
          target: { tabId: sender.tab.id },
        })
        return ok(undefined)
      case 'badge.update':
        if (sender.tab?.id !== undefined)
          await setBadge(sender.tab.id, request.count, request.paused)
        return ok(undefined)
      case 'options.open':
        await browser.runtime.openOptionsPage()
        return ok(undefined)
      case 'shortcut.get':
        return ok(await getHotkey())
      case 'shortcut.open':
        await browser.tabs.create({
          active: true,
          url: 'chrome://extensions/shortcuts',
        })
        return ok(undefined)
      case 'site.snapshot': {
        const snapshot = await repository.getSiteSnapshot(request.site)
        return ok({ ...snapshot, hotkey: await getHotkey(), incognito })
      }
      case 'site.rules.save': {
        if (incognito) {
          return ok({ rules: migratePersistedEdits(request.rules), persisted: false })
        }
        const rules = await repository.saveRules(request.site, request.rules)
        await broadcastSiteChange(request.site, request.origin)
        return ok({ rules, persisted: true })
      }
      case 'settings.get':
        return ok(await repository.getSettings())
      case 'settings.save': {
        if (incognito) return ok(normalizeSettings(request.settings))
        const settings = await repository.setSettings(request.settings)
        await broadcastSiteChange(undefined, request.origin)
        return ok(settings)
      }
      case 'site.pause':
        if (!incognito) {
          await repository.setPaused(request.site, request.paused)
          await broadcastSiteChange(request.site, request.origin)
        }
        return ok({ persisted: !incognito })
      case 'sites.list':
        return ok(await repository.listSites())
      case 'site.delete': {
        const snapshot = await repository.deleteSite(request.site)
        await broadcastSiteChange(request.site)
        return ok(snapshot)
      }
      case 'site.rule.delete': {
        const snapshot = await repository.deleteRule(request.site, request.ruleId)
        await broadcastSiteChange(request.site)
        return ok(snapshot)
      }
      case 'site.restore':
        await repository.restoreRecovery(request.recovery)
        await broadcastSiteChange(
          request.recovery.kind === 'site'
            ? request.recovery.snapshot.site
            : request.recovery.recovery.site,
        )
        return ok(undefined)
      case 'backup.export':
        return ok(await repository.exportBackup())
      case 'backup.review':
        return ok(await repository.reviewImport(request.data))
      case 'backup.import': {
        const review = await repository.importBackup(request.data, request.mode)
        await broadcastSiteChange()
        return ok(review)
      }
      case 'backup.undo': {
        const restored = await repository.undoLastImport()
        if (restored) await broadcastSiteChange()
        return ok(restored)
      }
    }
  } catch (error) {
    return failure(repositoryErrorCode(error))
  }
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(toggleActiveTab)
  browser.tabs.onActivated.addListener(() => void refreshActionState())
  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status === 'complete') void refreshActionState()
  })
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') void browser.tabs.create({ url: '/onboarding.html' })
  })
  void refreshActionState()

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isExtensionRequest(message)) {
      sendResponse(failure('INVALID_REQUEST'))
      return false
    }
    void handleRequest(message, sender)
      .then(sendResponse)
      .catch(() => sendResponse(failure('UNKNOWN')))
    return true
  })
})
