export type GuidedTrialAction = 'hide' | 'text' | 'round'

export interface GuidedTrialState {
  selected: boolean
  action: GuidedTrialAction | null
}

export type GuidedTrialEvent = { type: 'select' | 'reset' } | { type: GuidedTrialAction }

/**
 * This reducer is intentionally pure: onboarding demonstrates the interaction
 * in an isolated fixture and never reads or writes extension rules/settings.
 */
export const initialGuidedTrialState: GuidedTrialState = {
  selected: false,
  action: null,
}

export function reduceGuidedTrial(
  state: GuidedTrialState,
  event: GuidedTrialEvent,
): GuidedTrialState {
  if (event.type === 'reset') return initialGuidedTrialState
  if (event.type === 'select') return { selected: true, action: null }
  return state.selected ? { ...state, action: event.type } : state
}
