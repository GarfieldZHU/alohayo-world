import type { GameUiTab, LocaleCode } from '@alohayo/config'
import type { ResolvedGameUiOptions } from './game-ui-config'
import { getGameUiCopy } from './game-ui-copy'

const TABS: GameUiTab[] = ['journey', 'party', 'gear', 'bestiary', 'map', 'settings']

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
}

interface CreateGameUiOptions {
  container: HTMLElement
  config: ResolvedGameUiOptions
  locale: LocaleCode
  snapshot: GameUiSnapshot
  onBlockingChange: (blocked: boolean) => void
  onConfigChange: (config: ResolvedGameUiOptions) => void
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
  let activeTab: GameUiTab = 'journey'
  let locale = options.locale
  let previousFocus: HTMLElement | null = null

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

  const compassButton = button('aw-game-ui__compass', 'menu-map')
  compassButton.setAttribute('aria-label', 'Open world map')
  compassButton.innerHTML = '<span aria-hidden="true">N</span><i aria-hidden="true"></i>'
  hud.append(identity, location, compassButton)

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
  const tabList = document.createElement('div')
  tabList.className = 'aw-game-ui__tabs'
  tabList.setAttribute('role', 'tablist')
  const tabButtons = new Map<GameUiTab, HTMLButtonElement>()
  TABS.forEach((tab) => {
    const tabButton = button('aw-game-ui__tab', `tab-${tab}`)
    tabButton.dataset.gameUiTab = tab
    tabButton.setAttribute('role', 'tab')
    tabButtons.set(tab, tabButton)
    tabList.appendChild(tabButton)
  })
  const panel = document.createElement('div')
  panel.className = 'aw-game-ui__panel'
  panel.setAttribute('role', 'tabpanel')
  menuBody.append(tabList, panel)
  const menuFooter = document.createElement('footer')
  menuFooter.innerHTML = '<span>Q / E</span><span>Esc</span>'
  menuFrame.append(menuHeader, menuBody, menuFooter)
  menu.append(menuFrame)
  root.append(hud, splash, menu)
  options.container.appendChild(root)

  const text = (key: string) => getGameUiCopy(locale, key)
  const setBlocked = () => options.onBlockingChange(splashOpen || menuOpen)

  const renderPanel = () => {
    panel.replaceChildren()
    const heading = document.createElement('h3')
    heading.textContent = text(`Tab${activeTab[0]!.toUpperCase()}${activeTab.slice(1)}`)
    const lead = document.createElement('p')
    lead.className = 'aw-game-ui__panel-lead'
    lead.textContent = text(`Panel${activeTab[0]!.toUpperCase()}${activeTab.slice(1)}`)
    panel.append(heading, lead)

    const stats = document.createElement('dl')
    stats.className = 'aw-game-ui__stats'
    const entries: Array<[string, string | number]> =
      activeTab === 'journey'
        ? [
            [text('Region'), snapshot.region],
            [text('Biome'), snapshot.biome],
            [text('Discovered'), snapshot.discoveredCells],
            [text('Position'), snapshot.position],
          ]
        : activeTab === 'party'
          ? [
              [text('Explorer'), snapshot.explorerName],
              [text('State'), snapshot.state],
              [text('Role'), text('Wayfinder')],
            ]
          : activeTab === 'gear'
            ? snapshot.gear.length
              ? snapshot.gear.map((item, index) => [`${text('Relic')} ${index + 1}`, item])
              : [[text('Relic'), text('None')]]
            : activeTab === 'map'
              ? [
                  [text('Seed'), snapshot.worldSeed],
                  [text('DiscoveredChunks'), snapshot.discoveredChunks],
                  [text('LoadedChunks'), snapshot.loadedChunks],
                ]
              : activeTab === 'settings'
                ? [
                    [text('Controls'), text('ControlsValue')],
                    [text('Interface'), text('InterfaceValue')],
                  ]
                : [[text('Bestiary'), text('BestiaryEmpty')]]
    entries.forEach(([label, value]) => {
      const term = document.createElement('dt')
      term.textContent = String(label)
      const detail = document.createElement('dd')
      detail.textContent = String(value)
      stats.append(term, detail)
    })
    panel.appendChild(stats)
    if (activeTab === 'settings') {
      const hudToggle = button('aw-game-ui__secondary aw-game-ui__panel-action', 'toggle-hud')
      hudToggle.textContent = config.hud ? text('HideHud') : text('ShowHud')
      panel.appendChild(hudToggle)
    }
  }

