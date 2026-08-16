import type { LocaleCode } from '@alohayo/config'
import { getGameUiCopy } from './game-ui-copy'

export type JournalTabId = 'save' | 'guide' | 'terrain' | 'bestiary' | 'map' | 'settings'

export interface JournalSaveSnapshot {
  canSave: boolean
  dirty: boolean
  lastSavedAt: string | null
  lastLabel: string | null
  worldSeed: string
  position: string
  discoveredCells: number
  discoveredChunks: number
}

export interface JournalGuideStep {
  key: string
  title: string
  body: string
}

export interface JournalTerrainEntry {
  id: string
  name: string
  family: string
  occurrence: string
  description: string
  movement: string
  roadCost: string
  habitatTags: string[]
  iconicSpecies: string[]
  current: boolean
}

export interface JournalBestiaryEntry {
  id: string
  name: string
  description: string
  tags: string[]
  habitat: string
  status: string
  kind: 'monster' | 'wildlife'
}

export interface JournalLandmarkEntry {
  id: string
  name: string
  kind: string
  description: string
  position: string
}

export interface JournalMenuSnapshot {
  save: JournalSaveSnapshot
  guide: {
    steps: JournalGuideStep[]
    note: string
  }
  terrain: JournalTerrainEntry[]
  bestiary: JournalBestiaryEntry[]
  map: {
    seed: string
    region: string
    biome: string
    position: string
    discoveredCells: number
    discoveredChunks: number
    loadedChunks: number
    landmarks: JournalLandmarkEntry[]
  }
}

export type JournalAction =
  | { type: 'save-progress' }
  | { type: 'open-character' }
  | { type: 'toggle-hud' }
  | { type: 'toggle-minimap' }

export interface JournalMenuController {
  handleKeyDown(event: KeyboardEvent): boolean
  setSnapshot(snapshot: JournalMenuSnapshot): void
  setLocale(locale: LocaleCode): void
  setConfig(config: { hud: boolean; minimap: boolean }): void
  openTab(tab: JournalTabId): void
  getActiveTab(): JournalTabId
  destroy(): void
}

interface CreateJournalMenuOptions {
  container: HTMLElement
  locale: LocaleCode
  snapshot: JournalMenuSnapshot
  config: { hud: boolean; minimap: boolean }
  onAction: (action: JournalAction) => Promise<void> | void
}

const TABS: JournalTabId[] = ['save', 'guide', 'terrain', 'bestiary', 'map', 'settings']

const TAB_COPY: Record<JournalTabId, string> = {
  save: 'JournalTabSave',
  guide: 'JournalTabGuide',
  terrain: 'JournalTabTerrain',
  bestiary: 'JournalTabBestiary',
  map: 'JournalTabMap',
  settings: 'JournalTabSettings',
}

const TAB_GLYPHS: Record<JournalTabId, string> = {
  save: '▣',
  guide: '✦',
  terrain: '⌁',
  bestiary: '◈',
  map: '⌖',
  settings: '⚙',
}

