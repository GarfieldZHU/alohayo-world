import type { LocaleCode } from '@alohayo/config'
import { getGameUiCopy } from './game-ui-copy'

export type CharacterDossierPanelId = 'overview' | 'abilities' | 'equipment' | 'skills' | 'systems'

export interface CharacterDossierAbility {
  id: string
  name: string
  abbreviation: string
  description: string
  group: string
  value: number
  minimum: number
  maximum: number
}

export interface CharacterDossierEquipmentOption {
  id: string | null
  name: string
  tags: string[]
  modifiers: Record<string, number>
  appearanceColor: string
  appearanceShape: string
  shareable: boolean
}

export interface CharacterDossierEquipmentSlot {
  slotId: string
  slotName: string
  kind: string
  itemId: string | null
  itemName: string
  itemTags: string[]
  itemModifiers: Record<string, number>
  itemColor: string
  itemShape: string
  shared: boolean
  options: CharacterDossierEquipmentOption[]
}

export interface CharacterDossierItem {
  id: string
  name: string
  tags: string[]
  allowedSlots: string[]
  modifiers: Record<string, number>
  appearanceColor: string
  appearanceShape: string
  shareable: boolean
  equippedSlotId: string | null
}

export interface CharacterDossierSkill {
  id: string
  name: string
  description: string
  source: string
  status: string
}

export interface CharacterDossierSnapshot {
  id: string
  name: string
  archetype: string
  role: string
  description: string
  position: string
  state: string
  biome: string
  region: string
  activeWeaponSlot: string | null
  activeWeaponName: string
  walkSpeed: number
  runMultiplier: number
  actionRange: number
  tags: string[]
  abilities: CharacterDossierAbility[]
  abilityPointsAvailable: number
  equipment: CharacterDossierEquipmentSlot[]
  items: CharacterDossierItem[]
  skills: CharacterDossierSkill[]
  field: {
    loadedChunks: number
    discoveredChunks: number
    discoveredCells: number
    traversalReady: boolean
    traversalNote: string
  }
}

export type CharacterDossierAction =
  | { type: 'apply-abilities'; abilities: Record<string, number> }
  | { type: 'equip'; slotId: string; itemId: string | null }
  | { type: 'active-weapon'; slotId: string }

interface CreateCharacterDossierOptions {
  container: HTMLElement
  locale: LocaleCode
  snapshot: CharacterDossierSnapshot
  onAction: (action: CharacterDossierAction) => void
  onInteractionStart?: () => void
}

export interface CharacterDossierController {
  handleKeyDown(event: KeyboardEvent): boolean
  setSnapshot(snapshot: CharacterDossierSnapshot): void
  setLocale(locale: LocaleCode): void
  setTheme(theme: 'light' | 'dark'): void
  setSuppressed(suppressed: boolean): void
  openPanel(panel: CharacterDossierPanelId): void
  close(): void
  isOpen(): boolean
  destroy(): void
}

const PANEL_ORDER: CharacterDossierPanelId[] = [
  'overview',
  'abilities',
  'equipment',
  'skills',
  'systems',
]

const PANEL_KEYS: Record<CharacterDossierPanelId, string> = {
  overview: 'CharacterOverview',
  abilities: 'CharacterAbilities',
  equipment: 'CharacterEquipment',
  skills: 'CharacterSkills',
  systems: 'CharacterSystems',
}

const PANEL_SHORTCUTS: Record<CharacterDossierPanelId, string> = {
  overview: '1',
  abilities: '2',
  equipment: '3',
  skills: '4',
  systems: '5',
}

const PANEL_GLYPHS: Record<CharacterDossierPanelId, string> = {
  overview: '✦',
  abilities: '⊹',
  equipment: '◈',
  skills: '✧',
  systems: '⌁',
}

const ABILITY_GROUP_ORDER = ['physical', 'mental', 'social', 'fortune']

const ITEM_GLYPHS: Record<string, string> = {
  cap: '⌂',
  shirt: '◇',
  coat: '◈',
  gloves: '≋',
  belt: '━',
  pants: '⋮',
  boots: '⌁',
  'round-glasses': '⊙',
  pendant: '✦',
  ring: '○',
  watch: '◷',
  staff: '∥',
  'short-blade': '╱',
  bow: '⌒',
  hatchet: '†',
}

function cloneEquipment(
  equipment: CharacterDossierEquipmentSlot[]
): CharacterDossierEquipmentSlot[] {
  return equipment.map((slot) => ({
    ...slot,
    options: slot.options.map((option) => ({ ...option })),
  }))
}

