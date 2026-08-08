import { normalizeSettings, type ExtensionSettings } from './model'

/**
 * Serializes optimistic settings writes while keeping the UI anchored to the
 * newest confirmed server value if that newest write fails. Older responses
 * update the confirmation baseline but never repaint a newer optimistic view.
 */
export class SettingsWriteQueue {
  private confirmed: ExtensionSettings
  private desired: ExtensionSettings
  private revision = 0
  private tail: Promise<void> = Promise.resolve()

  constructor(
    initial: ExtensionSettings,
    private readonly save: (settings: ExtensionSettings) => Promise<ExtensionSettings>,
    private readonly onChange: (settings: ExtensionSettings) => void,
    private readonly onFailure: () => void,
  ) {
    this.confirmed = normalizeSettings(initial)
    this.desired = this.confirmed
  }

  get current(): ExtensionSettings {
    return this.desired
  }

  update(next: Partial<ExtensionSettings>): void {
    this.desired = normalizeSettings({ ...this.desired, ...next })
    const candidate = this.desired
    const revision = ++this.revision
    this.onChange(candidate)

    this.tail = this.tail.then(async () => {
      try {
        const confirmed = normalizeSettings(await this.save(candidate))
        this.confirmed = confirmed
        if (revision !== this.revision) return
        this.desired = confirmed
        this.onChange(confirmed)
      } catch {
        if (revision !== this.revision) return
        this.desired = this.confirmed
        this.onFailure()
        this.onChange(this.confirmed)
      }
    })
  }

  flush(): Promise<void> {
    return this.tail
  }
}
