import { describe, expect, it } from 'vitest'
import {
  canUsePickerActions,
  pickerSelectionStatusKey,
  recentHistory,
} from '../src/content/picker-state'

describe('picker state helpers', () => {
  it('keeps the three newest edits in collapsed history and preserves all edits when expanded', () => {
    const edits = ['first', 'second', 'third', 'fourth', 'fifth']

    expect(recentHistory(edits, false)).toEqual(['third', 'fourth', 'fifth'])
    expect(recentHistory(edits, true)).toEqual(edits)
  })

  it('uses an explicit editing state instead of claiming actions are ready', () => {
    expect(pickerSelectionStatusKey('selected', false)).toBe('pickerSelected')
    expect(pickerSelectionStatusKey('selected', true)).toBe('pickerEditing')
    expect(pickerSelectionStatusKey('previewing', false)).toBe('pickerPreviewing')
    expect(pickerSelectionStatusKey('idle', false)).toBe('pickerSelectionIdle')
  })

  it('only enables selection actions and More for a selected, non-editing target', () => {
    expect(canUsePickerActions('idle', false)).toBe(false)
    expect(canUsePickerActions('previewing', false)).toBe(false)
    expect(canUsePickerActions('selected', true)).toBe(false)
    expect(canUsePickerActions('selected', false)).toBe(true)
  })
})
