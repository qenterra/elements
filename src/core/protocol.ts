import type { ExtensionSettings, PersistedEdit } from './model'
import type { BackupV2, ImportMode, ImportReview, SiteRecord, SiteSnapshot } from './repository'

export const PROTOCOL_VERSION = 2 as const

export type ExtensionRequest =
  | { v: 2; type: 'picker.status'; active: boolean }
  | { v: 2; type: 'picker.ui.load' }
  | { v: 2; type: 'badge.update'; count: number; paused: boolean }
  | { v: 2; type: 'options.open' }
  | { v: 2; type: 'shortcut.get' }
  | { v: 2; type: 'shortcut.open' }
  | { v: 2; type: 'site.snapshot'; site: string }
  | { v: 2; type: 'site.rules.save'; site: string; rules: PersistedEdit[] }
  | { v: 2; type: 'settings.get' }
  | { v: 2; type: 'settings.save'; settings: ExtensionSettings }
  | { v: 2; type: 'site.pause'; site: string; paused: boolean }
  | { v: 2; type: 'sites.list' }
  | { v: 2; type: 'site.delete'; site: string }
  | { v: 2; type: 'site.rule.delete'; site: string; ruleId: string }
  | { v: 2; type: 'site.restore'; snapshot: SiteRecord }
  | { v: 2; type: 'backup.export' }
  | { v: 2; type: 'backup.review'; data: string }
  | { v: 2; type: 'backup.import'; data: string; mode: ImportMode }
  | { v: 2; type: 'backup.undo' }

export type ContentCommand =
  | { v: 2; type: 'picker.toggle' }
  | { v: 2; type: 'picker.getStatus' }
  | { v: 2; type: 'site.changed'; site: string }

export interface RuntimeSiteSnapshot extends SiteSnapshot {
  hotkey: string
  incognito: boolean
}

export interface ProtocolResponses {
  'picker.status': undefined
  'picker.ui.load': undefined
  'badge.update': undefined
  'options.open': undefined
  'shortcut.get': string
  'shortcut.open': undefined
  'site.snapshot': RuntimeSiteSnapshot
  'site.rules.save': { rules: PersistedEdit[]; persisted: boolean }
  'settings.get': ExtensionSettings
  'settings.save': ExtensionSettings
  'site.pause': { persisted: boolean }
  'sites.list': SiteRecord[]
  'site.delete': SiteRecord | null
  'site.rule.delete': SiteRecord | null
  'site.restore': undefined
  'backup.export': BackupV2
  'backup.review': ImportReview
  'backup.import': ImportReview
  'backup.undo': boolean
}

export type ProtocolResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type ResponseFor<R extends ExtensionRequest> = ProtocolResponses[R['type']]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasSite(record: Record<string, unknown>): boolean {
  return typeof record.site === 'string' && record.site.length > 0 && record.site.length <= 255
}

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!isRecord(value) || value.v !== PROTOCOL_VERSION || typeof value.type !== 'string')
    return false
  switch (value.type) {
    case 'picker.status':
      return typeof value.active === 'boolean'
    case 'badge.update':
      return (
        typeof value.count === 'number' &&
        Number.isFinite(value.count) &&
        typeof value.paused === 'boolean'
      )
    case 'options.open':
    case 'picker.ui.load':
    case 'shortcut.get':
    case 'shortcut.open':
    case 'settings.get':
    case 'sites.list':
    case 'backup.export':
    case 'backup.undo':
      return true
    case 'site.snapshot':
    case 'site.delete':
      return hasSite(value)
    case 'site.rule.delete':
      return hasSite(value) && typeof value.ruleId === 'string'
    case 'site.rules.save':
      return hasSite(value) && Array.isArray(value.rules)
    case 'settings.save':
      return isRecord(value.settings)
    case 'site.pause':
      return hasSite(value) && typeof value.paused === 'boolean'
    case 'site.restore':
      return (
        isRecord(value.snapshot) &&
        typeof value.snapshot.site === 'string' &&
        Array.isArray(value.snapshot.rules)
      )
    case 'backup.review':
      return typeof value.data === 'string'
    case 'backup.import':
      return typeof value.data === 'string' && (value.mode === 'merge' || value.mode === 'replace')
    default:
      return false
  }
}

export function isContentCommand(value: unknown): value is ContentCommand {
  if (!isRecord(value) || value.v !== PROTOCOL_VERSION || typeof value.type !== 'string')
    return false
  if (value.type === 'picker.toggle' || value.type === 'picker.getStatus') return true
  return value.type === 'site.changed' && typeof value.site === 'string'
}
