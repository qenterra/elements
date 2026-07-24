import { describe, expect, it } from 'vitest'
import { HybridStorage, type StorageArea } from '../src/core/hybrid-storage'
import { RuleRepository } from '../src/core/repository'

class MemoryArea implements StorageArea {
  readonly values: Record<string, unknown>
  failSetFor = new Set<string>()

  constructor(initial: Record<string, unknown> = {}) {
    this.values = { ...initial }
  }

  async get(keys: string | string[] | null): Promise<Record<string, unknown>> {
    if (keys === null) return { ...this.values }
    const selected = Array.isArray(keys) ? keys : [keys]
    return Object.fromEntries(
      selected.filter((key) => key in this.values).map((key) => [key, this.values[key]]),
    )
  }

  async set(items: Record<string, unknown>): Promise<void> {
    if (Object.keys(items).some((key) => this.failSetFor.has(key))) throw new Error('write failed')
    Object.assign(this.values, items)
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete this.values[key]
  }
}

function setup(
  syncValues: Record<string, unknown> = {},
  localValues: Record<string, unknown> = {},
) {
  const sync = new MemoryArea(syncValues)
  const local = new MemoryArea(localValues)
  const storage = new HybridStorage(sync, local)
  return { sync, local, storage, repository: new RuleRepository(storage, () => 1_000) }
}