function copy(locale: LocaleCode, key: string): string {
  return getGameUiCopy(locale, key)
}

function titleCase(value: string): string {
  return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : value
}

function groupLabel(locale: LocaleCode, group: string): string {
  return copy(locale, `CharacterGroup${titleCase(group)}`)
}

function itemGlyph(shape: string): string {
  return ITEM_GLYPHS[shape] ?? '◇'
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

export function createCharacterDossier(
  options: CreateCharacterDossierOptions
): CharacterDossierController {
  let locale = options.locale
  let snapshot = options.snapshot
  let suppressed = false
  let dossierOpen = false
  let activePanel: CharacterDossierPanelId = 'overview'
  const panelOpen = new Map<CharacterDossierPanelId, boolean>(
    PANEL_ORDER.map((panel) => [panel, panel === 'overview'])
  )
  const panelCollapsed = new Map<CharacterDossierPanelId, boolean>(
    PANEL_ORDER.map((panel) => [panel, false])
  )

  let draftCharacterId = snapshot.id
  let baseAbilities = Object.fromEntries(
    snapshot.abilities.map((ability) => [ability.id, ability.value])
  )
  let abilityBaseline = { ...baseAbilities }
  let draftAbilities = { ...baseAbilities }
  let hasPendingAbilityChanges = false
  let hasCommittedAbilityPreview = false
  let draftEquipment = cloneEquipment(snapshot.equipment)
  let draftActiveWeaponSlot = snapshot.activeWeaponSlot
  let hasEquipmentPreview = false
  let destroyed = false

  const root = element('div', 'aw-character-dossier')
  root.dataset.characterDossier = 'true'
  root.dataset.gameUiSurface = 'character-dock'
  root.dataset.characterPanelMode = 'preview'
  root.setAttribute('aria-label', copy(locale, 'CharacterDossier'))
  root.hidden = true

  const rail = element('nav', 'aw-character-dossier__rail')
  rail.setAttribute('aria-label', copy(locale, 'CharacterPanels'))
  root.appendChild(rail)

  const stack = element('div', 'aw-character-dossier__stack')
  root.appendChild(stack)
  options.container.appendChild(root)

  const syncDraftAbilities = (next: CharacterDossierSnapshot) => {
    if (draftCharacterId !== next.id) {
      draftCharacterId = next.id
      baseAbilities = Object.fromEntries(
        next.abilities.map((ability) => [ability.id, ability.value])
      )
      abilityBaseline = { ...baseAbilities }
      draftAbilities = { ...baseAbilities }
      hasPendingAbilityChanges = false
      hasCommittedAbilityPreview = false
      draftEquipment = cloneEquipment(next.equipment)
      draftActiveWeaponSlot = next.activeWeaponSlot
      hasEquipmentPreview = false
      return
    }
    if (!hasPendingAbilityChanges && !hasCommittedAbilityPreview) {
      baseAbilities = Object.fromEntries(
        next.abilities.map((ability) => [ability.id, ability.value])
      )
      abilityBaseline = { ...baseAbilities }
      draftAbilities = { ...baseAbilities }
    }
    if (!hasEquipmentPreview) {
      draftEquipment = cloneEquipment(next.equipment)
      draftActiveWeaponSlot = next.activeWeaponSlot
    }
  }

  const makeButton = (className: string, label: string, action: () => void) => {
    const button = element('button', className)
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', action)
    return button
  }

  const setPanelState = (panel: CharacterDossierPanelId, open: boolean) => {
    panelOpen.set(panel, open)
    if (open) {
      if (!dossierOpen) options.onInteractionStart?.()
      dossierOpen = true
      activePanel = panel
    }
    render()
  }

  const renderRail = () => {
    rail.replaceChildren()
    PANEL_ORDER.forEach((panel) => {
      const button = makeButton(
        `aw-character-dossier__rail-button${activePanel === panel ? ' is-active' : ''}`,
        '',
        () => setPanelState(panel, true)
      )
      const glyph = element('span', 'aw-character-dossier__rail-glyph')
      glyph.textContent = PANEL_GLYPHS[panel]
      glyph.setAttribute('aria-hidden', 'true')
      const shortcut = element('small', 'aw-character-dossier__rail-key')
      shortcut.textContent = PANEL_SHORTCUTS[panel]
      button.append(glyph, shortcut)
      button.title = `${copy(locale, PANEL_KEYS[panel])} (${PANEL_SHORTCUTS[panel]})`
      button.setAttribute('aria-label', button.title)
      button.setAttribute('aria-pressed', String(panelOpen.get(panel) === true))
      button.dataset.characterPanelShortcut = PANEL_SHORTCUTS[panel]
      rail.appendChild(button)
    })
    const hint = element('small', 'aw-character-dossier__rail-hint')
    hint.textContent = copy(locale, 'CharacterShortcutHint')
    rail.appendChild(hint)
  }

  const renderPanelShell = (
    panel: CharacterDossierPanelId,
    content: HTMLElement,
    count?: string
  ) => {
    if (!panelOpen.get(panel)) return
    const article = element('article', 'aw-character-dossier__panel')
    article.dataset.characterPanel = panel
    article.dataset.characterSection = panel
    article.dataset.collapsed = String(panelCollapsed.get(panel) === true)
    const header = element('header', 'aw-character-dossier__panel-header')
    const titleGroup = element('div', 'aw-character-dossier__panel-title-group')
    const title = element('h2')
    title.textContent = copy(locale, PANEL_KEYS[panel])
    titleGroup.append(title)
    if (count) {
      const countNode = element('span', 'aw-character-dossier__panel-count')
      countNode.textContent = count
      titleGroup.appendChild(countNode)
    }
    const actions = element('div', 'aw-character-dossier__panel-actions')
    const collapsed = panelCollapsed.get(panel) === true
    const collapseButton = makeButton(
      'aw-character-dossier__icon-button',
      collapsed ? '＋' : '−',
      () => {
        panelCollapsed.set(panel, !collapsed)
        render()
      }
    )
    collapseButton.setAttribute('aria-expanded', String(!collapsed))
    collapseButton.dataset.characterPanelAction = 'collapse'
    collapseButton.dataset.characterPanelControl = panel
    collapseButton.setAttribute(
      'aria-label',
      collapsed ? copy(locale, 'CharacterExpand') : copy(locale, 'CharacterCollapse')
    )
    collapseButton.title = collapseButton.getAttribute('aria-label') ?? ''
    const closeButton = makeButton('aw-character-dossier__icon-button is-close', '×', () => {
      panelOpen.set(panel, false)
      render()
    })
    closeButton.setAttribute('aria-label', copy(locale, 'CharacterClosePanel'))
    closeButton.title = closeButton.getAttribute('aria-label') ?? ''
    closeButton.dataset.characterPanelAction = 'close'
    closeButton.dataset.characterPanelControl = panel
    actions.append(collapseButton, closeButton)
    header.append(titleGroup, actions)
    article.appendChild(header)
    if (!collapsed) {
      content.id = `aw-character-dossier-${panel}-content`
      content.classList.add('aw-character-dossier__panel-content')
      collapseButton.setAttribute('aria-controls', content.id)
      article.appendChild(content)
    }
    stack.appendChild(article)
  }

  const renderOverview = () => {
    const content = element('div')
    const identity = element('div', 'aw-character-dossier__identity-card')
    const sigil = element('div', 'aw-character-dossier__identity-sigil')
    sigil.textContent = snapshot.name.slice(0, 1).toUpperCase()
    sigil.setAttribute('aria-hidden', 'true')
    const copyNode = element('div')
    const name = element('strong')
    name.textContent = snapshot.name
    const subtitle = element('span')
    subtitle.textContent = `${snapshot.archetype} · ${snapshot.role}`
    copyNode.append(name, subtitle)
    identity.append(sigil, copyNode)
    content.appendChild(identity)

    const description = element('p', 'aw-character-dossier__muted')
    description.textContent = snapshot.description
    content.appendChild(description)

    const stats = element('div', 'aw-character-dossier__stat-grid')
    const activeWeapon = draftEquipment.find((slot) => slot.slotId === draftActiveWeaponSlot)
    ;[
      [copy(locale, 'CharacterState'), snapshot.state],
      [copy(locale, 'CharacterPosition'), snapshot.position],
      [copy(locale, 'CharacterTerrain'), `${snapshot.biome} · ${snapshot.region}`],
      [copy(locale, 'CharacterWeapon'), activeWeapon?.itemName ?? snapshot.activeWeaponName],
    ].forEach(([label, value]) => {
      const stat = element('div')
      const term = element('span')
      term.textContent = String(label)
      const detail = element('strong')
      detail.textContent = String(value)
      stat.append(term, detail)
      stats.appendChild(stat)
    })
    content.appendChild(stats)
    const tags = element('div', 'aw-character-dossier__tag-list')
    snapshot.tags.forEach((tag) => {
      const badge = element('span', 'aw-character-dossier__tag')
      badge.textContent = tag
      tags.appendChild(badge)
    })
    content.appendChild(tags)
    renderPanelShell('overview', content)
  }

  const renderAbilities = () => {
    const content = element('div')
    const spent = Object.entries(draftAbilities).reduce(
      (total, [id, value]) => total + Math.max(0, value - (abilityBaseline[id] ?? value)),
      0
    )
    const remaining = Math.max(0, snapshot.abilityPointsAvailable - spent)
    const summary = element('section', 'aw-character-dossier__point-summary')
    summary.dataset.characterPreviewPoints = String(remaining)
    const summaryHeading = element('div', 'aw-character-dossier__point-heading')
    const pointLabel = element('span')
    pointLabel.textContent = copy(locale, 'CharacterPointReserve')
    const pointValue = element('strong')
    pointValue.textContent = String(remaining)
    summaryHeading.append(pointLabel, pointValue)
    summary.appendChild(summaryHeading)
    const preview = element('small')
    preview.textContent = copy(locale, 'CharacterPointsPreview')
    summary.appendChild(preview)
    const reserveTrack = element('div', 'aw-character-dossier__point-track')
    reserveTrack.setAttribute('aria-label', copy(locale, 'CharacterPointReserve'))
    reserveTrack.style.gridTemplateColumns = `repeat(${Math.max(snapshot.abilityPointsAvailable, 1)}, minmax(0, 1fr))`
    for (let index = 0; index < Math.max(snapshot.abilityPointsAvailable, 1); index += 1) {
      const pip = element('span')
      pip.className = index < remaining ? 'is-available' : 'is-spent'
      reserveTrack.appendChild(pip)
    }
    summary.appendChild(reserveTrack)
    content.appendChild(summary)

    const facts = element('div', 'aw-character-dossier__ability-facts')
    const factData: Array<[string, string]> = [
      [copy(locale, 'CharacterAllocated'), String(spent)],
      [copy(locale, 'CharacterMeasures'), String(snapshot.abilities.length)],
      [
        copy(locale, 'CharacterGroups'),
        String(new Set(snapshot.abilities.map((ability) => ability.group)).size),
      ],
    ]
    factData.forEach(([label, value]) => {
      const fact = element('div')
      const factLabel = element('span')
      factLabel.textContent = label
      const factValue = element('strong')
      factValue.textContent = value
      fact.append(factLabel, factValue)
      facts.appendChild(fact)
    })
    content.appendChild(facts)

    const groups = [
      ...ABILITY_GROUP_ORDER,
      ...new Set(
        snapshot.abilities
          .map((ability) => ability.group)
          .filter((group) => !ABILITY_GROUP_ORDER.includes(group))
      ),
    ]
    groups.forEach((group) => {
      const abilities = snapshot.abilities.filter((ability) => ability.group === group)
      if (!abilities.length) return
      const section = element('section', 'aw-character-dossier__ability-group')
      section.dataset.characterAbilityGroup = group
      const groupHeader = element('div', 'aw-character-dossier__ability-group-header')
      const groupTitle = element('h3')
      groupTitle.textContent = groupLabel(locale, group)
      const groupMeta = element('span')
      groupMeta.textContent = `${abilities.length} ${copy(locale, 'CharacterMeasuresShort')}`
      groupHeader.append(groupTitle, groupMeta)
      section.appendChild(groupHeader)

      const list = element('div', 'aw-character-dossier__ability-list')
      abilities.forEach((ability) => {
        const value = draftAbilities[ability.id] ?? ability.value
        const row = element('article', 'aw-character-dossier__ability-row')
        row.dataset.characterAbilityId = ability.id
        const heading = element('div', 'aw-character-dossier__ability-heading')
        const label = element('div', 'aw-character-dossier__ability-label')
        const abbreviation = element('span', 'aw-character-dossier__ability-abbr')
        abbreviation.textContent = ability.abbreviation
        const name = element('strong')
        name.textContent = ability.name
        const groupBadge = element('small', 'aw-character-dossier__ability-group-badge')
        groupBadge.textContent = groupLabel(locale, group)
        label.append(abbreviation, name, groupBadge)
        const valueLabel = element('span', 'aw-character-dossier__ability-value')
        valueLabel.textContent = `${value} / ${ability.maximum}`
        heading.append(label, valueLabel)

        const track = element('div', 'aw-character-dossier__meter')
        track.setAttribute('role', 'progressbar')
        track.setAttribute('aria-valuemin', String(ability.minimum))
        track.setAttribute('aria-valuemax', String(ability.maximum))
        track.setAttribute('aria-valuenow', String(value))
        for (let index = ability.minimum; index <= ability.maximum; index += 1) {
          const segment = element('span')
          if (index <= value) segment.classList.add('is-filled')
          if (index > (abilityBaseline[ability.id] ?? ability.minimum) && index <= value) {
            segment.classList.add('is-preview')
          }
          track.appendChild(segment)
        }

        const lower = element('div', 'aw-character-dossier__ability-lower')
        const hint = element('small', 'aw-character-dossier__ability-hint')
        hint.textContent = ability.description
        const controls = element('div', 'aw-character-dossier__ability-controls')
        const decrease = makeButton('aw-character-dossier__stepper', '−', () => {
          if (value <= (abilityBaseline[ability.id] ?? ability.minimum)) return
          draftAbilities[ability.id] = value - 1
          hasPendingAbilityChanges = true
          render()
        })
        decrease.dataset.characterAction = 'decrease-ability'
        decrease.dataset.characterAbilityId = ability.id
        decrease.disabled = value <= (abilityBaseline[ability.id] ?? ability.minimum)
        decrease.setAttribute('aria-label', `${copy(locale, 'CharacterDecrease')} ${ability.name}`)
        const increase = makeButton('aw-character-dossier__stepper is-positive', '+', () => {
          if (remaining <= 0 || value >= ability.maximum) return
          draftAbilities[ability.id] = value + 1
          hasPendingAbilityChanges = true
          render()
        })
        increase.dataset.characterAction = 'increase-ability'
        increase.dataset.characterAbilityId = ability.id
        increase.disabled = remaining <= 0 || value >= ability.maximum
        increase.setAttribute('aria-label', `${copy(locale, 'CharacterIncrease')} ${ability.name}`)
        controls.append(decrease, increase)
        lower.append(hint, controls)
        row.append(heading, track, lower)
        list.appendChild(row)
      })
      section.appendChild(list)
      content.appendChild(section)
    })

    const footer = element('div', 'aw-character-dossier__panel-footer')
    const reset = makeButton(
      'aw-character-dossier__secondary-button',
      copy(locale, 'CharacterReset'),
      () => {
        draftAbilities = { ...baseAbilities }
        hasPendingAbilityChanges = false
        render()
      }
    )
    reset.dataset.characterAction = 'reset-preview'
    reset.disabled = !hasPendingAbilityChanges
    const apply = makeButton(
      'aw-character-dossier__primary-button',
      copy(locale, 'CharacterApply'),
      () => {
        if (!hasPendingAbilityChanges) return
        baseAbilities = { ...draftAbilities }
        hasPendingAbilityChanges = false
        hasCommittedAbilityPreview = true
        options.onAction({ type: 'apply-abilities', abilities: { ...baseAbilities } })
        render()
      }
    )
    apply.dataset.characterAction = 'apply-preview'
    apply.disabled = !hasPendingAbilityChanges
    footer.append(reset, apply)
    content.appendChild(footer)
    renderPanelShell('abilities', content, `${remaining} ${copy(locale, 'CharacterPointsShort')}`)
  }

  const renderEquipment = () => {
    const content = element('div')
    const note = element('p', 'aw-character-dossier__muted')
    note.textContent = copy(locale, 'CharacterEquipmentHint')
    content.appendChild(note)

    const modifierText = (modifiers: Record<string, number>) =>
      Object.entries(modifiers)
        .map(([id, value]) => {
          const ability = snapshot.abilities.find((candidate) => candidate.id === id)
          const sign = value >= 0 ? '+' : ''
          return `${sign}${value} ${ability?.abbreviation ?? id.split(':').pop()?.slice(0, 3).toUpperCase() ?? id}`
        })
        .join(' · ')

    const loadoutSection = element('section', 'aw-character-dossier__equipment-section')
    const loadoutHeader = element('div', 'aw-character-dossier__equipment-section-header')
    const loadoutTitle = element('h3')
    loadoutTitle.textContent = copy(locale, 'CharacterLoadout')
    const loadoutMeta = element('span')
    loadoutMeta.textContent = `${snapshot.equipment.length} ${copy(locale, 'CharacterSlots')}`
    loadoutHeader.append(loadoutTitle, loadoutMeta)
    loadoutSection.appendChild(loadoutHeader)
    const list = element('div', 'aw-character-dossier__equipment-list')
    draftEquipment.forEach((slot) => {
      const row = element('article', 'aw-character-dossier__equipment-row')
      const itemBlock = element('div', 'aw-character-dossier__equipment-item')
      const icon = element('span', 'aw-character-dossier__item-icon')
      icon.textContent = itemGlyph(slot.itemShape)
      icon.style.setProperty('--awd-item-tint', slot.itemColor)
      icon.setAttribute('aria-hidden', 'true')
      const itemCopy = element('div')
      const slotName = element('small')
      slotName.textContent = slot.slotName
      const itemName = element('strong')
      itemName.textContent = slot.itemName
      itemCopy.append(slotName, itemName)
      itemBlock.append(icon, itemCopy)
      const controls = element('span', 'aw-character-dossier__equipment-controls')
      const selectLabel = element('label', 'aw-character-dossier__select-label')
      selectLabel.textContent = copy(locale, 'CharacterChangeItem')
      const select = element('select')
      select.setAttribute('aria-label', slot.slotName)
      select.dataset.characterAction = 'equip'
      select.dataset.characterSlotId = slot.slotId
      slot.options.forEach((option) => {
        const optionNode = element('option')
        optionNode.value = option.id ?? ''
        optionNode.textContent = option.name
        optionNode.selected = option.id === slot.itemId
        select.appendChild(optionNode)
      })
      select.addEventListener('change', () => {
        const selectedItemId = select.value || null
        const selectedOption = slot.options.find((option) => option.id === selectedItemId)
        draftEquipment = draftEquipment.map((candidate) =>
          candidate.slotId === slot.slotId
            ? {
                ...candidate,
                itemId: selectedItemId,
                itemName: selectedOption?.name ?? copy(locale, 'None'),
                itemTags: selectedOption?.tags ?? [],
                itemModifiers: { ...(selectedOption?.modifiers ?? {}) },
                itemColor: selectedOption?.appearanceColor ?? '#7c8a8d',
                itemShape: selectedOption?.appearanceShape ?? 'empty',
              }
            : candidate
        )
        hasEquipmentPreview = true
        options.onAction({ type: 'equip', slotId: slot.slotId, itemId: selectedItemId })
        render()
      })
      selectLabel.appendChild(select)
      controls.appendChild(selectLabel)
      if (slot.kind === 'weapon' && slot.itemId) {
        const active = makeButton(
          `aw-character-dossier__active-button${slot.slotId === draftActiveWeaponSlot ? ' is-active' : ''}`,
          slot.slotId === draftActiveWeaponSlot
            ? copy(locale, 'CharacterActive')
            : copy(locale, 'CharacterUse'),
          () => {
            draftActiveWeaponSlot = slot.slotId
            hasEquipmentPreview = true
            options.onAction({ type: 'active-weapon', slotId: slot.slotId })
            render()
          }
        )
        active.dataset.characterAction = 'active-weapon'
        active.dataset.characterSlotId = slot.slotId
        active.disabled = slot.slotId === draftActiveWeaponSlot
        controls.appendChild(active)
      }
      const meta = element('div', 'aw-character-dossier__equipment-meta')
      const tags = element('span')
      tags.textContent = slot.itemTags.length
        ? slot.itemTags.map((tag) => tag.toUpperCase()).join(' · ')
        : copy(locale, 'CharacterNoTags')
      const modifiers = element('strong')
      modifiers.textContent =
        modifierText(slot.itemModifiers) || copy(locale, 'CharacterNoModifier')
      meta.append(tags, modifiers)
      row.append(itemBlock, controls, meta)
      list.appendChild(row)
    })
    loadoutSection.appendChild(list)
    content.appendChild(loadoutSection)

    const catalogSection = element('section', 'aw-character-dossier__equipment-section')
    const catalogHeader = element('div', 'aw-character-dossier__equipment-section-header')
    const catalogTitle = element('h3')
    catalogTitle.textContent = copy(locale, 'CharacterItemCatalog')
    const catalogMeta = element('span')
    catalogMeta.textContent = `${snapshot.items.length} ${copy(locale, 'CharacterEntries')}`
    catalogHeader.append(catalogTitle, catalogMeta)
    catalogSection.appendChild(catalogHeader)
    const catalogHint = element('p', 'aw-character-dossier__catalog-hint')
    catalogHint.textContent = copy(locale, 'CharacterCatalogHint')
    catalogSection.appendChild(catalogHint)
    const catalog = element('div', 'aw-character-dossier__item-grid')
    snapshot.items.forEach((item) => {
      const card = element('article', 'aw-character-dossier__item-card')
      card.dataset.characterItemId = item.id
      const cardHeader = element('div', 'aw-character-dossier__item-card-header')
      const cardIcon = element('span', 'aw-character-dossier__item-icon')
      cardIcon.textContent = itemGlyph(item.appearanceShape)
      cardIcon.style.setProperty('--awd-item-tint', item.appearanceColor)
      cardIcon.setAttribute('aria-hidden', 'true')
      const cardTitle = element('div')
      const cardName = element('strong')
      cardName.textContent = item.name
      const cardStatus = element('small')
      cardStatus.textContent = item.equippedSlotId
        ? copy(locale, 'CharacterEquipped')
        : copy(locale, 'CharacterCatalog')
      cardTitle.append(cardName, cardStatus)
      cardHeader.append(cardIcon, cardTitle)
      const cardTags = element('div', 'aw-character-dossier__item-tags')
      item.tags.forEach((tag) => {
        const tagNode = element('span')
        tagNode.textContent = tag.toUpperCase()
        cardTags.appendChild(tagNode)
      })
      if (item.shareable) {
        const shareTag = element('span')
        shareTag.textContent = copy(locale, 'CharacterShared')
        cardTags.appendChild(shareTag)
      }
      const cardFooter = element('div', 'aw-character-dossier__item-card-footer')
      const cardSlots = element('span')
      cardSlots.textContent = `${item.allowedSlots.length} ${copy(locale, 'CharacterSlotTargets')}`
      const cardModifier = element('strong')
      cardModifier.textContent = modifierText(item.modifiers) || copy(locale, 'CharacterNoModifier')
      cardFooter.append(cardSlots, cardModifier)
      card.append(cardHeader, cardTags, cardFooter)
      catalog.appendChild(card)
    })
    catalogSection.appendChild(catalog)
    content.appendChild(catalogSection)
    renderPanelShell('equipment', content, `${snapshot.equipment.length}`)
  }

  const renderSkills = () => {
    const content = element('div')
    const note = element('p', 'aw-character-dossier__muted')
    note.textContent = copy(locale, 'CharacterSkillsHint')
    content.appendChild(note)
    const list = element('div', 'aw-character-dossier__skill-list')
    snapshot.skills.forEach((skill) => {
      const row = element('div', 'aw-character-dossier__skill-row')
      const icon = element('span', 'aw-character-dossier__skill-icon')
      icon.textContent = skill.status === 'ready' ? '✦' : '·'
      const body = element('div')
      const heading = element('div', 'aw-character-dossier__skill-heading')
      const name = element('strong')
      name.textContent = skill.name
      const source = element('span')
      source.textContent = skill.source
      heading.append(name, source)
      const description = element('small')
      description.textContent = skill.description
      body.append(heading, description)
      row.append(icon, body)
      list.appendChild(row)
    })
    content.appendChild(list)
    renderPanelShell('skills', content, `${snapshot.skills.length}`)
  }

  const renderSystems = () => {
    const content = element('div')
    const systemGrid = element('div', 'aw-character-dossier__system-grid')
    ;[
      [copy(locale, 'CharacterWalkSpeed'), snapshot.walkSpeed.toFixed(1)],
      [copy(locale, 'CharacterRunMultiplier'), `${snapshot.runMultiplier.toFixed(1)}×`],
      [
        copy(locale, 'CharacterActionRange'),
        `${snapshot.actionRange.toFixed(1)} ${copy(locale, 'CharacterCells')}`,
      ],
      [copy(locale, 'CharacterCharted'), snapshot.field.discoveredCells],
      [copy(locale, 'CharacterLoaded'), snapshot.field.loadedChunks],
      [copy(locale, 'CharacterFrontiers'), snapshot.field.discoveredChunks],
    ].forEach(([label, value]) => {
      const item = element('div')
      const labelNode = element('span')
      labelNode.textContent = String(label)
      const valueNode = element('strong')
      valueNode.textContent = String(value)
      item.append(labelNode, valueNode)
      systemGrid.appendChild(item)
    })
    content.appendChild(systemGrid)
    const state = element(
      'div',
      `aw-character-dossier__system-state${snapshot.field.traversalReady ? ' is-ready' : ''}`
    )
    const stateLabel = element('strong')
    stateLabel.textContent = snapshot.field.traversalReady
      ? copy(locale, 'CharacterTraversalReady')
      : copy(locale, 'CharacterTraversalUnavailable')
    const stateNote = element('small')
    stateNote.textContent = snapshot.field.traversalNote
    state.append(stateLabel, stateNote)
    content.appendChild(state)
    renderPanelShell('systems', content, copy(locale, 'CharacterFieldNote'))
  }

  const render = () => {
    const focused =
      document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
        ? {
            action: document.activeElement.dataset.characterAction,
            panelAction: document.activeElement.dataset.characterPanelAction,
            panel:
              document.activeElement.closest<HTMLElement>('[data-character-panel]')?.dataset
                .characterPanel,
            abilityId: document.activeElement.dataset.characterAbilityId,
            slotId: document.activeElement.dataset.characterSlotId,
            shortcut: document.activeElement.dataset.characterPanelShortcut,
          }
        : null
    const scrollTop = stack.scrollTop
    root.hidden = suppressed || !dossierOpen
    root.dataset.characterDossierOpen = String(dossierOpen)
    root.dataset.characterActivePanel = activePanel
    root.dataset.characterId = snapshot.id
    stack.replaceChildren()
    renderRail()
    renderOverview()
    renderAbilities()
    renderEquipment()
    renderSkills()
    renderSystems()
    stack.scrollTop = scrollTop
    if (focused) {
      requestAnimationFrame(() => {
        if (destroyed) return
        const target = Array.from(
          root.querySelectorAll<HTMLElement>(
            '[data-character-action], [data-character-panel-action], [data-character-panel-shortcut]'
          )
        ).find(
          (candidate) =>
            candidate.dataset.characterAction === focused.action &&
            candidate.dataset.characterPanelAction === focused.panelAction &&
            candidate.dataset.characterAbilityId === focused.abilityId &&
            candidate.dataset.characterSlotId === focused.slotId &&
            candidate.dataset.characterPanelShortcut === focused.shortcut &&
            (focused.panel === undefined ||
              candidate.closest<HTMLElement>('[data-character-panel]')?.dataset.characterPanel ===
                focused.panel)
        )
        target?.focus({ preventScroll: true })
      })
    }
  }

  const controller: CharacterDossierController = {
    handleKeyDown(event) {
      if (suppressed) return false
      const target = event.target instanceof HTMLElement ? event.target : null
      const key = event.key.toLowerCase()
      if (key === 'escape' && dossierOpen && !event.repeat) {
        event.preventDefault()
        const panel = target?.closest<HTMLElement>('[data-character-panel]')?.dataset
          .characterPanel as CharacterDossierPanelId | undefined
        if (panel && PANEL_ORDER.includes(panel)) {
          target?.blur()
          panelOpen.set(panel, false)
          render()
        } else {
          controller.close()
        }
        return true
      }
      if (
        (target &&
          root.contains(target) &&
          target.matches('input, textarea, select, a, [contenteditable="true"]')) ||
        (target?.matches('button, [role="button"]') && !root.contains(target))
      ) {
        return false
      }
      if (key === 'c' && !event.repeat) {
        event.preventDefault()
        if (dossierOpen) controller.close()
        else controller.openPanel('overview')
        return true
      }
      if (key === 'i' && !event.repeat) {
        event.preventDefault()
        controller.openPanel('abilities')
        return true
      }
      if (dossierOpen && /^[1-5]$/.test(key) && !event.repeat) {
        event.preventDefault()
        controller.openPanel(PANEL_ORDER[Number(key) - 1]!)
        return true
      }
      return false
    },
    setSnapshot(nextSnapshot) {
      syncDraftAbilities(nextSnapshot)
      snapshot = nextSnapshot
      render()
    },
    setLocale(nextLocale) {
      locale = nextLocale
      render()
    },
    setTheme(theme) {
      root.dataset.theme = theme
    },
    setSuppressed(nextSuppressed) {
      suppressed = nextSuppressed
      render()
    },
    openPanel(panel) {
      if (!dossierOpen) options.onInteractionStart?.()
      dossierOpen = true
      activePanel = panel
      panelOpen.set(panel, true)
      render()
      const target = root.querySelector<HTMLElement>(`[data-character-panel="${panel}"]`)
      target?.scrollIntoView({ block: 'nearest' })
    },
    close() {
      dossierOpen = false
      render()
    },
    isOpen: () => dossierOpen,
    destroy() {
      destroyed = true
      root.remove()
    },
  }

  render()
  return controller
}