  const renderCopy = () => {
    hud.setAttribute('aria-label', text('HudLabel'))
    compassButton.setAttribute('aria-label', text('OpenMap'))
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
    TABS.forEach((tab) => {
      const title = tab[0]!.toUpperCase() + tab.slice(1)
      tabButtons.get(tab)!.textContent = text(`Tab${title}`)
    })
    renderPanel()
  }

  const renderSnapshot = () => {
    explorerName.textContent = snapshot.explorerName
    explorerState.textContent = snapshot.state
    regionName.textContent = snapshot.region
    biomeName.textContent = snapshot.biome
    renderPanel()
  }

  const renderState = () => {
    root.hidden = !config.enabled
    hud.hidden = !config.hud || splashOpen || menuOpen
    splash.hidden = !config.splash || !splashOpen
    menu.hidden = !config.menu || !menuOpen
    root.dataset.gameUiModal = splashOpen ? 'splash' : menuOpen ? 'menu' : 'none'
    options.container.dataset.gameUiEnabled = String(config.enabled)
    options.container.dataset.gameUiModal = root.dataset.gameUiModal
    tabButtons.forEach((tabButton, tab) => {
      const selected = tab === activeTab
      tabButton.setAttribute('aria-selected', String(selected))
      tabButton.tabIndex = selected ? 0 : -1
    })
    setBlocked()
  }

  const closeSplash = () => {
    if (!splashOpen) return
    splashOpen = false
    renderState()
    options.container.focus({ preventScroll: true })
  }

  const openMenu = (tab: GameUiTab = activeTab) => {
    if (!config.enabled || !config.menu) return
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    splashOpen = false
    menuOpen = true
    activeTab = tab
    renderCopy()
    renderState()
    requestAnimationFrame(() => tabButtons.get(activeTab)?.focus())
  }

  const closeMenu = () => {
    if (!menuOpen) return
    menuOpen = false
    renderState()
    previousFocus?.focus({ preventScroll: true })
  }

  const shiftTab = (amount: number) => {
    const index = TABS.indexOf(activeTab)
    activeTab = TABS[(index + amount + TABS.length) % TABS.length]!
    renderCopy()
    renderState()
    tabButtons.get(activeTab)?.focus()
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
    else if (action === 'toggle-hud') {
      config = { ...config, hud: !config.hud }
      options.onConfigChange(config)
      renderCopy()
      renderState()
    } else if (action?.startsWith('tab-')) {
      activeTab = action.slice(4) as GameUiTab
      renderCopy()
      renderState()
    }
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
        else if (key === 'q' || key === 'arrowleft') shiftTab(-1)
        else if (key === 'e' || key === 'arrowright') shiftTab(1)
        else if (key === 'home') {
          activeTab = TABS[0]!
          renderCopy()
          renderState()
          tabButtons.get(activeTab)?.focus()
        } else if (key === 'end') {
          activeTab = TABS[TABS.length - 1]!
          renderCopy()
          renderState()
          tabButtons.get(activeTab)?.focus()
        }
        return true
      }
      if ((key === 'escape' || key === 'm') && !event.repeat) {
        openMenu()
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
      renderState()
    },
    setSnapshot(nextSnapshot) {
      snapshot = nextSnapshot
      renderSnapshot()
      enterButton.hidden = snapshot.restoredSave
      continueButton.hidden = !snapshot.restoredSave
    },
    setLocale(nextLocale) {
      locale = nextLocale
      renderCopy()
    },
    setTheme(nextTheme) {
      root.dataset.theme = nextTheme
    },
    openMenu,
    closeMenu,
    destroy() {
      root.removeEventListener('click', onClick)
      root.remove()
      delete options.container.dataset.gameUiEnabled
      delete options.container.dataset.gameUiModal
    },
  }
}
