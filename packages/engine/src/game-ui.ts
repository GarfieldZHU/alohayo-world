import type { GameUiTab, LocaleCode } from '@alohayo/config'
import type { ResolvedGameUiOptions } from './game-ui-config'
import {
  createCharacterDossier,
  type CharacterDossierAction,
  type CharacterDossierController,
  type CharacterDossierSnapshot,
} from './character-dossier'
import { getGameUiCopy } from './game-ui-copy'
import {
  createJournalMenu,
  type JournalAction,
  type JournalMenuController,
  type JournalTabId,
} from './journal-menu'

function normalizeJournalTab(tab?: GameUiTab): JournalTabId {
  switch (tab) {
    case 'save':
    case 'guide':
    case 'terrain':
    case 'bestiary':
    case 'map':
    case 'settings':
      return tab
    case 'journey':
    case 'party':
    case 'gear':
      return 'guide'
    default:
      return 'save'
  }
}

export interface GameUiSnapshot {
  explorerName: string
  state: string
  biome: string
  region: string
  worldSeed: string
  discoveredCells: number
  discoveredChunks: number
  loadedChunks: number
  fps: number
  position: string
  gear: string[]
  restoredSave: boolean
  character: CharacterDossierSnapshot
  journal: import('./journal-menu').JournalMenuSnapshot
}

interface CreateGameUiOptions {
  container: HTMLElement
  config: ResolvedGameUiOptions
  locale: LocaleCode
  snapshot: GameUiSnapshot
  onBlockingChange: (blocked: boolean) => void
  onConfigChange: (config: ResolvedGameUiOptions) => void
  onCharacterAction: (action: CharacterDossierAction) => void
  onJournalAction: (action: JournalAction) => Promise<void> | void
  onCharacterInteractionStart?: () => void
}

export interface GameUiController {
  isBlockingInput(): boolean
  handleKeyDown(event: KeyboardEvent): boolean
  setConfig(config: ResolvedGameUiOptions): void
  setSnapshot(snapshot: GameUiSnapshot): void
  setLocale(locale: LocaleCode): void
  setTheme(theme: 'light' | 'dark'): void
  openMenu(tab?: GameUiTab): void
  closeMenu(): void
  openCharacterPanel(panel?: Parameters<CharacterDossierController['openPanel']>[0]): void
  destroy(): void
}

function button(className: string, action: string): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = className
  element.dataset.gameUiAction = action
  return element
}

