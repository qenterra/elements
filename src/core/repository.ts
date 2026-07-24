import {
  migratePersistedEdits,
  normalizeSettings,
  type ExtensionSettings,
  type PersistedEdit,
} from './model'

export interface StorageBackend {
  get<T>(key: string, fallback: T): Promise<T>
  set(key: string, value: unknown): Promise<void>
  setMany(entries: Array<[string, unknown]>): Promise<void>
  setLocal(key: string, value: unknown): Promise<void>
  remove(keyOrKeys: string | string[]): Promise<void>
  entries(): Promise<Array<[string, unknown]>>
}

export interface SiteRecord {
  site: string
  rules: PersistedEdit[]
  modified: number
  paused: boolean
}

export interface SiteSnapshot {
  site: string
  rules: PersistedEdit[]
  settings: ExtensionSettings
  paused: boolean
}

export interface BackupSite {
  site: string
  rules: PersistedEdit[]
  modified: number
  paused: boolean
}

export interface BackupV2 {
  version: 2
  exportedAt: string
  settings: ExtensionSettings
  sites: BackupSite[]
}

export interface ImportSiteReview {
  site: string
  rules: number
  conflicts: number
}

export interface ImportReview {
  version: 1 | 2
  settings: boolean
  sites: ImportSiteReview[]
  totalRules: number
  conflicts: number
  invalidRules: number
}

export type ImportMode = 'merge' | 'replace'

const SETTINGS_KEY = 'settings'
const META_KEY = 'webMeta'
const PAUSED_KEY = 'webPaused'
const SCHEMA_KEY = 'elementsSchemaVersion'
const RESTORE_KEY = 'restore:lastImport'
const STORAGE_SCHEMA_VERSION = 2
const MAX_BACKUP_BYTES = 1_000_000
const MAX_BACKUP_SITES = 1_000
const MAX_BACKUP_RULES = 10_000
const BACKUP_KEY_PATTERN = /^(?:settings|web:[^]+|webMeta|webPaused|elementsSchemaVersion)$/
const SITE_PATTERN = /^(?=.{1,255}$)(?:[a-z0-9[\].:_-]+)$/
const RULE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

class RepositoryError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeSite(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const site = value.trim().toLowerCase()
  return SITE_PATTERN.test(site) && !site.includes('..') ? site : null
}

function ruleIdentity(rule: PersistedEdit): string {
  return rule.id ?? `${rule.action ?? 'hide'}:${rule.selector}`
}

function serializeRules(rules: PersistedEdit[]): string {
  return JSON.stringify(
    rules.map((rule) => ({
      ...(rule.id ? { id: rule.id } : {}),
      selector: rule.selector,
      permanent: rule.permanent,
      ...(rule.action ? { action: rule.action } : {}),
      ...(rule.text !== undefined ? { text: rule.text } : {}),
      ...(rule.value !== undefined ? { value: rule.value } : {}),
      ...(rule.createdAt !== undefined ? { createdAt: rule.createdAt } : {}),
      ...(rule.updatedAt !== undefined ? { updatedAt: rule.updatedAt } : {}),
    })),
  )
}

function parseRules(value: unknown, now: number): { rules: PersistedEdit[]; invalid: number } {
  const parsed = parseJson<unknown>(value, [])
  if (!Array.isArray(parsed)) return { rules: [], invalid: 1 }
  const rules = migratePersistedEdits(parsed, now)
  return { rules, invalid: Math.max(0, parsed.length - rules.length) }
}

function parseMeta(value: unknown): Record<string, number> {
  const parsed = parseJson<unknown>(value, {})
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed).flatMap(([site, timestamp]) =>
      normalizeSite(site) &&
      typeof timestamp === 'number' &&
      Number.isFinite(timestamp) &&
      timestamp > 0
        ? [[site, Math.round(timestamp)]]
        : [],
    ),
  )
}

function parsePaused(value: unknown): string[] {
  const parsed = parseJson<unknown>(value, [])
  if (!Array.isArray(parsed)) return []
  return [
    ...new Set(
      parsed.flatMap((site) => {
        const normalized = normalizeSite(site)
        return normalized ? [normalized] : []
      }),
    ),
  ]
}

