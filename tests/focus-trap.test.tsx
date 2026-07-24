/** @vitest-environment jsdom */

import { useRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useFocusTrap } from '../src/components/useFocusTrap'

function DialogFixture() {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  useFocusTrap(dialog, first, () => setOpen(false), open)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <div ref={dialog} role="dialog" aria-modal="true">
          <button ref={first} type="button">
            First
          </button>
          <button type="button">Last</button>
        </div>
      )}
    </>
  )
}

describe('useFocusTrap', () => {
  it('moves focus in, wraps Tab, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup()
    render(<DialogFixture />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await user.click(opener)

    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })
    expect(document.activeElement).toBe(first)

    last.focus()
    await user.tab()
    expect(document.activeElement).toBe(first)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(last)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
