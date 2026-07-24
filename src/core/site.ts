function isLocalHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return true
  return hostname.includes(':')
}

export function siteKeyFromUrl(value: string | URL): string | null {
  try {
    const url = value instanceof URL ? value : new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    if (!hostname) return null
    return isLocalHost(hostname) && url.port ? `${hostname}:${url.port}` : hostname
  } catch {
    return null
  }
}
