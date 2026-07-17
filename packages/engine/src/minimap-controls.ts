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
  onStateChange?: () => void
}

export const MINIMAP_FRAME_SIZE = 154
export const MINIMAP_PANEL_TOP = 46
export const MINIMAP_FRAME_OFFSET_TOP = 20
export const MINIMAP_FRAME_INSET = 10
export const MINIMAP_CONTENT_SIZE = MINIMAP_FRAME_SIZE - MINIMAP_FRAME_INSET * 2

const META_ROW_HEIGHT = 26
const COLLAPSED_PANEL_HEIGHT = 30
const EXPANDED_PANEL_HEIGHT = MINIMAP_FRAME_OFFSET_TOP + MINIMAP_FRAME_SIZE

export function createMinimapControls(args: CreateMinimapControlsArgs): MinimapControls {
  const panel = document.createElement('div')
  panel.dataset.alohayoWorldMinimap = 'true'
  Object.assign(panel.style, {
    position: 'absolute',
    top: `calc(${MINIMAP_PANEL_TOP}px + var(--alohayo-top-right-clearance, 0px))`,
    right: '18px',
    zIndex: '18',
    width: `${MINIMAP_FRAME_SIZE}px`,
    height: `${EXPANDED_PANEL_HEIGHT}px`,
    borderRadius: '16px',
    padding: '0',
    overflow: 'visible',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    display: 'block',
    pointerEvents: 'none',
    transition: 'top 220ms ease, opacity 180ms ease, height 180ms ease',
  } satisfies Partial<CSSStyleDeclaration>)

  const header = document.createElement('div')
  Object.assign(header.style, {
    position: 'absolute',
    top: '0',
    right: '0',
    width: `${MINIMAP_FRAME_SIZE}px`,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '0',
    height: `${META_ROW_HEIGHT}px`,
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.appendChild(header)

  const title = document.createElement('div')
  title.textContent = ''
  title.setAttribute('aria-hidden', 'true')
  Object.assign(title.style, {
    display: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(title)

  const clock = document.createElement('span')
  Object.assign(clock.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '74px',
    height: '22px',
    fontSize: '10px',
    fontWeight: '700',
    lineHeight: '1',
    padding: '0 8px',
    borderRadius: '999px',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    transition:
      'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
  } satisfies Partial<CSSStyleDeclaration>)
  clock.style.pointerEvents = 'auto'
  header.appendChild(clock)

  const collapseButton = document.createElement('button')
  collapseButton.type = 'button'
  Object.assign(collapseButton.style, {
    position: 'absolute',
    top: `${MINIMAP_FRAME_OFFSET_TOP + 6}px`,
    right: '-10px',
    zIndex: '2',
    border: '0',
    cursor: 'pointer',
    borderRadius: '999px',
    width: '24px',
    height: '24px',
    padding: '0',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    pointerEvents: 'auto',
    transition:
      'top 180ms ease, right 180ms ease, transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.appendChild(collapseButton)

  const frame = document.createElement('div')
  Object.assign(frame.style, {
    position: 'absolute',
    inset: `${MINIMAP_FRAME_OFFSET_TOP}px 0 0 0`,
    pointerEvents: 'none',
    zIndex: '1',
    transition: 'opacity 180ms ease, transform 180ms ease',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.appendChild(frame)

  const compass = document.createElement('span')
  Object.assign(compass.style, {
    position: 'absolute',
    top: '10px',
    right: '38px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    fontSize: '11px',
    fontWeight: '700',
    borderRadius: '999px',
    pointerEvents: 'none',
    transition:
      'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
  } satisfies Partial<CSSStyleDeclaration>)
  compass.setAttribute('role', 'img')
  frame.appendChild(compass)

  const body = document.createElement('div')
  body.id = 'alohayo-world-minimap-toolbar'
  Object.assign(body.style, {
    position: 'absolute',
    right: '10px',
    bottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    pointerEvents: 'auto',
  } satisfies Partial<CSSStyleDeclaration>)
  frame.appendChild(body)

  const makeButton = () => {
    const button = document.createElement('button')
    button.type = 'button'
    Object.assign(button.style, {
      border: '0',
      cursor: 'pointer',
      borderRadius: '999px',
      width: '24px',
      height: '24px',
      padding: '0',
      fontSize: '12px',
      fontWeight: '700',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition:
        'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
    } satisfies Partial<CSSStyleDeclaration>)
    body.appendChild(button)
    return button
  }

  const zoomOutButton = makeButton()
  const zoomInButton = makeButton()
  const fitButton = makeButton()

  const controls: MinimapControls = {
    panel,
    frame,
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
      body.style.display = collapsed ? 'none' : 'flex'
      frame.style.opacity = collapsed ? '0' : '1'
      frame.style.transform = collapsed ? 'translateY(-6px)' : 'translateY(0)'
      frame.style.visibility = collapsed ? 'hidden' : 'visible'
      frame.style.pointerEvents = 'none'
      panel.style.height = collapsed ? `${COLLAPSED_PANEL_HEIGHT}px` : `${EXPANDED_PANEL_HEIGHT}px`
      collapseButton.style.top = collapsed ? '2px' : `${MINIMAP_FRAME_OFFSET_TOP + 6}px`
      collapseButton.style.right = collapsed ? '-6px' : '-10px'
      collapseButton.textContent = collapsed ? '▾' : '▴'
      collapseButton.title = collapsed
        ? args.getText('minimapExpand')
        : args.getText('minimapCollapse')
      collapseButton.setAttribute('aria-label', collapseButton.title)
      collapseButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      collapseButton.setAttribute('aria-controls', body.id)
      window.localStorage.setItem('alohayo-world:minimap-collapsed', collapsed ? 'true' : 'false')
      args.onStateChange?.()
      args.redraw()
    },
  }

  const interactiveControls = [clock, collapseButton, zoomOutButton, zoomInButton, fitButton]
  for (const button of interactiveControls) {
    button.addEventListener('mouseenter', () => args.applyTheme(controls))
    button.addEventListener('mouseleave', () => args.applyTheme(controls))
    button.addEventListener('focus', () => args.applyTheme(controls))
    button.addEventListener('blur', () => args.applyTheme(controls))
  }

  zoomOutButton.addEventListener('click', () => {
    args.setMode('manual')
    args.setManualRadius(
      args.clamp(args.getManualRadius() + 4, 12, Math.max(args.minimapChunkRadius * 18, 96))
    )
    args.onStateChange?.()
    args.redraw()
    args.applyTheme(controls)
  })

  zoomInButton.addEventListener('click', () => {
    args.setMode('manual')
    args.setManualRadius(
      args.clamp(args.getManualRadius() - 4, 12, Math.max(args.minimapChunkRadius * 18, 96))
    )
    args.onStateChange?.()
    args.redraw()
    args.applyTheme(controls)
  })

  fitButton.addEventListener('click', () => {
    args.setMode('fit')
    args.onStateChange?.()
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
  visible: boolean,
  mode: 'fit' | 'manual'
) {
  if (!controls) return
  Object.assign(controls.panel.style, {
    display: visible ? 'block' : 'none',
    border: '0',
    background: 'transparent',
    color: palette.minimapPanelText,
  } satisfies Partial<CSSStyleDeclaration>)
  Object.assign(controls.clock.style, {
    background: palette.minimapPanelBackground,
    color: palette.minimapPanelText,
    opacity: controls.clock.matches(':hover') ? '1' : '0.78',
    boxShadow: 'none',
    transform: controls.clock.matches(':hover') ? 'translateY(-1px)' : 'translateY(0)',
  } satisfies Partial<CSSStyleDeclaration>)
  Object.assign(controls.compass.style, {
    background: palette.minimapPanelBackground,
    color: palette.minimapPanelText,
    opacity: '0.86',
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
      opacity: button.matches(':focus-visible') || button.matches(':hover') ? '0.92' : '0.46',
      transform: button.matches(':hover') ? 'translateY(-1px)' : 'translateY(0)',
      boxShadow:
        button.matches(':focus-visible') || button.matches(':hover')
          ? `0 0 0 1px ${palette.minimapPanelButtonActive}`
          : 'none',
    } satisfies Partial<CSSStyleDeclaration>)
  }
  Object.assign(controls.fitButton.style, {
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>)
  controls.fitButton.style.outline =
    mode === 'fit' ? `1px solid ${palette.minimapPanelButtonActive}` : '0'
}
