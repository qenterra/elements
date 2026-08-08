import {
  isSafeSelectorText,
  sanitizeCssDeclarations,
  type ExtensionSettings,
  type PersistedEdit,
} from './model'
import type {
  BackupV2,
  ImportMode,
  ImportReview,
  RuleDeletion,
  SiteRecord,
  SiteRecovery,
  SiteSnapshot,
} from './repository'

export const PROTOCOL_VERSION = 2 as const
const RECOVERY_SITE_PATTERN = /^(?=.{1,255}$)(?:[a-z0-9[\].:_-]+)$/
const RECOVERY_RULE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/
const RECOVERY_ACTIONS = new Set(['round', 'text', 'blur', 'dim', 'gray', 'css'])

export type ExtensionRequest =
  | { v: 2; type: 'picker.status'; active: boolean }
  | { v: 2; type: 'picker.ui.load' }
  | { v: 2; type: 'badge.update'; count: number; paused: boolean }
  | { v: 2; type: 'options.open' }
  | { v: 2; type: 'shortcut.get' }
  | { v: 2; type: 'shortcut.open' }
  | { v: 2; type: 'site.snapshot'; site: string }
  | { v: 2; type: 'site.rules.save'; site: string; rules: PersistedEdit[]; origin?: string }
  | { v: 2; type: 'settings.get' }
  | { v: 2; type: 'settings.save'; settings: ExtensionSettings; origin?: string }
  | { v: 2; type: 'site.pause'; site: string; paused: boolean; origin?: string }
  | { v: 2; type: 'sites.list' }
  | { v: 2; type: 'site.delete'; site: string }
  | { v: 2; type: 'site.rule.delete'; site: string; ruleId: string }
  | { v: 2; type: 'site.restore'; recovery: SiteRecovery }
  | { v: 2; type: 'backup.export' }
  | { v: 2; type: 'backup.review'; data: string }
  | { v: 2; type: 'backup.import'; data: string; mode: ImportMode }
  | { v: 2; type: 'backup.undo' }

export type ContentCommand =
  | { v: 2; type: 'picker.toggle' }
  | { v: 2; type: 'picker.getStatus' }
  | { v: 2; type: 'site.changed'; site: string; origin?: string }

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
  'site.rule.delete': RuleDeletion | null
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

function hasValidOrigin(record: Record<string, unknown>): boolean {
  return (
    record.origin === undefined ||
    (typeof record.origin === 'string' && record.origin.length > 0 && record.origin.length <= 64)
  )
}

function hasStoredSite(value: unknown): value is string {
  return typeof value === 'string' && RECOVERY_SITE_PATTERN.test(value) && !value.includes('..')
}

function hasTimestamp(value: unknown, allowZero = false): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    (allowZero ? value >= 0 : value > 0)
  )
}

function hasRecoveryRule(record: Record<string, unknown>): boolean {
  if (
    typeof record.id !== 'string' ||
    !RECOVERY_RULE_ID_PATTERN.test(record.id) ||
    !isSafeSelectorText(record.selector) ||
    typeof record.permanent !== 'boolean'
  )
    return false

  const action = record.action
  if (action !== undefined && (typeof action !== 'string' || !RECOVERY_ACTIONS.has(action)))
    return false
  if (record.text !== undefined && (action !== 'text' || typeof record.text !== 'string'))
    return false
  if (record.value === undefined) {
    return (
      (record.createdAt === undefined || hasTimestamp(record.createdAt)) &&
      (record.updatedAt === undefined || hasTimestamp(record.updatedAt))
    )
  }
  if (typeof record.value !== 'string') return false
  if (action === 'round' && !/^\d{1,3}$/.test(record.value)) return false
  if (action === 'css' && !sanitizeCssDeclarations(record.value)) return false
  if (action !== 'round' && action !== 'css') return false
  return (
    (record.createdAt === undefined || hasTimestamp(record.createdAt)) &&
    (record.updatedAt === undefined || hasTimestamp(record.updatedAt))
  )
}

function hasSiteRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasStoredSite(value.site) &&
    Array.isArray(value.rules) &&
    value.rules.every((rule) => isRecord(rule) && hasRecoveryRule(rule)) &&
    hasTimestamp(value.modified, true) &&
    typeof value.paused === 'boolean'
  )
}

function hasRecovery(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== 'string') return false
  if (value.kind === 'site') {
    return hasSiteRecord(value.snapshot)
  }
  return (
    value.kind === 'rule' &&
    isRecord(value.recovery) &&
    hasStoredSite(value.recovery.site) &&
    isRecord(value.recovery.rule) &&
    hasRecoveryRule(value.recovery.rule) &&
    hasTimestamp(value.recovery.modified, true) &&
    typeof value.recovery.paused === 'boolean'
  )
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
      return hasSite(value) && Array.isArray(value.rules) && hasValidOrigin(value)
    case 'settings.save':
      return isRecord(value.settings) && hasValidOrigin(value)
    case 'site.pause':
      return hasSite(value) && typeof value.paused === 'boolean' && hasValidOrigin(value)
    case 'site.restore':
      return hasRecovery(value.recovery)
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
  return value.type === 'site.changed' && typeof value.site === 'string' && hasValidOrigin(value)
}
