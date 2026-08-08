import type { OverlaySnapshot } from '../core/model'

export type PickerSelectionState = OverlaySnapshot['selectionState']

export function recentHistory<T>(items: readonly T[], expanded: boolean): T[] {
  return expanded ? [...items] : items.slice(-3)
}

export function pickerSelectionStatusKey(
  selectionState: PickerSelectionState,
  isEditing: boolean,
): 'pickerSelectionIdle' | 'pickerPreviewing' | 'pickerSelected' | 'pickerEditing' {
  if (isEditing) return 'pickerEditing'
  if (selectionState === 'selected') return 'pickerSelected'
  if (selectionState === 'previewing') return 'pickerPreviewing'
  return 'pickerSelectionIdle'
}

export function canUsePickerActions(
  selectionState: PickerSelectionState,
  isEditing: boolean,
): boolean {
  return selectionState === 'selected' && !isEditing
}