describe('RuleRepository', () => {
  it('migrates legacy rules to schema v2 without changing their behaviour', async () => {
    const { repository, sync } = setup({
      'web:example.com': JSON.stringify([{ selector: '.ad', permanent: true }]),
    })

    const rules = await repository.getRules('example.com')

    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({
      selector: '.ad',
      permanent: true,
      createdAt: 1_000,
      updatedAt: 1_000,
    })
    expect(rules[0].id).toMatch(/^legacy-/)
    expect(JSON.parse(String(sync.values['web:example.com']))[0].id).toBe(rules[0].id)
  })

  it('saves rules and metadata as one recoverable operation', async () => {
    const { repository } = setup()
    await repository.saveRules('example.com', [{ selector: '.ad', permanent: true }])

    const sites = await repository.listSites()
    expect(sites).toHaveLength(1)
    expect(sites[0]).toMatchObject({ site: 'example.com', modified: 1_000, paused: false })
  })

  it('deletes rules, metadata, and pause state together and can restore them', async () => {
    const { repository } = setup({
      'web:example.com': JSON.stringify([{ selector: '.ad', permanent: true }]),
      webMeta: { 'example.com': 500 },
      webPaused: JSON.stringify(['example.com']),
    })

    const snapshot = await repository.deleteSite('example.com')
    expect(snapshot).toMatchObject({ site: 'example.com', modified: 500, paused: true })
    await expect(repository.listSites()).resolves.toEqual([])
    await expect(repository.getPausedSites()).resolves.toEqual([])

    await repository.restoreSite(snapshot!)
    await expect(repository.listSites()).resolves.toHaveLength(1)
    await expect(repository.getPausedSites()).resolves.toEqual(['example.com'])
  })

  it('serializes concurrent rule deletions so neither rule is resurrected', async () => {
    const { repository } = setup({
      'web:example.com': JSON.stringify([
        { id: 'rule_first', selector: '.first', permanent: true },
        { id: 'rule_second', selector: '.second', permanent: true },
      ]),
      webMeta: { 'example.com': 500 },
    })

    const [firstSnapshot, secondSnapshot] = await Promise.all([
      repository.deleteRule('example.com', 'rule_first'),
      repository.deleteRule('example.com', 'rule_second'),
    ])

    expect(firstSnapshot?.rules).toHaveLength(2)
    expect(secondSnapshot?.rules).toHaveLength(1)
    await expect(repository.listSites()).resolves.toEqual([])
  })

  it('returns a restorable snapshot for an atomic rule deletion', async () => {
    const { repository } = setup({
      'web:example.com': JSON.stringify([
        { id: 'rule_first', selector: '.first', permanent: true },
        { id: 'rule_second', selector: '.second', permanent: true },
      ]),
      webMeta: { 'example.com': 500 },
    })

    const snapshot = await repository.deleteRule('example.com', 'rule_first')
    await expect(repository.listSites()).resolves.toMatchObject([
      { rules: [{ id: 'rule_second' }] },
    ])
    await repository.restoreSite(snapshot!)
    await expect(repository.listSites()).resolves.toMatchObject([
      { rules: [{ id: 'rule_first' }, { id: 'rule_second' }] },
    ])
  })

  it('reviews and imports a v1 backup while reporting invalid rules', async () => {
    const { repository } = setup()
    const backup = JSON.stringify({
      version: 1,
      settings: JSON.stringify({ theme: 'dark' }),
      'web:example.com': JSON.stringify([
        { selector: '.ad', permanent: true },
        { selector: '', permanent: true },
      ]),
      webMeta: { 'example.com': 700 },
    })

    await expect(repository.reviewImport(backup)).resolves.toMatchObject({
      version: 1,
      settings: true,
      totalRules: 1,
      invalidRules: 1,
    })
    await repository.importBackup(backup, 'replace')
    await expect(repository.listSites()).resolves.toMatchObject([
      { site: 'example.com', modified: 700 },
    ])
  })

  it('merges conflicts by stable identity without duplicating a rule', async () => {
    const { repository } = setup({
      'web:example.com': JSON.stringify([
        { id: 'rule_same', selector: '.old', permanent: true },
        { id: 'rule_keep', selector: '.keep', permanent: true },
      ]),
    })
    const backup = JSON.stringify({
      version: 2,
      exportedAt: new Date(0).toISOString(),
      settings: {},
      sites: [
        {
          site: 'example.com',
          modified: 900,
          paused: false,
          rules: [{ id: 'rule_same', selector: '.new', permanent: true }],
        },
      ],
    })

    await expect(repository.reviewImport(backup)).resolves.toMatchObject({ conflicts: 1 })
    await repository.importBackup(backup, 'merge')
    const [site] = await repository.listSites()
    expect(site.rules.map((rule) => rule.selector)).toEqual(['.keep', '.new'])
  })

  it('restores the previous snapshot when a replacement transaction fails', async () => {
    const { repository, sync, local } = setup({
      'web:old.example': JSON.stringify([{ selector: '.old', permanent: true }]),
      webMeta: { 'old.example': 500 },
    })
    const backup = JSON.stringify({
      version: 2,
      exportedAt: new Date(0).toISOString(),
      settings: {},
      sites: [
        {
          site: 'new.example',
          modified: 900,
          paused: false,
          rules: [{ selector: '.new', permanent: true }],
        },
      ],
    })
    sync.failSetFor.add('web:new.example')
    local.failSetFor.add('web:new.example')

    await expect(repository.importBackup(backup, 'replace')).rejects.toThrow('write failed')
    await expect(repository.listSites()).resolves.toMatchObject([{ site: 'old.example' }])
  })

  it('can undo the last successful import', async () => {
    const { repository } = setup({
      'web:old.example': JSON.stringify([{ selector: '.old', permanent: true }]),
      webMeta: { 'old.example': 500 },
    })
    const backup = JSON.stringify({
      version: 2,
      exportedAt: new Date(0).toISOString(),
      settings: {},
      sites: [
        {
          site: 'new.example',
          modified: 900,
          paused: false,
          rules: [{ selector: '.new', permanent: true }],
        },
      ],
    })

    await repository.importBackup(backup, 'replace')
    await expect(repository.listSites()).resolves.toMatchObject([{ site: 'new.example' }])
    await expect(repository.undoLastImport()).resolves.toBe(true)
    await expect(repository.listSites()).resolves.toMatchObject([{ site: 'old.example' }])
  })
})
