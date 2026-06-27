import type { ThemePalette } from './theme'
import type { DevPanelControls } from './types'

interface CreateDevPanelArgs {
  getText: (key: string) => string
  getSlotName: (slotId: string, fallback: string) => string
  getItemName: (itemId: string, fallback: string) => string
  getUnequipName: () => string
  getExplorerEquipment: () => Array<{ slotId: string; itemId: string | null }> | null
  getSlotById: (slotId: string) => { id: string; name: string; kind: string } | undefined
  getAvailableItems: () => Array<{ id: string; name: string; allowedSlots: string[] }>
  getBattleShadow: () => boolean
  setBattleShadow: (enabled: boolean) => void
  getGrid: () => boolean
  setGrid: (enabled: boolean) => void
  getMinimap: () => boolean
  setMinimap: (enabled: boolean) => void
  getFastMove: () => boolean
  setFastMove: (enabled: boolean) => void
  getFly: () => boolean
  setFly: (enabled: boolean) => void
  getDayNight: () => boolean
  setDayNight: (enabled: boolean) => void
  getLightLevel: () => number
  setLightLevel: (level: number) => void
  teleport: (x: number, y: number) => void
  applyEquipment: (slotId: string, itemId: string | null, itemName: string) => void
  onRefreshVisuals: () => void
  onStatusChange: () => void
  getCollapsed: () => boolean
  setCollapsedState: (collapsed: boolean) => void
  storageKey: string
}

