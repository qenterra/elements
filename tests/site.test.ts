import { describe, expect, it } from 'vitest'
import { siteKeyFromUrl } from '../src/core/site'

describe('siteKeyFromUrl', () => {
  it('normalizes public HTTP(S) hosts and preserves the existing www behaviour', () => {
    expect(siteKeyFromUrl('https://www.Example.com:8443/path')).toBe('example.com')
    expect(siteKeyFromUrl('http://docs.example.com')).toBe('docs.example.com')
  })

  it('keeps ports for localhost and literal IP addresses', () => {
    expect(siteKeyFromUrl('http://localhost:3000')).toBe('localhost:3000')
    expect(siteKeyFromUrl('http://127.0.0.1:5173')).toBe('127.0.0.1:5173')
    expect(siteKeyFromUrl('http://[::1]:8080')).toBe('[::1]:8080')
  })

  it('rejects unsupported or malformed URLs', () => {
    expect(siteKeyFromUrl('chrome://extensions')).toBeNull()
    expect(siteKeyFromUrl('not a URL')).toBeNull()
  })
})
