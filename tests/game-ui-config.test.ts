import { describe, expect, it } from 'vitest'
import { resolveGameUiOptions } from '../packages/engine/src/game-ui-config'

describe('game UI configuration', () => {
  it('defaults on in game mode and off in dev mode', () => {
    expect(resolveGameUiOptions(undefined, false)).toEqual({
      enabled: true,
      splash: true,
      hud: true,
      minimap: true,
      menu: true,
    })
    expect(resolveGameUiOptions(undefined, true)).toEqual({
      enabled: false,
      splash: false,
      hud: false,
      minimap: false,
      menu: false,
    })
  })

  it('supports a one-switch override and individual surfaces', () => {
    expect(resolveGameUiOptions(true, true).enabled).toBe(true)
    expect(resolveGameUiOptions(false, false).menu).toBe(false)
    expect(resolveGameUiOptions({ enabled: true, splash: false }, true)).toEqual({
      enabled: true,
      splash: false,
      hud: true,
      minimap: true,
      menu: true,
    })
  })
})
