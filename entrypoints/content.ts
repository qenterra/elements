import { ElementController } from '../src/content/controller'
import { mountOverlay } from '../src/content/ui'
import { defineContentScript } from 'wxt/utils/define-content-script'

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_end',
  main() {
    const controller = new ElementController({ mount: mountOverlay })
    void controller.init()
  },
})