function copy(locale: LocaleCode, key: string): string {
  return getGameUiCopy(locale, key)
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

function textNode(tag: keyof HTMLElementTagNameMap, text: string, className?: string): HTMLElement {
  const node = element(tag, className)
  node.textContent = text
  return node
}

export function createJournalMenu(options: CreateJournalMenuOptions): JournalMenuController {
  let locale = options.locale
  let snapshot = options.snapshot
  let config = options.config
  let activeTab: JournalTabId = 'save'
  let savePending = false
  let saveFeedback: { text: string; error: boolean } | null = null
  let destroyed = false
  let renderedContentKey = ''

  const root = element('div', 'aw-journal')
  root.dataset.journalMenu = 'true'
  const tabs = element('nav', 'aw-journal__tabs')
  tabs.setAttribute('role', 'tablist')
  tabs.setAttribute('aria-label', copy(locale, 'JournalTabsLabel'))
  const content = element('div', 'aw-journal__content')
  root.append(tabs, content)
  options.container.replaceChildren(root)

  const makeButton = (className: string, label: string, action: () => void) => {
    const button = element('button', className)
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', action)
    return button
  }

  const panelHeader = (eyebrow: string, title: string, lead: string) => {
    const header = element('header', 'aw-journal__panel-header')
    header.append(
      textNode('p', eyebrow, 'aw-journal__eyebrow'),
      textNode('h3', title, 'aw-journal__title'),
      textNode('p', lead, 'aw-journal__lead')
    )
    return header
  }

  const section = (title: string, className = 'aw-journal__section') => {
    const node = element('section', className)
    node.appendChild(textNode('h4', title, 'aw-journal__section-title'))
    return node
  }

  const metric = (label: string, value: string | number) => {
    const node = element('div', 'aw-journal__metric aw-journal__field-card')
    node.append(textNode('span', label), textNode('strong', String(value)))
    return node
  }

  const chip = (label: string, tone = '') =>
    textNode('span', label, `aw-journal__chip ${tone}`.trim())

  const renderTabs = () => {
    tabs.replaceChildren()
    TABS.forEach((tab) => {
      const button = makeButton('aw-journal__tab', '', () => openTab(tab))
      button.dataset.journalTab = tab
      button.id = `aw-journal-tab-${tab}`
      button.setAttribute('role', 'tab')
      button.setAttribute('aria-selected', String(activeTab === tab))
      button.setAttribute('aria-controls', `aw-journal-panel-${tab}`)
      button.tabIndex = activeTab === tab ? 0 : -1
      button.append(
        textNode('span', TAB_GLYPHS[tab], 'aw-journal__tab-glyph'),
        textNode('span', copy(locale, TAB_COPY[tab]), 'aw-journal__tab-label')
      )
      tabs.appendChild(button)
    })
    tabs.appendChild(textNode('p', copy(locale, 'JournalTabsHint'), 'aw-journal__tabs-hint'))
  }

  const renderSave = () => {
    const save = snapshot.save
    const panel = element('div', 'aw-journal__panel')
    panel.id = 'aw-journal-panel-save'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', 'aw-journal-tab-save')
    panel.appendChild(
      panelHeader(
        copy(locale, 'JournalEyebrow'),
        copy(locale, 'JournalSaveTitle'),
        copy(locale, 'JournalSaveLead')
      )
    )

    const saveCard = element('section', 'aw-journal__save-card aw-journal__field-card')
    saveCard.dataset.journalSection = 'save'
    const status = element('div', 'aw-journal__save-status')
    status.dataset.journalSaveState = savePending
      ? 'saving'
      : saveFeedback?.error
        ? 'error'
        : saveFeedback
          ? 'saved'
          : save.canSave
            ? save.dirty
              ? 'dirty'
              : 'ready'
            : 'unavailable'
    status.append(
      chip(
        savePending
          ? copy(locale, 'JournalSaveSaving')
          : (saveFeedback?.text ??
              (save.dirty ? copy(locale, 'JournalSaveDirty') : copy(locale, 'JournalSaveClean'))),
        saveFeedback?.error ? 'is-error' : save.dirty || savePending ? 'is-warn' : 'is-ready'
      ),
      textNode(
        'p',
        save.lastSavedAt
          ? `${copy(locale, 'JournalSaveLast')} · ${save.lastLabel ?? copy(locale, 'JournalSaveManual')}`
          : copy(locale, 'JournalSaveNever'),
        'aw-journal__muted'
      )
    )
    const saveButton = makeButton('aw-journal__primary', copy(locale, 'JournalSaveNow'), () => {
      if (savePending || !save.canSave) return
      savePending = true
      saveFeedback = null
      render()
      void Promise.resolve(options.onAction({ type: 'save-progress' }))
        .then(() => {
          if (destroyed) return
          saveFeedback = { text: copy(locale, 'JournalSaveSuccess'), error: false }
        })
        .catch(() => {
          if (destroyed) return
          saveFeedback = { text: copy(locale, 'JournalSaveFailed'), error: true }
        })
        .finally(() => {
          if (destroyed) return
          savePending = false
          render()
        })
    })
    saveButton.dataset.journalAction = 'save-progress'
    saveButton.disabled = savePending || !save.canSave
    saveCard.append(status, saveButton)
    panel.appendChild(saveCard)

    const current = section(copy(locale, 'JournalCurrentWorld'))
    const metrics = element('div', 'aw-journal__metric-grid')
    metrics.append(
      metric(copy(locale, 'JournalWorldSeed'), save.worldSeed),
      metric(copy(locale, 'JournalPosition'), save.position),
      metric(copy(locale, 'JournalCellsCharted'), save.discoveredCells),
      metric(copy(locale, 'JournalFrontiersFound'), save.discoveredChunks)
    )
    current.appendChild(metrics)
    panel.appendChild(current)
    if (!save.canSave)
      panel.appendChild(
        textNode(
          'p',
          copy(locale, 'JournalSaveUnavailable'),
          'aw-journal__notice aw-journal__field-card'
        )
      )
    return panel
  }

  const renderGuide = () => {
    const panel = element('div', 'aw-journal__panel')
    panel.dataset.journalSection = 'tour'
    panel.id = 'aw-journal-panel-guide'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', 'aw-journal-tab-guide')
    panel.appendChild(
      panelHeader(
        copy(locale, 'JournalEyebrow'),
        copy(locale, 'JournalGuideTitle'),
        copy(locale, 'JournalGuideLead')
      )
    )
    const steps = element('div', 'aw-journal__guide-grid')
    snapshot.guide.steps.forEach((step, index) => {
      const card = element('article', 'aw-journal__guide-card aw-journal__field-card')
      card.append(
        textNode('span', String(index + 1).padStart(2, '0'), 'aw-journal__card-index'),
        textNode('kbd', step.key, 'aw-journal__key'),
        textNode('h4', step.title),
        textNode('p', step.body, 'aw-journal__muted')
      )
      steps.appendChild(card)
    })
    panel.appendChild(steps)
    const note = element('div', 'aw-journal__callout aw-journal__field-card')
    note.append(
      textNode('strong', copy(locale, 'JournalGuideNoteTitle')),
      textNode('p', snapshot.guide.note)
    )
    const characterButton = makeButton(
      'aw-journal__secondary',
      copy(locale, 'JournalOpenCharacter'),
      () => options.onAction({ type: 'open-character' })
    )
    note.appendChild(characterButton)
    panel.appendChild(note)
    return panel
  }

  const renderTerrain = () => {
    const panel = element('div', 'aw-journal__panel')
    panel.dataset.journalSection = 'terrain'
    panel.id = 'aw-journal-panel-terrain'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', 'aw-journal-tab-terrain')
    panel.appendChild(
      panelHeader(
        copy(locale, 'JournalEyebrow'),
        copy(locale, 'JournalTerrainTitle'),
        copy(locale, 'JournalTerrainLead')
      )
    )
    const list = element('div', 'aw-journal__manual-grid')
    if (!snapshot.terrain.length) {
      list.appendChild(
        textNode(
          'p',
          copy(locale, 'JournalTerrainEmpty'),
          'aw-journal__notice aw-journal__field-card'
        )
      )
    }
    snapshot.terrain.forEach((entry) => {
      const card = element(
        'article',
        `aw-journal__manual-card aw-journal__field-card${entry.current ? ' is-current' : ''}`
      )
      card.dataset.journalEntryId = entry.id
      card.dataset.journalEntryStatus = entry.current ? 'current' : 'available'
      const header = element('header', 'aw-journal__manual-card-header')
      const title = element('div')
      title.append(textNode('h4', entry.name), textNode('span', entry.id, 'aw-journal__id'))
      header.append(
        title,
        chip(entry.current ? copy(locale, 'JournalCurrent') : copy(locale, 'JournalReference'))
      )
      card.appendChild(header)
      card.appendChild(textNode('p', entry.description, 'aw-journal__muted'))
      const facts = element('div', 'aw-journal__fact-list')
      facts.append(
        textNode('p', `${copy(locale, 'JournalTerrainFamily')}: ${entry.family}`),
        textNode('p', `${copy(locale, 'JournalTerrainRarity')}: ${entry.occurrence}`),
        textNode('p', `${copy(locale, 'JournalTerrainMovement')}: ${entry.movement}`),
        textNode('p', `${copy(locale, 'JournalTerrainRoad')}: ${entry.roadCost}`)
      )
      card.appendChild(facts)
      if (entry.habitatTags.length) {
        const hazards = element('div', 'aw-journal__tag-list')
        hazards.appendChild(
          textNode('span', `${copy(locale, 'JournalTerrainHazards')}:`, 'aw-journal__tag-label')
        )
        entry.habitatTags.forEach((tag) => hazards.appendChild(chip(tag, 'is-warn')))
        card.appendChild(hazards)
      }
      if (entry.iconicSpecies.length) {
        card.appendChild(
          textNode(
            'p',
            `${copy(locale, 'JournalTerrainEntry')}: ${entry.iconicSpecies.join(', ')}`,
            'aw-journal__entry-note'
          )
        )
      }
      list.appendChild(card)
    })
    panel.appendChild(list)
    panel.appendChild(
      textNode(
        'p',
        copy(locale, 'JournalTerrainSourceNote'),
        'aw-journal__notice aw-journal__field-card'
      )
    )
    return panel
  }

  const renderBestiary = () => {
    const panel = element('div', 'aw-journal__panel')
    panel.dataset.journalSection = 'wildlife'
    panel.id = 'aw-journal-panel-bestiary'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', 'aw-journal-tab-bestiary')
    panel.appendChild(
      panelHeader(
        copy(locale, 'JournalEyebrow'),
        copy(locale, 'JournalBestiaryTitle'),
        copy(locale, 'JournalBestiaryLead')
      )
    )
    const notice = element('div', 'aw-journal__callout aw-journal__field-card')
    notice.append(
      textNode('strong', copy(locale, 'JournalEncounterLedgerTitle')),
      textNode('p', copy(locale, 'JournalEncounterLedgerUnavailable'))
    )
    notice.dataset.journalEntryStatus = 'unavailable'
    panel.appendChild(notice)
    const monsterEntries = snapshot.bestiary.filter((entry) => entry.kind === 'monster')
    const wildlifeEntries = snapshot.bestiary.filter((entry) => entry.kind === 'wildlife')
    const renderEntries = (title: string, entries: JournalBestiaryEntry[]) => {
      const group = section(title, 'aw-journal__section aw-journal__bestiary-group')
      const grid = element('div', 'aw-journal__manual-grid')
      entries.forEach((entry) => {
        const card = element('article', 'aw-journal__manual-card aw-journal__field-card')
        card.dataset.journalEntryKind = entry.kind
        const header = element('header', 'aw-journal__manual-card-header')
        const titleNode = element('div')
        titleNode.append(
          textNode('h4', entry.name),
          textNode('span', entry.status, 'aw-journal__id')
        )
        header.append(titleNode, chip(entry.habitat))
        card.append(header, textNode('p', entry.description, 'aw-journal__muted'))
        if (entry.tags.length) {
          const tags = element('div', 'aw-journal__tag-list')
          entry.tags.forEach((tag) => tags.appendChild(chip(tag)))
          card.appendChild(tags)
        }
        grid.appendChild(card)
      })
      if (!entries.length)
        grid.appendChild(
          textNode(
            'p',
            copy(locale, 'JournalBestiaryEmpty'),
            'aw-journal__notice aw-journal__field-card'
          )
        )
      group.appendChild(grid)
      return group
    }
    panel.appendChild(renderEntries(copy(locale, 'JournalMonsterRegistry'), monsterEntries))
    panel.appendChild(renderEntries(copy(locale, 'JournalWildlifeIndex'), wildlifeEntries))
    return panel
  }

  const renderMap = () => {
    const panel = element('div', 'aw-journal__panel')
    panel.dataset.journalSection = 'map-notes'
    panel.id = 'aw-journal-panel-map'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', 'aw-journal-tab-map')
    panel.appendChild(
      panelHeader(
        copy(locale, 'JournalEyebrow'),
        copy(locale, 'JournalMapTitle'),
        copy(locale, 'JournalMapLead')
      )
    )
    const metrics = element('div', 'aw-journal__metric-grid')
    metrics.append(
      metric(copy(locale, 'JournalWorldSeed'), snapshot.map.seed),
      metric(copy(locale, 'JournalRegion'), snapshot.map.region),
      metric(copy(locale, 'JournalBiome'), snapshot.map.biome),
      metric(copy(locale, 'JournalPosition'), snapshot.map.position),
      metric(copy(locale, 'JournalCellsCharted'), snapshot.map.discoveredCells),
      metric(copy(locale, 'JournalFrontiersFound'), snapshot.map.discoveredChunks),
      metric(copy(locale, 'JournalLoadedChunks'), snapshot.map.loadedChunks)
    )
    panel.appendChild(metrics)
    const landmarks = section(copy(locale, 'JournalLoadedLandmarks'))
    if (!snapshot.map.landmarks.length) {
      landmarks.appendChild(
        textNode(
          'p',
          copy(locale, 'JournalNoLandmarks'),
          'aw-journal__notice aw-journal__field-card'
        )
      )
    } else {
      const list = element('div', 'aw-journal__landmark-list')
      snapshot.map.landmarks.forEach((landmark) => {
        const card = element('article', 'aw-journal__landmark-card aw-journal__field-card')
        card.append(
          textNode('span', landmark.kind, 'aw-journal__id'),
          textNode('h4', landmark.name),
          textNode('p', landmark.description, 'aw-journal__muted'),
          textNode('small', landmark.position)
        )
        list.appendChild(card)
      })
      landmarks.appendChild(list)
    }
    panel.appendChild(landmarks)
    return panel
  }

  const renderSettings = () => {
    const panel = element('div', 'aw-journal__panel')
    panel.dataset.journalSection = 'settings'
    panel.id = 'aw-journal-panel-settings'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', 'aw-journal-tab-settings')
    panel.appendChild(
      panelHeader(
        copy(locale, 'JournalEyebrow'),
        copy(locale, 'JournalSettingsTitle'),
        copy(locale, 'JournalSettingsLead')
      )
    )
    const settings = section(copy(locale, 'JournalInterface'))
    const rows = element('div', 'aw-journal__settings-list')
    const hudRow = element('div', 'aw-journal__settings-row aw-journal__field-card')
    hudRow.append(
      textNode('div', copy(locale, 'JournalHudSetting'), 'aw-journal__settings-copy'),
      makeButton(
        'aw-journal__secondary',
        config.hud ? copy(locale, 'JournalHideHud') : copy(locale, 'JournalShowHud'),
        () => options.onAction({ type: 'toggle-hud' })
      )
    )
    const mapRow = element('div', 'aw-journal__settings-row aw-journal__field-card')
    mapRow.append(
      textNode('div', copy(locale, 'JournalMapSetting'), 'aw-journal__settings-copy'),
      makeButton(
        'aw-journal__secondary',
        config.minimap ? copy(locale, 'JournalHideMap') : copy(locale, 'JournalShowMap'),
        () => options.onAction({ type: 'toggle-minimap' })
      )
    )
    rows.append(hudRow, mapRow)
    settings.appendChild(rows)
    panel.appendChild(settings)
    return panel
  }

  const render = () => {
    renderTabs()
    content.replaceChildren(
      activeTab === 'save'
        ? renderSave()
        : activeTab === 'guide'
          ? renderGuide()
          : activeTab === 'terrain'
            ? renderTerrain()
            : activeTab === 'bestiary'
              ? renderBestiary()
              : activeTab === 'map'
                ? renderMap()
                : renderSettings()
    )
    renderedContentKey =
      activeTab === 'save'
        ? JSON.stringify(snapshot.save)
        : activeTab === 'map'
          ? JSON.stringify(snapshot.map)
          : ''
  }

  const openTab = (tab: JournalTabId) => {
    if (destroyed) return
    activeTab = tab
    render()
    const button = tabs.querySelector<HTMLButtonElement>(`[data-journal-tab="${tab}"]`)
    button?.focus({ preventScroll: true })
  }

  const controller: JournalMenuController = {
    handleKeyDown(event) {
      const key = event.key.toLowerCase()
      const numericTab = Number(key) - 1
      if (numericTab >= 0 && numericTab < TABS.length) {
        event.preventDefault()
        openTab(TABS[numericTab]!)
        return true
      }
      if (key === 'q' || key === 'arrowleft') {
        event.preventDefault()
        openTab(TABS[(TABS.indexOf(activeTab) - 1 + TABS.length) % TABS.length]!)
        return true
      }
      if (key === 'e' || key === 'arrowright') {
        event.preventDefault()
        openTab(TABS[(TABS.indexOf(activeTab) + 1) % TABS.length]!)
        return true
      }
      if (key === 'home' || key === 'end') {
        event.preventDefault()
        openTab(key === 'home' ? TABS[0]! : TABS[TABS.length - 1]!)
        return true
      }
      return false
    },
    setSnapshot(nextSnapshot) {
      if (destroyed) return
      const previousContentKey = renderedContentKey
      snapshot = nextSnapshot
      const nextContentKey =
        activeTab === 'save'
          ? JSON.stringify(snapshot.save)
          : activeTab === 'map'
            ? JSON.stringify(snapshot.map)
            : ''
      if ((activeTab === 'save' || activeTab === 'map') && nextContentKey !== previousContentKey) {
        render()
      }
    },
    setLocale(nextLocale) {
      if (destroyed) return
      locale = nextLocale
      render()
    },
    setConfig(nextConfig) {
      if (destroyed) return
      config = nextConfig
      render()
    },
    openTab,
    getActiveTab: () => activeTab,
    destroy() {
      destroyed = true
      root.remove()
    },
  }

  render()
  return controller
}
