import { defineConfig } from 'wxt'

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  zip: {
    zipSources: false,
  },
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    icons: {
      16: 'icons/icon_16.png',
      32: 'icons/icon_32.png',
      48: 'icons/icon_48.png',
      128: 'icons/icon_128.png',
    },
    action: {
      default_icon: {
        16: 'icons/action_inactive_16.png',
        32: 'icons/action_inactive.png',
      },
    },
    commands: {
      _execute_action: {
        suggested_key: {
          windows: 'Ctrl+Shift+X',
          mac: 'Command+Shift+X',
          chromeos: 'Ctrl+Shift+X',
          linux: 'Ctrl+Shift+X',
        },
      },
    },
    permissions: ['scripting', 'storage'],
    host_permissions: ['*://*/*'],
    incognito: 'spanning',
  },
})
