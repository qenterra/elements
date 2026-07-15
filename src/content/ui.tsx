import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useState, type ReactNode } from 'react'
import contentCss from '../../content.css?raw'
import { BrandMark } from '../components/BrandMark'
import type { RuntimeEdit } from '../core/model'
import { ElementController } from './controller'

function Icon({ children }: { children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}

function SettingsIcon() {
  return <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a2 2 0 0 0 2-2V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09A1.65 1.65 0 0 0 19.4 15z" /></Icon>
}

function TrashIcon() {
  return <Icon><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Icon>
}

function EyeIcon() {
  return <Icon><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Icon>
}

function ActionIcon({ action }: { action?: RuntimeEdit['action'] }) {
  if (action === 'round') return <Icon><path d="M4 20v-6a10 10 0 0 1 10-10h6" /></Icon>
  if (action === 'text') return <Icon><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></Icon>
  return <Icon><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></Icon>
}

function PickerPanel({ controller }: { controller: ElementController }) {
  const [snapshot, setSnapshot] = useState(controller.getSnapshot())

  useEffect(() => controller.subscribe(() => setSnapshot(controller.getSnapshot())), [controller])

  const path = snapshot.path.length
    ? snapshot.path.flatMap((token, index) => index === 0
      ? [<span key={token.label} className={`pathNode${token.active ? ' active' : ''}`}>{token.label}</span>]
      : [<span key={`${token.label}-separator`} className="pathSeparator">&gt;</span>, <span key={token.label} className={`pathNode${token.active ? ' active' : ''}`}>{token.label}</span>])
    : 'Hover over an element to select it.'

  return <div className={`mainWindow mainWindow_animated${snapshot.minimized ? ' minimized' : ''}`} role="region" aria-label="Elements picker">
    <div className="header">
      <span className="header__logo">
        <BrandMark width="17" height="17" />
        Elements
      </span>
      <span className="header__logo header__logo_small" aria-hidden="true">
        <BrandMark width="14" height="14" />
        Elements
      </span>
    </div>

    <div className="topButtons">
      <button type="button" className="topButton topButton_settings" title="Settings" aria-label="Settings" onClick={() => controller.openOptions()}><SettingsIcon /></button>
      <button type="button" className="topButton topButton_minimize" title={snapshot.minimized ? 'Expand' : 'Minimize'} aria-label={snapshot.minimized ? 'Expand' : 'Minimize'} onClick={() => controller.toggleMinimize()}><i><Icon><line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 7 17 17 7 17" /></Icon></i></button>
      <button type="button" className="topButton topButton_close" title="Close" aria-label="Close" onClick={() => controller.deactivate()}><Icon><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon></button>
    </div>

    <div className="mainWindow__body" aria-hidden={snapshot.minimized} inert={snapshot.minimized ? true : undefined}>
      <hr />

      <div className="settingsGrid">
        <button type="button" className="settingsItem activationKeys activationKeys_changeable" title="Click to change" onClick={() => controller.openHotkeySettings()}>
          {snapshot.hotkey.split('+').map((key) => <span className="key" key={key}>{key}</span>)}: Toggle overlay;
        </button>
        <div className="settingsItem"><span className="key">Q</span>/<span className="key">W</span>: Move the selection one level up or down;</div>
        <button type="button" className="settingsItem rememberRow" role="switch" aria-checked={snapshot.settings.remember} onClick={() => controller.toggleRemember()}>
          <span className={`toggle${snapshot.settings.remember ? ' toggle_on' : ''}`}><span className="toggle__knob" /></span>
          Remember by default;
        </button>
        <button type="button" className="settingsItem compareRow" role="switch" aria-checked={snapshot.previewOriginal} onClick={() => controller.toggleCompare()}>
          <span className={`toggle${snapshot.previewOriginal ? ' toggle_on' : ''}`}><span className="toggle__knob" /></span>
          Show the original page;
        </button>
        <div className="settingsItem"><span className="key">C</span>: Round the element's corners;</div>
        <div className="settingsItem"><span className="key">E</span>: Edit the element's text;</div>
        <div className="settingsItem"><span className="key">Space</span>/<span className="key">Left Click</span>: Remove the element.</div>
      </div>

      <div id="elements_current_elm">{path}</div>
      <div id="elements_elm_list" className={snapshot.edits.length ? 'hasContent' : ''}>
        {snapshot.edits.length > 0 && <table><tbody>
          <tr className="elements_heading"><td>Edited element</td><td>Remember?</td><td /></tr>
          {snapshot.edits.map((edit) => <EditRow key={`${edit.action ?? 'hide'}:${edit.selector}`} edit={edit} controller={controller} />)}
        </tbody></table>}
      </div>
    </div>
  </div>
}

function EditRow({ edit, controller }: { edit: RuntimeEdit; controller: ElementController }) {
  const preview = (showOriginal: boolean) => controller.previewEdit(edit, showOriginal)
  const previewOnTouch = (showOriginal: boolean) => {
    if (matchMedia('(hover: none)').matches) preview(showOriginal)
  }

  return <tr>
    <td className="elements_selector">
      <a href="#selector" className="elements_edit_selector" onClick={(event) => { event.preventDefault(); controller.editSelector(edit) }}>edit</a>
      <span className="elements_action" title={edit.action === 'round' ? 'Rounded corners' : edit.action === 'text' ? 'Text edited' : 'Hidden'}><ActionIcon action={edit.action} /></span>
      {edit.selector}
    </td>
    <td><input type="checkbox" checked={edit.permanent} onChange={(event) => controller.setEditPermanent(edit, event.target.checked)} aria-label="Remember this edit" /></td>
    <td>
      <button type="button" className="elements_preview" title="Hold to preview the original" aria-label="Hold to preview the original" onMouseEnter={() => preview(true)} onMouseLeave={() => preview(false)} onBlur={() => preview(false)} onPointerDown={() => previewOnTouch(true)} onPointerUp={() => previewOnTouch(false)} onPointerCancel={() => previewOnTouch(false)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); preview(true) } }} onKeyUp={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); preview(false) } }}><EyeIcon /></button>
      <a href="#delete" className="elements_delete" title="Remove from list" onClick={(event) => { event.preventDefault(); controller.deleteEdit(edit) }}><TrashIcon /></a>
    </td>
  </tr>
}

export function mountOverlay(shadowRoot: ShadowRoot, controller: ElementController): { unmount: () => void } {
  const style = document.createElement('style')
  style.textContent = contentCss
  shadowRoot.appendChild(style)
  const mountPoint = document.createElement('div')
  shadowRoot.appendChild(mountPoint)
  const root: Root = createRoot(mountPoint)
  root.render(<PickerPanel controller={controller} />)
  return { unmount: () => root.unmount() }
}
