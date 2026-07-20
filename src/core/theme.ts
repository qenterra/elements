import type { ResolvedTheme, ThemePreference } from './model'

const LIGHT_QUERY = '(prefers-color-scheme: light)'

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference
  return matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark'
}

/** Call `onChange` whenever the system color scheme flips. Returns a cleanup. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = matchMedia(LIGHT_QUERY)
  const listener = () => onChange()
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