export function createDevPanel(args: CreateDevPanelArgs): DevPanelControls {
  const panelId = `alohayo-world-dev-${Math.random().toString(36).slice(2)}`
  const controlId = (name: string) => `${panelId}-${name}`
  const panel = document.createElement('div')
  panel.dataset.alohayoWorldDevPanel = 'true'
  Object.assign(panel.style, {
    position: 'absolute',
    inset: 'auto auto 16px 16px',
    zIndex: '20',
    width: 'min(280px, calc(100% - 32px))',
    padding: '10px',
    borderRadius: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
    transition: 'opacity 140ms ease, background 140ms ease, transform 140ms ease',
  } satisfies Partial<CSSStyleDeclaration>)

  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '8px',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.appendChild(header)

  const heading = document.createElement('div')
  heading.textContent = args.getText('heading')
  Object.assign(heading.style, {
    fontSize: '12px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    flex: '1',
    marginBottom: '0',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(heading)

  const collapseButton = document.createElement('button')
  collapseButton.type = 'button'
  Object.assign(collapseButton.style, {
    border: '0',
    background: 'transparent',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '700',
  } satisfies Partial<CSSStyleDeclaration>)
  header.appendChild(collapseButton)

  const body = document.createElement('div')
  panel.appendChild(body)

  const tabList = document.createElement('div')
  Object.assign(tabList.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '4px',
    marginBottom: '8px',
  } satisfies Partial<CSSStyleDeclaration>)
  body.appendChild(tabList)

  const makeTab = (name: string) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = args.getText(name)
    Object.assign(button.style, {
      borderRadius: '999px',
      border: '0',
      cursor: 'pointer',
      padding: '6px 8px',
      fontSize: '10px',
      fontWeight: '800',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    } satisfies Partial<CSSStyleDeclaration>)
    tabList.appendChild(button)
    return button
  }

  const movementTab = makeTab('tabMovement')
  const worldTab = makeTab('tabWorld')
  const gearTab = makeTab('tabGear')

  const movementSection = document.createElement('div')
  const worldSection = document.createElement('div')
  const gearSection = document.createElement('div')
  body.append(movementSection, worldSection, gearSection)
  let activeTab: 'movement' | 'world' | 'gear' = 'movement'

  const activeSection = () => {
    if (activeTab === 'world') return worldSection
    if (activeTab === 'gear') return gearSection
    return movementSection
  }

  const makeRow = () => {
    const row = document.createElement('div')
    Object.assign(row.style, {
      display: 'flex',
      gap: '8px',
      marginBottom: '8px',
      alignItems: 'center',
    } satisfies Partial<CSSStyleDeclaration>)
    activeSection().appendChild(row)
    return row
  }

  const makeInput = (value = '') => {
    const input = document.createElement('input')
    input.value = value
    Object.assign(input.style, {
      flex: '1',
      minWidth: '0',
      borderRadius: '8px',
      padding: '8px 10px',
    } satisfies Partial<CSSStyleDeclaration>)
    return input
  }

  const makeButton = (text: string) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = text
    Object.assign(button.style, {
      borderRadius: '8px',
      padding: '8px 10px',
      cursor: 'pointer',
      fontWeight: '700',
    } satisfies Partial<CSSStyleDeclaration>)
    return button
  }

  const checkboxRow = makeRow()
  const battleShadowToggle = document.createElement('input')
  battleShadowToggle.type = 'checkbox'
  battleShadowToggle.id = controlId('battle-shadow')
  battleShadowToggle.checked = args.getBattleShadow()
  const battleShadowLabel = document.createElement('label')
  battleShadowLabel.htmlFor = battleShadowToggle.id
  battleShadowLabel.textContent = args.getText('battleShadow')
  battleShadowLabel.style.flex = '1'
  checkboxRow.append(battleShadowToggle, battleShadowLabel)

  const fastMoveToggle = document.createElement('input')
  fastMoveToggle.type = 'checkbox'
  fastMoveToggle.id = controlId('fast-move')
  fastMoveToggle.checked = args.getFastMove()
  const fastMoveLabel = document.createElement('label')
  fastMoveLabel.htmlFor = fastMoveToggle.id
  fastMoveLabel.textContent = args.getText('fastMove')
  fastMoveLabel.style.flex = '1'
  checkboxRow.append(fastMoveToggle, fastMoveLabel)

  const flyRow = makeRow()
  const flyToggle = document.createElement('input')
  flyToggle.type = 'checkbox'
  flyToggle.id = controlId('fly')
  flyToggle.checked = args.getFly()
  const flyLabel = document.createElement('label')
  flyLabel.htmlFor = flyToggle.id
  flyLabel.textContent = args.getText('fly')
  flyLabel.style.flex = '1'
  flyRow.append(flyToggle, flyLabel)

  const gridToggle = document.createElement('input')
  gridToggle.type = 'checkbox'
  gridToggle.id = controlId('grid')
  gridToggle.checked = args.getGrid()
  const gridLabel = document.createElement('label')
  gridLabel.htmlFor = gridToggle.id
  gridLabel.textContent = args.getText('grid')
  gridLabel.style.flex = '1'
  flyRow.append(gridToggle, gridLabel)

  const teleportRow = makeRow()
  const teleportX = makeInput('0')
  teleportX.inputMode = 'numeric'
  teleportX.placeholder = 'x'
  const teleportY = makeInput('0')
  teleportY.inputMode = 'numeric'
  teleportY.placeholder = 'y'
  const teleportButton = makeButton(args.getText('teleport'))
  teleportRow.append(teleportX, teleportY, teleportButton)

  activeTab = 'world'
  const minimapRow = makeRow()
  const minimapToggle = document.createElement('input')
  minimapToggle.type = 'checkbox'
  minimapToggle.id = controlId('minimap')
  minimapToggle.checked = args.getMinimap()
  const minimapLabel = document.createElement('label')
  minimapLabel.htmlFor = minimapToggle.id
  minimapLabel.textContent = args.getText('minimap')
  minimapLabel.style.flex = '1'
  minimapRow.append(minimapToggle, minimapLabel)

  const dayNightRow = makeRow()
  const dayNightToggle = document.createElement('input')
  dayNightToggle.type = 'checkbox'
  dayNightToggle.id = controlId('day-night')
  dayNightToggle.checked = args.getDayNight()
  const dayNightLabel = document.createElement('label')
  dayNightLabel.htmlFor = dayNightToggle.id
  dayNightLabel.textContent = args.getText('dayNight')
  dayNightLabel.style.flex = '1'
  dayNightRow.append(dayNightToggle, dayNightLabel)

  const lightLevelRow = makeRow()
  const lightLevelLabel = document.createElement('label')
  lightLevelLabel.htmlFor = controlId('light-level')
  lightLevelLabel.textContent = args.getText('lightLevel')
  lightLevelLabel.style.minWidth = '50px'
  const lightLevelSlider = document.createElement('input')
  lightLevelSlider.type = 'range'
  lightLevelSlider.id = lightLevelLabel.htmlFor
  lightLevelSlider.min = '0'
  lightLevelSlider.max = '100'
  lightLevelSlider.step = '1'
  lightLevelSlider.value = Math.round(args.getLightLevel() * 100).toString()
  lightLevelSlider.setAttribute('aria-label', args.getText('lightLevel'))
  Object.assign(lightLevelSlider.style, {
    flex: '1',
    minWidth: '0',
    accentColor: '#9fd2ff',
  } satisfies Partial<CSSStyleDeclaration>)
  const lightLevelValue = document.createElement('span')
  Object.assign(lightLevelValue.style, {
    minWidth: '48px',
    textAlign: 'right',
    fontSize: '11px',
    fontVariantNumeric: 'tabular-nums',
  } satisfies Partial<CSSStyleDeclaration>)
  const updateLightLevelValue = () => {
    const percent = Number.parseInt(lightLevelSlider.value, 10)
    lightLevelValue.textContent =
      percent <= 8
        ? args.getText('lightMidnight')
        : percent >= 92
          ? args.getText('lightNoon')
          : `${percent}%`
  }
  const updateLightLevelMode = () => {
    const manual = !dayNightToggle.checked
    lightLevelSlider.disabled = !manual
    lightLevelRow.style.opacity = manual ? '1' : '0.54'
  }
  updateLightLevelValue()
  updateLightLevelMode()
  lightLevelRow.append(lightLevelLabel, lightLevelSlider, lightLevelValue)

  activeTab = 'gear'
  const gearRow = makeRow()
  const slotSelect = document.createElement('select')
  const itemSelect = document.createElement('select')
  for (const select of [slotSelect, itemSelect]) {
    Object.assign(select.style, {
      flex: '1',
      minWidth: '0',
      borderRadius: '8px',
      padding: '8px 10px',
    } satisfies Partial<CSSStyleDeclaration>)
  }
  const applyGearButton = makeButton(args.getText('equip'))
  gearRow.append(slotSelect, itemSelect, applyGearButton)

  const fillEquipmentOptions = () => {
    const equipment = args.getExplorerEquipment()
    if (!equipment) return
    slotSelect.replaceChildren()
    for (const entry of equipment) {
      const option = document.createElement('option')
      const slot = args.getSlotById(entry.slotId)
      option.value = entry.slotId
      option.textContent = args.getSlotName(entry.slotId, slot?.name ?? entry.slotId)
      slotSelect.appendChild(option)
    }
  }

  const fillItemOptions = () => {
    itemSelect.replaceChildren()
    const currentSlotId = slotSelect.value
    const emptyOption = document.createElement('option')
    emptyOption.value = ''
    emptyOption.textContent = args.getUnequipName()
    itemSelect.appendChild(emptyOption)
    for (const item of args.getAvailableItems()) {
      if (!item.allowedSlots.includes(currentSlotId)) continue
      const option = document.createElement('option')
      option.value = item.id
      option.textContent = args.getItemName(item.id, item.name)
      itemSelect.appendChild(option)
    }
    const selected = args.getExplorerEquipment()?.find((entry) => entry.slotId === currentSlotId)
    itemSelect.value = selected?.itemId ?? ''
  }

  battleShadowToggle.addEventListener('change', () => {
    args.setBattleShadow(battleShadowToggle.checked)
    args.onStatusChange()
    args.onRefreshVisuals()
  })

  gridToggle.addEventListener('change', () => {
    args.setGrid(gridToggle.checked)
    args.onStatusChange()
    args.onRefreshVisuals()
  })

  minimapToggle.addEventListener('change', () => {
    args.setMinimap(minimapToggle.checked)
    args.onStatusChange()
    args.onRefreshVisuals()
  })

  fastMoveToggle.addEventListener('change', () => {
    args.setFastMove(fastMoveToggle.checked)
    args.onStatusChange()
  })

  flyToggle.addEventListener('change', () => {
    args.setFly(flyToggle.checked)
    args.onStatusChange()
    args.onRefreshVisuals()
  })

  dayNightToggle.addEventListener('change', () => {
    args.setDayNight(dayNightToggle.checked)
    updateLightLevelMode()
    args.onStatusChange()
    args.onRefreshVisuals()
  })

  lightLevelSlider.addEventListener('input', () => {
    const level = clampNumber(Number.parseInt(lightLevelSlider.value, 10) / 100, 0, 1)
    args.setLightLevel(level)
    updateLightLevelValue()
    args.onStatusChange()
    args.onRefreshVisuals()
  })

  teleportButton.addEventListener('click', () => {
    const nextX = Number.parseInt(teleportX.value, 10)
    const nextY = Number.parseInt(teleportY.value, 10)
    if (Number.isNaN(nextX) || Number.isNaN(nextY)) return
    args.teleport(nextX, nextY)
  })

  slotSelect.addEventListener('change', fillItemOptions)
  applyGearButton.addEventListener('click', () => {
    const currentSlotId = slotSelect.value
    args.applyEquipment(
      currentSlotId,
      itemSelect.value || null,
      itemSelect.selectedOptions[0]?.textContent ?? args.getUnequipName()
    )
  })

  fillEquipmentOptions()
  fillItemOptions()

  const note = document.createElement('p')
  note.textContent = args.getText('note')
  Object.assign(note.style, {
    margin: '2px 0 0',
    fontSize: '11px',
  } satisfies Partial<CSSStyleDeclaration>)
  movementSection.appendChild(note)

  const controls: DevPanelControls = {
    panel,
    body,
    heading,
    collapseButton,
    movementTab,
    worldTab,
    gearTab,
    movementSection,
    worldSection,
    gearSection,
    battleShadowLabel,
    fastMoveLabel,
    flyLabel,
    gridLabel,
    minimapLabel,
    dayNightLabel,
    lightLevelLabel,
    lightLevelValue,
    lightLevelSlider,
    teleportX,
    teleportY,
    teleportButton,
    slotSelect,
    itemSelect,
    applyGearButton,
    note,
    battleShadowToggle,
    fastMoveToggle,
    flyToggle,
    gridToggle,
    minimapToggle,
    dayNightToggle,
    fillEquipmentOptions,
    fillItemOptions,
    setCollapsed(collapsed) {
      args.setCollapsedState(collapsed)
      body.style.display = collapsed ? 'none' : 'block'
      collapseButton.textContent = collapsed ? args.getText('expand') : args.getText('collapse')
      collapseButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      panel.style.transform = collapsed ? 'translateY(2px)' : 'translateY(0)'
      window.localStorage.setItem(args.storageKey, collapsed ? 'true' : 'false')
    },
    isCollapsed: args.getCollapsed,
    setActiveTab(tab) {
      activeTab = tab
      movementSection.style.display = tab === 'movement' ? 'block' : 'none'
      worldSection.style.display = tab === 'world' ? 'block' : 'none'
      gearSection.style.display = tab === 'gear' ? 'block' : 'none'
      for (const [button, name] of [
        [movementTab, 'movement'],
        [worldTab, 'world'],
        [gearTab, 'gear'],
      ] as const) {
        const selected = tab === name
        button.setAttribute('aria-selected', selected ? 'true' : 'false')
        button.style.opacity = selected ? '1' : '0.62'
        button.style.transform = selected ? 'translateY(-1px)' : 'translateY(0)'
      }
    },
  }

  collapseButton.addEventListener('click', () => {
    controls.setCollapsed(!args.getCollapsed())
  })
  movementTab.addEventListener('click', () => controls.setActiveTab('movement'))
  worldTab.addEventListener('click', () => controls.setActiveTab('world'))
  gearTab.addEventListener('click', () => controls.setActiveTab('gear'))
  controls.setActiveTab('movement')

  return controls
}

