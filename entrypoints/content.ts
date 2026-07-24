import { ElementController } from '../src/content/controller'
import { PROTOCOL_VERSION } from '../src/core/protocol'
import { sendProtocolMessage } from '../src/core/transport'
import { defineContentScript } from 'wxt/utils/define-content-script'

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_end',
  main() {
    const singletonKey = '__elementsControllerV2'
    const rendererKey = '__elementsOverlayRendererV2'
    const target = globalThis as typeof globalThis & {
      [singletonKey]?: ElementController
      [rendererKey]?: import('../src/content/controller').OverlayRenderer
    }
    if (target[singletonKey]) return
    let rendererPromise: Promise<import('../src/content/controller').OverlayRenderer> | null = null
    let controller: ElementController
    controller = new ElementController({
      loadRenderer: () => {
        if (target[rendererKey]) return Promise.resolve(target[rendererKey])
        rendererPromise ??= sendProtocolMessage({
          v: PROTOCOL_VERSION,
          type: 'picker.ui.load',
        })
          .then((result) => {
            const renderer = target[rendererKey]
            if (!result.ok || !renderer) {
              throw new Error(result.ok ? 'UI_LOAD_FAILED' : result.error)
            }
            return renderer
          })
          .catch((error) => {
            rendererPromise = null
            throw error
          })
        return rendererPromise
      },
      onDestroy: () => {
        if (target[singletonKey] === controller) delete target[singletonKey]
      },
    })
    target[singletonKey] = controller
    void controller.init()
  },
})
