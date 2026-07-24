import { browser } from 'wxt/browser'
import {
  PROTOCOL_VERSION,
  type ExtensionRequest,
  type ProtocolResult,
  type ResponseFor,
} from './protocol'

export function request<T extends Omit<ExtensionRequest, 'v'>>(message: T): T & { v: 2 } {
  return { ...message, v: PROTOCOL_VERSION }
}

export async function sendProtocolMessage<R extends ExtensionRequest>(
  message: R,
): Promise<ProtocolResult<ResponseFor<R>>> {
  try {
    const response = (await browser.runtime.sendMessage(message)) as
      ProtocolResult<ResponseFor<R>> | undefined
    return response ?? { ok: false, error: 'NO_RESPONSE' }
  } catch {
    return { ok: false, error: 'RUNTIME_UNAVAILABLE' }
  }
}