export function renderDevPanelLocale(
  panel: DevPanelControls | null,
  getText: (key: string) => string
) {
  if (!panel) return
  panel.heading.textContent = getText('heading')
  panel.setCollapsed(panel.isCollapsed())
  panel.movementTab.textContent = getText('tabMovement')
  panel.worldTab.textContent = getText('tabWorld')
  panel.gearTab.textContent = getText('tabGear')
  panel.battleShadowLabel.textContent = getText('battleShadow')
  panel.fastMoveLabel.textContent = getText('fastMove')
  panel.flyLabel.textContent = getText('fly')
  panel.gridLabel.textContent = getText('grid')
  panel.minimapLabel.textContent = getText('minimap')
  panel.dayNightLabel.textContent = getText('dayNight')
  panel.lightLevelLabel.textContent = getText('lightLevel')
  const percent = Number.parseInt(panel.lightLevelSlider.value, 10)
  panel.lightLevelValue.textContent =
    percent <= 8 ? getText('lightMidnight') : percent >= 92 ? getText('lightNoon') : `${percent}%`
  panel.lightLevelSlider.setAttribute('aria-label', getText('lightLevel'))
  panel.teleportButton.textContent = getText('teleport')
  panel.applyGearButton.textContent = getText('equip')
  panel.note.textContent = getText('note')
  panel.fillEquipmentOptions()
  panel.fillItemOptions()
}

