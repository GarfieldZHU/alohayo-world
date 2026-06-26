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
    top: 'calc(var(--alohayo-minimap-toolbar-top, 44px) + var(--alohayo-top-right-clearance, 0px))',
    right: '16px',
    zIndex: '18',
    width: '154px',
    borderRadius: '16px',
    padding: '0',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    display: 'grid',
    gap: '6px',
    transition: 'top 220ms ease, opacity 180ms ease',
  } satisfies Partial<CSSStyleDeclaration>)

  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto 26px',
    alignItems: 'center',
    gap: '4px',
    minHeight: '28px',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.appendChild(header)

  const title = document.createElement('div')
  Object.assign(title.style, {
    flex: '1',
    fontSize: '9px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontWeight: '700',
    paddingLeft: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(title)

  const clock = document.createElement('span')
  Object.assign(clock.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '66px',
    height: '24px',
    fontSize: '10px',
    fontWeight: '700',
    lineHeight: '1',
    padding: '0 6px',
    borderRadius: '999px',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    transition:
      'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(clock)

  const compass = document.createElement('span')
  Object.assign(compass.style, {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '0',
    height: '0',
    fontSize: '11px',
    fontWeight: '700',
    padding: '0',
    borderRadius: '999px',
    transition:
      'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease',
  } satisfies Partial<CSSStyleDeclaration>)
  compass.setAttribute('role', 'img')
  header.appendChild(compass)

  const collapseButton = document.createElement('button')
  collapseButton.type = 'button'
  Object.assign(collapseButton.style, {
    border: '0',
    cursor: 'pointer',
    borderRadius: '999px',
    width: '26px',
    height: '24px',
    padding: '0',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    transition:
      'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(collapseButton)

  const body = document.createElement('div')
  body.id = 'alohayo-world-minimap-toolbar'
  Object.assign(body.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '6px',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.appendChild(body)

  const makeButton = () => {
    const button = document.createElement('button')
    button.type = 'button'
    Object.assign(button.style, {
      border: '0',
      cursor: 'pointer',
      borderRadius: '10px',
      minHeight: '32px',
      padding: '0',
      fontSize: '14px',
      fontWeight: '700',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition:
        'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease',
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
    clock,
    compass,
    collapseButton,
    zoomOutButton,
    zoomInButton,
    fitButton,
    body,
    setCollapsed(collapsed) {
      args.setCollapsedState(collapsed)
      body.style.display = collapsed ? 'none' : 'grid'
      collapseButton.textContent = collapsed ? '⌄' : '⌃'
      collapseButton.title = collapsed
        ? args.getText('minimapExpand')
        : args.getText('minimapCollapse')
      collapseButton.setAttribute('aria-label', collapseButton.title)
      collapseButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      collapseButton.setAttribute('aria-controls', body.id)
      window.localStorage.setItem('alohayo-world:minimap-collapsed', collapsed ? 'true' : 'false')
      args.redraw()
    },
  }

  const interactiveControls = [collapseButton, zoomOutButton, zoomInButton, fitButton]
  for (const button of interactiveControls) {
    button.addEventListener('mouseenter', () => args.applyTheme(controls))
    button.addEventListener('mouseleave', () => args.applyTheme(controls))
    button.addEventListener('focus', () => args.applyTheme(controls))
    button.addEventListener('blur', () => args.applyTheme(controls))
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
  controls.clock.title = getText('timeTitle')
  controls.clock.setAttribute('aria-label', getText('timeTitle'))
  controls.compass.textContent = getText('minimapCompass')
  controls.zoomOutButton.textContent = '−'
  controls.zoomInButton.textContent = '+'
  controls.fitButton.textContent = '◎'
  controls.zoomOutButton.title = getText('minimapZoomOut')
  controls.zoomInButton.title = getText('minimapZoomIn')
  controls.fitButton.title = getText('minimapFit')
  controls.compass.title = getText('minimapCompass')
  controls.compass.setAttribute('aria-label', getText('minimapCompass'))
  controls.zoomOutButton.setAttribute('aria-label', getText('minimapZoomOut'))
  controls.zoomInButton.setAttribute('aria-label', getText('minimapZoomIn'))
  controls.fitButton.setAttribute('aria-label', getText('minimapFit'))
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
    display: devMode ? 'none' : 'grid',
    border: '0',
    background: 'transparent',
    color: palette.minimapPanelText,
  } satisfies Partial<CSSStyleDeclaration>)
  Object.assign(controls.clock.style, {
    display: devMode ? 'none' : 'inline-flex',
    background: palette.minimapPanelButtonBackground,
    color: palette.minimapPanelText,
  } satisfies Partial<CSSStyleDeclaration>)
  Object.assign(controls.compass.style, {
    display: 'none',
    background: 'transparent',
    color: palette.minimapPanelMuted,
    boxShadow: 'none',
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
      transform: button.matches(':hover') ? 'translateY(-1px)' : 'translateY(0)',
      boxShadow:
        button.matches(':focus-visible') || button.matches(':hover')
          ? `0 0 0 1px ${palette.minimapPanelButtonActive}`
          : 'none',
    } satisfies Partial<CSSStyleDeclaration>)
  }
  Object.assign(controls.fitButton.style, {
    fontSize: '13px',
  } satisfies Partial<CSSStyleDeclaration>)
  controls.fitButton.style.outline =
    mode === 'fit' ? `1px solid ${palette.minimapPanelButtonActive}` : '0'
}