interface ParsedBackup {
  version: 1 | 2
  settings: ExtensionSettings
  hasSettings: boolean
  sites: BackupSite[]
  invalidRules: number
}

function parseBackupV1(record: Record<string, unknown>, now: number): ParsedBackup {
  const meta = parseMeta(record[META_KEY])
  const paused = new Set(parsePaused(record[PAUSED_KEY]))
  let invalidRules = 0
  const sites = Object.entries(record).flatMap(([key, value]): BackupSite[] => {
    if (!key.startsWith('web:')) return []
    const site = normalizeSite(key.slice(4))
    if (!site) {
      invalidRules += 1
      return []
    }
    const parsed = parseRules(value, now)
    invalidRules += parsed.invalid
    return parsed.rules.length
      ? [
          {
            site,
            rules: parsed.rules,
            modified: meta[site] ?? now,
            paused: paused.has(site),
          },
        ]
      : []
  })
  return {
    version: 1,
    settings: normalizeSettings(parseJson(record[SETTINGS_KEY], {})),
    hasSettings: SETTINGS_KEY in record,
    sites,
    invalidRules,
  }
}

function parseBackupV2(record: Record<string, unknown>, now: number): ParsedBackup {
  if (!Array.isArray(record.sites)) throw new RepositoryError('BACKUP_INVALID')
  let invalidRules = 0
  const sites = record.sites.flatMap((candidate): BackupSite[] => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      invalidRules += 1
      return []
    }
    const raw = candidate as Record<string, unknown>
    const site = normalizeSite(raw.site)
    if (!site) {
      invalidRules += 1
      return []
    }
    const parsed = parseRules(raw.rules, now)
    invalidRules += parsed.invalid
    return parsed.rules.length
      ? [
          {
            site,
            rules: parsed.rules,
            modified:
              typeof raw.modified === 'number' && Number.isFinite(raw.modified)
                ? Math.max(0, Math.round(raw.modified))
                : now,
            paused: raw.paused === true,
          },
        ]
      : []
  })
  return {
    version: 2,
    settings: normalizeSettings(record.settings),
    hasSettings: 'settings' in record,
    sites,
    invalidRules,
  }
}

