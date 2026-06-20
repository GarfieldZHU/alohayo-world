import type { ThemePalette } from './theme'
import type { MinimapControls } from './types'

interface CreateMinimapControlsArgs {
  minimapChunkRadius: number
  clamp: (value: number, min: number, max: number) => number
  getText: (key: string) => string
  getCollapsed: () => boolean
  setCollapsedState: (collapsed: boolean) => void
  getMode: () => 'fit' | 'manual'
  setMode: (mode: 'fit' | 'manual') => void
  getManualRadius: () => number
  setManualRadius: (radius: number) => void
  redraw: () => void
  applyTheme: (controls: MinimapControls | null) => void
}

export function createMinimapControls(args: CreateMinimapControlsArgs): MinimapControls {
  const panel = document.createElement('div')
  panel.dataset.alohayoWorldMinimap = 'true'
  Object.assign(panel.style, {
    position: 'absolute',
    inset: '16px 16px auto auto',
    zIndex: '18',
    width: '170px',
    borderRadius: '14px',
    padding: '8px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
  } satisfies Partial<CSSStyleDeclaration>)

  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.appendChild(header)

  const title = document.createElement('div')
  Object.assign(title.style, {
    flex: '1',
    fontSize: '11px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: '700',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(title)

  const compass = document.createElement('span')
  Object.assign(compass.style, {
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '999px',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(compass)

  const collapseButton = document.createElement('button')
  collapseButton.type = 'button'
  Object.assign(collapseButton.style, {
    border: '0',
    cursor: 'pointer',
    borderRadius: '999px',
    padding: '2px 7px',
    fontSize: '11px',
    fontWeight: '700',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(collapseButton)

  const body = document.createElement('div')
  Object.assign(body.style, {
    display: 'flex',
    gap: '6px',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.appendChild(body)

  const makeButton = () => {
    const button = document.createElement('button')
    button.type = 'button'
    Object.assign(button.style, {
      flex: '1',
      border: '0',
      cursor: 'pointer',
      borderRadius: '8px',
      padding: '7px 8px',
      fontSize: '11px',
      fontWeight: '700',
    } satisfies Partial<CSSStyleDeclaration>)
    body.appendChild(button)
    return button
  }

  const zoomOutButton = makeButton()
  const zoomInButton = makeButton()
  const fitButton = makeButton()

  const controls: MinimapControls = {
    panel,
    title,
    compass,
    collapseButton,
    zoomOutButton,
    zoomInButton,
    fitButton,
    body,
    setCollapsed(collapsed) {
      args.setCollapsedState(collapsed)
      body.style.display = collapsed ? 'none' : 'flex'
      collapseButton.textContent = collapsed
        ? args.getText('minimapExpand')
        : args.getText('minimapCollapse')
      window.localStorage.setItem('alohayo-world:minimap-collapsed', collapsed ? 'true' : 'false')
      args.redraw()
    },
  }

  zoomOutButton.addEventListener('click', () => {
    args.setMode('manual')
    args.setManualRadius(
      args.clamp(args.getManualRadius() + 1, 2, Math.max(args.minimapChunkRadius * 3, 18))
    )
    args.redraw()
    args.applyTheme(controls)
  })

  zoomInButton.addEventListener('click', () => {
    args.setMode('manual')
    args.setManualRadius(
      args.clamp(args.getManualRadius() - 1, 2, Math.max(args.minimapChunkRadius * 3, 18))
    )
    args.redraw()
    args.applyTheme(controls)
  })

  fitButton.addEventListener('click', () => {
    args.setMode('fit')
    args.redraw()
    args.applyTheme(controls)
  })

  collapseButton.addEventListener('click', () => {
    controls.setCollapsed(!args.getCollapsed())
    args.applyTheme(controls)
  })

  return controls
}

export function renderMinimapLocale(
  controls: MinimapControls | null,
  getText: (key: string) => string,
  collapsed: boolean
) {
  if (!controls) return
  controls.title.textContent = getText('minimapTitle')
  controls.compass.textContent = getText('minimapCompass')
  controls.zoomOutButton.textContent = getText('minimapZoomOut')
  controls.zoomInButton.textContent = getText('minimapZoomIn')
  controls.fitButton.textContent = getText('minimapFit')
  controls.setCollapsed(collapsed)
}

export function applyThemeToMinimapControls(
  controls: MinimapControls | null,
  palette: ThemePalette,
  devMode: boolean,
  mode: 'fit' | 'manual'
) {
  if (!controls) return
  Object.assign(controls.panel.style, {
    display: devMode ? 'none' : 'block',
    border: `1px solid ${palette.minimapPanelBorder}`,
    background: palette.minimapPanelBackground,
    color: palette.minimapPanelText,
  } satisfies Partial<CSSStyleDeclaration>)
  Object.assign(controls.compass.style, {
    background: palette.minimapPanelButtonBackground,
    color: palette.minimapPanelMuted,
  } satisfies Partial<CSSStyleDeclaration>)
  for (const button of [
    controls.collapseButton,
    controls.zoomOutButton,
    controls.zoomInButton,
    controls.fitButton,
  ]) {
    Object.assign(button.style, {
      background: palette.minimapPanelButtonBackground,
      color: palette.minimapPanelText,
    } satisfies Partial<CSSStyleDeclaration>)
  }
  controls.fitButton.style.outline =
    mode === 'fit' ? `1px solid ${palette.minimapPanelButtonActive}` : '0'
}
