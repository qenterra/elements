import qdsTokensCss from '../qds-tokens.css?raw'
import qdsShadowDomAdapterCss from './shadow-dom.css?raw'

function scopeQdsTokensForShadowDom(tokens: string): string {
  return tokens
    .replace(
      ':root:not([data-theme="light"]):not([data-theme="dark"])',
      ':host:not([data-theme="light"]):not([data-theme="dark"])',
    )
    .replace('[data-theme="dark"]', ':host([data-theme="dark"])')
    .replace(':root, [data-theme="light"]', ':host, :host([data-theme="light"])')
}

/** Pinned QDS tokens, scoped to the Elements picker Shadow DOM. */
export const qdsShadowDomStyles = `${scopeQdsTokensForShadowDom(qdsTokensCss)}\n${qdsShadowDomAdapterCss}`