function parseBackup(data: string, now: number): ParsedBackup {
  if (new TextEncoder().encode(data).length > MAX_BACKUP_BYTES)
    throw new RepositoryError('BACKUP_TOO_LARGE')
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    throw new RepositoryError('BACKUP_INVALID_JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new RepositoryError('BACKUP_INVALID')
  const record = parsed as Record<string, unknown>
  const version = record.version
  const backup =
    version === 1 ? parseBackupV1(record, now) : version === 2 ? parseBackupV2(record, now) : null
  if (!backup) throw new RepositoryError('BACKUP_UNSUPPORTED_VERSION')
  if (backup.sites.length > MAX_BACKUP_SITES) throw new RepositoryError('BACKUP_TOO_MANY_SITES')
  if (backup.sites.reduce((sum, site) => sum + site.rules.length, 0) > MAX_BACKUP_RULES) {
    throw new RepositoryError('BACKUP_TOO_MANY_RULES')
  }
  return backup
}

export class RuleRepository {
  private mutationTail: Promise<void> = Promise.resolve()

  constructor(
    private readonly storage: StorageBackend,
    private readonly now: () => number = Date.now,
  ) {}

  private mutate<T>(work: () => Promise<T>): Promise<T> {
    const run = this.mutationTail.then(work, work)
    this.mutationTail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private read<T>(work: () => Promise<T>): Promise<T> {
    const run = this.mutationTail.then(work, work)
    this.mutationTail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async backupEntries(): Promise<Array<[string, unknown]>> {
    return (await this.storage.entries()).filter(([key]) => BACKUP_KEY_PATTERN.test(key))
  }

  private async replaceRaw(entries: Array<[string, unknown]>): Promise<void> {
    const currentKeys = (await this.backupEntries()).map(([key]) => key)
    if (currentKeys.length) await this.storage.remove(currentKeys)
    if (entries.length) await this.storage.setMany(entries)
  }

  private async transaction<T>(work: () => Promise<T>): Promise<T> {
    const snapshot = await this.backupEntries()
    try {
      return await work()
    } catch (error) {
      await this.replaceRaw(snapshot)
      throw error
    }
  }

  async getSettings(): Promise<ExtensionSettings> {
    return this.read(() => this.getSettingsNow())
  }

  private async getSettingsNow(): Promise<ExtensionSettings> {
    return normalizeSettings(parseJson(await this.storage.get<unknown>(SETTINGS_KEY, '{}'), {}))
  }

  async setSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
    const normalized = normalizeSettings(settings)
    return this.mutate(async () => {
      await this.storage.set(SETTINGS_KEY, JSON.stringify(normalized))
      return normalized
    })
  }

  async getRules(siteValue: string): Promise<PersistedEdit[]> {
    const site = normalizeSite(siteValue)
    if (!site) return []
    const { raw, rules, serialized } = await this.read(() => this.getRulesNow(site))
    if (rules.length && serialized !== raw) {
      await this.mutate(async () => {
        const latest = await this.storage.get<unknown>(`web:${site}`, '[]')
        if (latest !== raw) return
        await this.storage.set(`web:${site}`, serialized)
        await this.storage.set(SCHEMA_KEY, STORAGE_SCHEMA_VERSION)
      })
    }
    return rules
  }

  private async getRulesNow(site: string): Promise<{
    raw: unknown
    rules: PersistedEdit[]
    serialized: string
  }> {
    const raw = await this.storage.get<unknown>(`web:${site}`, '[]')
    const { rules } = parseRules(raw, this.now())
    const serialized = serializeRules(rules)
    return { raw, rules, serialized }
  }

  async getSiteSnapshot(siteValue: string): Promise<SiteSnapshot> {
    const site = normalizeSite(siteValue)
    if (!site) throw new RepositoryError('SITE_INVALID')
    return this.read(async () => {
      const [rulesResult, settings, paused] = await Promise.all([
        this.getRulesNow(site),
        this.getSettingsNow(),
        this.getPausedSitesNow(),
      ])
      return { site, rules: rulesResult.rules, settings, paused: paused.includes(site) }
    })
  }

  async saveRules(siteValue: string, rulesValue: unknown): Promise<PersistedEdit[]> {
    const site = normalizeSite(siteValue)
    if (!site) throw new RepositoryError('SITE_INVALID')
    const now = this.now()
    const rules = parseRules(rulesValue, now).rules.map((rule) => ({
      ...rule,
      updatedAt: now,
    }))

    return this.mutate(async () => {
      await this.saveRulesNow(site, rules, now)
      return rules
    })
  }

  private async saveRulesNow(site: string, rules: PersistedEdit[], now: number): Promise<void> {
    await this.transaction(async () => {
      if (rules.length) await this.storage.set(`web:${site}`, serializeRules(rules))
      else await this.storage.remove(`web:${site}`)
      const meta = parseMeta(await this.storage.get<unknown>(META_KEY, {}))
      if (rules.length) meta[site] = now
      else delete meta[site]
      await this.storage.set(META_KEY, meta)
      if (!rules.length) await this.setPausedNow(site, false)
      await this.storage.set(SCHEMA_KEY, STORAGE_SCHEMA_VERSION)
    })
  }

  async getPausedSites(): Promise<string[]> {
    return this.read(() => this.getPausedSitesNow())
  }

  private async getPausedSitesNow(): Promise<string[]> {
    return parsePaused(await this.storage.get<unknown>(PAUSED_KEY, '[]'))
  }

  async setPaused(siteValue: string, paused: boolean): Promise<void> {
    const site = normalizeSite(siteValue)
    if (!site) throw new RepositoryError('SITE_INVALID')
    await this.mutate(() => this.setPausedNow(site, paused))
  }

  private async setPausedNow(site: string, paused: boolean): Promise<void> {
    const next = new Set(await this.getPausedSitesNow())
    if (paused) next.add(site)
    else next.delete(site)
    if (next.size) await this.storage.set(PAUSED_KEY, JSON.stringify([...next].sort()))
    else await this.storage.remove(PAUSED_KEY)
  }

  async listSites(): Promise<SiteRecord[]> {
    return this.read(() => this.listSitesNow())
  }

  private async listSitesNow(): Promise<SiteRecord[]> {
    const [entries, rawMeta, pausedSites] = await Promise.all([
      this.storage.entries(),
      this.storage.get<unknown>(META_KEY, {}),
      this.getPausedSitesNow(),
    ])
    const meta = parseMeta(rawMeta)
    const paused = new Set(pausedSites)
    const now = this.now()
    return entries
      .flatMap(([key, value]): SiteRecord[] => {
        if (!key.startsWith('web:')) return []
        const site = normalizeSite(key.slice(4))
        if (!site) return []
        const rules = parseRules(value, now).rules
        return rules.length
          ? [
              {
                site,
                rules,
                modified: meta[site] ?? 0,
                paused: paused.has(site),
              },
            ]
          : []
      })
      .sort((left, right) => left.site.localeCompare(right.site))
  }

  async deleteSite(siteValue: string): Promise<SiteRecord | null> {
    const site = normalizeSite(siteValue)
    if (!site) throw new RepositoryError('SITE_INVALID')
    return this.mutate(async () => {
      const existing =
        (await this.listSitesNow()).find((candidate) => candidate.site === site) ?? null
      if (!existing) return null
      await this.transaction(async () => {
        await this.storage.remove(`web:${site}`)
        const meta = parseMeta(await this.storage.get<unknown>(META_KEY, {}))
        delete meta[site]
        await this.storage.set(META_KEY, meta)
        await this.setPausedNow(site, false)
      })
      return existing
    })
  }

  async deleteRule(siteValue: string, ruleId: string): Promise<SiteRecord | null> {
    const site = normalizeSite(siteValue)
    if (!site || !RULE_ID_PATTERN.test(ruleId)) throw new RepositoryError('RULE_INVALID')
    return this.mutate(async () => {
      const existing =
        (await this.listSitesNow()).find((candidate) => candidate.site === site) ?? null
      if (!existing || !existing.rules.some((rule) => rule.id === ruleId)) return null
      await this.saveRulesNow(
        site,
        existing.rules.filter((rule) => rule.id !== ruleId),
        this.now(),
      )
      return existing
    })
  }

  async restoreSite(snapshot: SiteRecord): Promise<void> {
    const site = normalizeSite(snapshot.site)
    if (!site) throw new RepositoryError('SITE_INVALID')
    await this.mutate(() =>
      this.transaction(async () => {
        const rules = migratePersistedEdits(snapshot.rules, this.now())
        if (rules.length) await this.storage.set(`web:${site}`, serializeRules(rules))
        else await this.storage.remove(`web:${site}`)
        const meta = parseMeta(await this.storage.get<unknown>(META_KEY, {}))
        if (rules.length) meta[site] = snapshot.modified || this.now()
        else delete meta[site]
        await this.storage.set(META_KEY, meta)
        await this.setPausedNow(site, Boolean(rules.length && snapshot.paused))
      }),
    )
  }

  async exportBackup(): Promise<BackupV2> {
    return this.read(async () => ({
      version: 2,
      exportedAt: new Date(this.now()).toISOString(),
      settings: await this.getSettingsNow(),
      sites: await this.listSitesNow(),
    }))
  }

  async reviewImport(data: string): Promise<ImportReview> {
    return this.read(async () => {
      const backup = parseBackup(data, this.now())
      const current = new Map((await this.listSitesNow()).map((site) => [site.site, site]))
      const sites = backup.sites.map((incoming) => {
        const existing = current.get(incoming.site)
        const currentKeys = new Set(existing?.rules.map(ruleIdentity) ?? [])
        const conflicts = incoming.rules.filter((rule) =>
          currentKeys.has(ruleIdentity(rule)),
        ).length
        return { site: incoming.site, rules: incoming.rules.length, conflicts }
      })
      return {
        version: backup.version,
        settings: backup.hasSettings,
        sites,
        totalRules: sites.reduce((sum, site) => sum + site.rules, 0),
        conflicts: sites.reduce((sum, site) => sum + site.conflicts, 0),
        invalidRules: backup.invalidRules,
      }
    })
  }

  async importBackup(data: string, mode: ImportMode): Promise<ImportReview> {
    return this.mutate(async () => {
      const now = this.now()
      const backup = parseBackup(data, now)
      const current = new Map((await this.listSitesNow()).map((site) => [site.site, site]))
      const reviewSites = backup.sites.map((incoming) => {
        const currentKeys = new Set(current.get(incoming.site)?.rules.map(ruleIdentity) ?? [])
        const conflicts = incoming.rules.filter((rule) =>
          currentKeys.has(ruleIdentity(rule)),
        ).length
        return { site: incoming.site, rules: incoming.rules.length, conflicts }
      })
      const review: ImportReview = {
        version: backup.version,
        settings: backup.hasSettings,
        sites: reviewSites,
        totalRules: reviewSites.reduce((sum, site) => sum + site.rules, 0),
        conflicts: reviewSites.reduce((sum, site) => sum + site.conflicts, 0),
        invalidRules: backup.invalidRules,
      }
      const restore = await this.backupEntries()
      await this.storage.setLocal(RESTORE_KEY, JSON.stringify(restore))

      await this.transaction(async () => {
        const mergeCurrent = mode === 'merge' ? current : new Map<string, SiteRecord>()
        const sites = backup.sites.map((incoming): SiteRecord => {
          const existing = mergeCurrent.get(incoming.site)
          if (!existing) return incoming
          const incomingKeys = new Set(incoming.rules.map(ruleIdentity))
          return {
            site: incoming.site,
            rules: [
              ...existing.rules.filter((rule) => !incomingKeys.has(ruleIdentity(rule))),
              ...incoming.rules,
            ],
            modified: Math.max(existing.modified, incoming.modified, now),
            paused: existing.paused || incoming.paused,
          }
        })
        if (mode === 'merge') {
          for (const site of mergeCurrent.values()) {
            if (!sites.some((candidate) => candidate.site === site.site)) sites.push(site)
          }
        }

        const meta = Object.fromEntries(sites.map((site) => [site.site, site.modified || now]))
        const paused = sites.filter((site) => site.paused).map((site) => site.site)
        const entries: Array<[string, unknown]> = [
          [META_KEY, meta],
          [SCHEMA_KEY, STORAGE_SCHEMA_VERSION],
          ...sites.map((site): [string, unknown] => [
            `web:${site.site}`,
            serializeRules(site.rules),
          ]),
        ]
        if (paused.length) entries.push([PAUSED_KEY, JSON.stringify(paused.sort())])
        const currentSettings = await this.storage.get<unknown>(SETTINGS_KEY, null)
        if (mode === 'replace' && backup.hasSettings)
          entries.push([SETTINGS_KEY, JSON.stringify(backup.settings)])
        else if (currentSettings !== null) entries.push([SETTINGS_KEY, currentSettings])
        await this.replaceRaw(entries)
      })
      return review
    })
  }

  async undoLastImport(): Promise<boolean> {
    return this.mutate(async () => {
      const raw = await this.storage.get<unknown>(RESTORE_KEY, null)
      if (typeof raw !== 'string') return false
      const parsed = parseJson<unknown>(raw, null)
      if (!Array.isArray(parsed)) return false
      const entries = parsed.flatMap((entry): Array<[string, unknown]> =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        BACKUP_KEY_PATTERN.test(entry[0])
          ? [[entry[0], entry[1]]]
          : [],
      )
      await this.transaction(() => this.replaceRaw(entries))
      await this.storage.remove(RESTORE_KEY)
      return true
    })
  }
}

export function repositoryErrorCode(error: unknown): string {
  return error instanceof RepositoryError ? error.code : 'UNKNOWN'
}
