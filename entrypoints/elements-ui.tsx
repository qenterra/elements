import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'
import type { OverlayRenderer } from '../src/content/controller'
import { mountOverlay } from '../src/content/ui'

export default defineUnlistedScript({
  globalName: false,
  main() {
    const target = globalThis as typeof globalThis & {
      __elementsOverlayRendererV2?: OverlayRenderer
    }
    target['__elementsOverlayRendererV2'] = { mount: mountOverlay }
  },
})
