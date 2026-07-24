import { browser } from 'wxt/browser'
import { HybridStorage, type StorageArea } from './hybrid-storage'

export const hybridStorage = new HybridStorage(
  browser.storage.sync as unknown as StorageArea,
  browser.storage.local as unknown as StorageArea,
)