export function createGameUi(options: CreateGameUiOptions): GameUiController {
  let config = options.config
  let snapshot = options.snapshot
  let splashOpen = config.splash
  let menuOpen = false
  let locale = options.locale
  let previousFocus: HTMLElement | null = null
  let dossier: CharacterDossierController | null = null
  let journalMenu: JournalMenuController | null = null

  const root = document.createElement('div')
  root.className = 'aw-game-ui'
  root.dataset.gameUi = 'true'

  const hud = document.createElement('section')
  hud.className = 'aw-game-ui__hud'
  hud.dataset.gameUiSurface = 'hud'
  hud.setAttribute('aria-label', 'Game status')

  const identity = document.createElement('div')
  identity.className = 'aw-game-ui__identity'
  const sigil = document.createElement('span')
  sigil.className = 'aw-game-ui__sigil'
  sigil.setAttribute('aria-hidden', 'true')
  sigil.textContent = '✦'
  const identityCopy = document.createElement('span')
  const explorerName = document.createElement('strong')
  const explorerState = document.createElement('small')
  identityCopy.append(explorerName, explorerState)
  identity.append(sigil, identityCopy)

  const location = document.createElement('div')
  location.className = 'aw-game-ui__location'
  const regionName = document.createElement('strong')
  const biomeName = document.createElement('span')
  location.append(regionName, biomeName)

  const headerTools = document.createElement('div')
  headerTools.className = 'aw-game-ui__header-tools'

  const compassButton = button('aw-game-ui__compass', 'menu-map')
  compassButton.setAttribute('aria-label', 'Open world map')
  compassButton.innerHTML = '<span aria-hidden="true">N</span><i aria-hidden="true"></i>'
  headerTools.append(location, compassButton)

  const controlsHint = document.createElement('aside')
  controlsHint.className = 'aw-game-ui__controls-hint'
  controlsHint.setAttribute('aria-label', 'Game shortcuts')
  const shortcutHint = (key: string, label: string) => {
    const item = document.createElement('span')
    const keycap = document.createElement('kbd')
    keycap.textContent = key
    const copy = document.createElement('span')
    copy.textContent = label
    item.append(keycap, copy)
    return item
  }
  const menuHint = shortcutHint('M', '')
  const hudHint = shortcutHint('H', '')
  const minimapHint = shortcutHint('N', '')
  controlsHint.append(menuHint, hudHint, minimapHint)
  hud.append(identity, headerTools, controlsHint)

  const splash = document.createElement('section')
  splash.className = 'aw-game-ui__splash'
  splash.dataset.gameUiSurface = 'splash'
  splash.setAttribute('role', 'dialog')
  splash.setAttribute('aria-modal', 'true')
  const splashCard = document.createElement('div')
  splashCard.className = 'aw-game-ui__splash-card'
  const splashMark = document.createElement('div')
  splashMark.className = 'aw-game-ui__splash-mark'
  splashMark.setAttribute('aria-hidden', 'true')
  splashMark.textContent = '✦'
  const eyebrow = document.createElement('p')
  eyebrow.className = 'aw-game-ui__eyebrow'
  const splashTitle = document.createElement('h1')
  const splashIntro = document.createElement('p')
  splashIntro.className = 'aw-game-ui__intro'
  const splashActions = document.createElement('div')
  splashActions.className = 'aw-game-ui__splash-actions'
  const enterButton = button('aw-game-ui__primary', 'enter')
  const continueButton = button('aw-game-ui__secondary', 'continue')
  const settingsButton = button('aw-game-ui__text-button', 'menu-settings')
  splashActions.append(enterButton, continueButton, settingsButton)
  const controls = document.createElement('p')
  controls.className = 'aw-game-ui__controls'
  splashCard.append(splashMark, eyebrow, splashTitle, splashIntro, splashActions, controls)
  splash.append(splashCard)

  const menu = document.createElement('section')
  menu.className = 'aw-game-ui__menu'
  menu.dataset.gameUiSurface = 'menu'
  menu.setAttribute('role', 'dialog')
  menu.setAttribute('aria-modal', 'true')
  const menuFrame = document.createElement('div')
  menuFrame.className = 'aw-game-ui__menu-frame'
  const menuHeader = document.createElement('header')
  const menuEyebrow = document.createElement('p')
  menuEyebrow.className = 'aw-game-ui__eyebrow'
  const menuTitle = document.createElement('h2')
  const closeButton = button('aw-game-ui__close', 'close-menu')
  closeButton.setAttribute('aria-label', 'Close menu')
  closeButton.textContent = '×'
  menuHeader.append(menuEyebrow, menuTitle, closeButton)
  const menuBody = document.createElement('div')
  menuBody.className = 'aw-game-ui__menu-body'
  const menuFooter = document.createElement('footer')
  menuFooter.innerHTML = '<span>1–6 · Q / E</span><span>Esc / M</span>'
  menuFrame.append(menuHeader, menuBody, menuFooter)
  menu.append(menuFrame)
  root.append(hud, splash, menu)
  options.container.appendChild(root)

  dossier = createCharacterDossier({
    container: options.container,
    locale,
    snapshot: snapshot.character,
    onAction: options.onCharacterAction,
    onInteractionStart: options.onCharacterInteractionStart,
  })

  journalMenu = createJournalMenu({
    container: menuBody,
    locale,
    snapshot: snapshot.journal,
    config: { hud: config.hud, minimap: config.minimap },
    onAction: (action) => {
      if (action.type === 'open-character') {
        closeMenu()
        dossier?.openPanel('overview')
        return
      }
      if (action.type === 'toggle-hud') {
        config = { ...config, hud: !config.hud }
        options.onConfigChange(config)
        journalMenu?.setConfig({ hud: config.hud, minimap: config.minimap })
        renderState()
        return
      }
      if (action.type === 'toggle-minimap') {
        config = { ...config, minimap: !config.minimap }
        options.onConfigChange(config)
        journalMenu?.setConfig({ hud: config.hud, minimap: config.minimap })
        renderState()
        return
      }
      return options.onJournalAction(action)
    },
  })

  const text = (key: string) => getGameUiCopy(locale, key)
  const setBlocked = () => options.onBlockingChange(splashOpen || menuOpen)

  const renderCopy = () => {
    hud.setAttribute('aria-label', text('HudLabel'))
    compassButton.setAttribute('aria-label', text('OpenMap'))
    menuHint.lastElementChild!.textContent = text('ShortcutMenu')
    hudHint.lastElementChild!.textContent = text('ShortcutHud')
    minimapHint.lastElementChild!.textContent = text('ShortcutMinimap')
    eyebrow.textContent = text('Eyebrow')
    splashTitle.textContent = text('Title')
    splashIntro.textContent = text('Intro')
    enterButton.textContent = text('Enter')
    continueButton.textContent = text('Continue')
    enterButton.hidden = snapshot.restoredSave
    continueButton.hidden = !snapshot.restoredSave
    continueButton.className = snapshot.restoredSave
      ? 'aw-game-ui__primary'
      : 'aw-game-ui__secondary'
    settingsButton.textContent = text('Settings')
    controls.textContent = text('SplashControls')
    menuEyebrow.textContent = text('MenuEyebrow')
    menuTitle.textContent = text('MenuTitle')
    closeButton.setAttribute('aria-label', text('Close'))
    journalMenu?.setLocale(locale)
  }

  const renderSnapshot = () => {
    explorerName.textContent = snapshot.explorerName
    explorerState.textContent = snapshot.state
    regionName.textContent = snapshot.region
    biomeName.textContent = snapshot.biome
    journalMenu?.setSnapshot(snapshot.journal)
  }

  const renderState = () => {
    root.hidden = !config.enabled
    hud.hidden = !config.hud || splashOpen || menuOpen
    splash.hidden = !config.splash || !splashOpen
    menu.hidden = !config.menu || !menuOpen
    root.dataset.gameUiModal = splashOpen ? 'splash' : menuOpen ? 'menu' : 'none'
    options.container.dataset.gameUiEnabled = String(config.enabled)
    options.container.dataset.gameUiModal = root.dataset.gameUiModal
    // Menus are a full-screen reading surface. Keep the field-map chrome (including
    // its clock and close affordance) out of the menu's top-right corner.
    options.container.dataset.gameUiMinimap = String(
      config.minimap && config.hud && !splashOpen && !menuOpen
    )
    dossier?.setSuppressed(!config.enabled || splashOpen || menuOpen)
    journalMenu?.setConfig({ hud: config.hud, minimap: config.minimap })
    setBlocked()
  }

  const closeSplash = () => {
    if (!splashOpen) return
    splashOpen = false
    renderState()
    options.container.focus({ preventScroll: true })
  }

  const openMenu = (tab?: GameUiTab) => {
    if (!config.enabled || !config.menu) return
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    splashOpen = false
    menuOpen = true
    dossier?.close()
    journalMenu?.openTab(normalizeJournalTab(tab))
    renderCopy()
    renderState()
    requestAnimationFrame(() =>
      menuBody.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus()
    )
  }

  const closeMenu = () => {
    if (!menuOpen) return
    menuOpen = false
    renderState()
    previousFocus?.focus({ preventScroll: true })
  }

  const trapFocus = (surface: HTMLElement, event: KeyboardEvent) => {
    const focusable = Array.from(
      surface.querySelectorAll<HTMLButtonElement>('button:not([hidden]):not(:disabled)')
    ).filter((element) => element.offsetParent !== null)
    if (!focusable.length) return
    const current = focusable.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.shiftKey
      ? current <= 0
        ? focusable.length - 1
        : current - 1
      : current === -1 || current === focusable.length - 1
        ? 0
        : current + 1
    focusable[next]?.focus()
  }

  const onClick = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-game-ui-action]')
    if (!target) return
    const action = target.dataset.gameUiAction
    if (action === 'enter' || action === 'continue') closeSplash()
    else if (action === 'close-menu') closeMenu()
    else if (action === 'menu-map') openMenu('map')
    else if (action === 'menu-settings') openMenu('settings')
  }
  root.addEventListener('click', onClick)

  renderCopy()
  renderSnapshot()
  renderState()
  if (splashOpen) requestAnimationFrame(() => enterButton.focus())

  return {
    isBlockingInput: () => splashOpen || menuOpen,
    handleKeyDown(event) {
      if (!config.enabled) return false
      const key = event.key.toLowerCase()
      if (splashOpen) {
        if (key === 'tab') trapFocus(splash, event)
        if ((key === 'enter' || key === ' ') && !event.repeat) closeSplash()
        return true
      }
      if (menuOpen) {
        if (key === 'tab') trapFocus(menu, event)
        else if (key === 'escape' || key === 'm') closeMenu()
        else if (journalMenu?.handleKeyDown(event)) return true
        return true
      }
      if (dossier?.handleKeyDown(event)) return true
      if (key === 'm' && !event.repeat) {
        openMenu()
        return true
      }
      if (key === 'escape' && !event.repeat) return true
      if (key === 'h' && !event.repeat) {
        config = { ...config, hud: !config.hud }
        options.onConfigChange(config)
        renderCopy()
        renderState()
        return true
      }
      if (key === 'n' && !event.repeat) {
        config = { ...config, minimap: !config.minimap }
        options.onConfigChange(config)
        renderCopy()
        renderState()
        return true
      }
      return false
    },
    setConfig(nextConfig) {
      config = nextConfig
      if (!config.enabled) {
        splashOpen = false
        menuOpen = false
      }
      journalMenu?.setConfig({ hud: config.hud, minimap: config.minimap })
      renderState()
    },
    setSnapshot(nextSnapshot) {
      snapshot = nextSnapshot
      renderSnapshot()
      dossier?.setSnapshot(nextSnapshot.character)
      enterButton.hidden = snapshot.restoredSave
      continueButton.hidden = !snapshot.restoredSave
    },
    setLocale(nextLocale) {
      locale = nextLocale
      renderCopy()
      dossier?.setLocale(nextLocale)
    },
    setTheme(nextTheme) {
      root.dataset.theme = nextTheme
      dossier?.setTheme(nextTheme)
    },
    openMenu,
    closeMenu,
    openCharacterPanel(panel = 'overview') {
      dossier?.openPanel(panel)
    },
    destroy() {
      root.removeEventListener('click', onClick)
      root.remove()
      dossier?.destroy()
      dossier = null
      journalMenu?.destroy()
      journalMenu = null
      delete options.container.dataset.gameUiEnabled
      delete options.container.dataset.gameUiModal
      delete options.container.dataset.gameUiMinimap
    },
  }
}