export function applyThemeToDevPanel(
  panel: DevPanelControls | null,
  palette: ThemePalette,
  collapsed: boolean,
  interactive = false
) {
  if (!panel) return
  Object.assign(panel.panel.style, {
    border: `1px solid ${palette.devBorder}`,
    background: interactive ? palette.devBackgroundHover : palette.devBackground,
    color: palette.devText,
    opacity: interactive ? '1' : collapsed ? '0.66' : '0.22',
  } satisfies Partial<CSSStyleDeclaration>)
  panel.heading.style.color = palette.devAccent
  panel.note.style.color = palette.devMuted
  panel.collapseButton.style.color = palette.devText
  for (const button of [panel.movementTab, panel.worldTab, panel.gearTab]) {
    const selected = button.getAttribute('aria-selected') === 'true'
    Object.assign(button.style, {
      color: selected ? palette.devAccent : palette.devText,
      background: selected ? palette.devButtonBackground : 'transparent',
      border: `1px solid ${selected ? palette.devInputBorder : 'transparent'}`,
    } satisfies Partial<CSSStyleDeclaration>)
  }

  for (const element of [panel.teleportX, panel.teleportY, panel.slotSelect, panel.itemSelect]) {
    Object.assign(element.style, {
      color: palette.devText,
      background: palette.devInputBackground,
      border: `1px solid ${palette.devInputBorder}`,
    } satisfies Partial<CSSStyleDeclaration>)
  }
  panel.lightLevelSlider.style.accentColor = palette.devAccent

  for (const button of [panel.teleportButton, panel.applyGearButton]) {
    Object.assign(button.style, {
      color: palette.devText,
      background: palette.devButtonBackground,
      border: `1px solid ${palette.devInputBorder}`,
    } satisfies Partial<CSSStyleDeclaration>)
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
