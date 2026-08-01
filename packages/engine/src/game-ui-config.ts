import type { GameUiOptions } from '@alohayo/config'

export interface ResolvedGameUiOptions {
  enabled: boolean
  splash: boolean
  hud: boolean
  menu: boolean
}

export function resolveGameUiOptions(
  input: boolean | GameUiOptions | undefined,
  devMode: boolean
): ResolvedGameUiOptions {
  const defaultsOn = !devMode
  if (input === false) return { enabled: false, splash: false, hud: false, menu: false }
  if (input === true) return { enabled: true, splash: true, hud: true, menu: true }

  const enabled = input?.enabled ?? defaultsOn
  return {
    enabled,
    splash: enabled && (input?.splash ?? true),
    hud: enabled && (input?.hud ?? true),
    menu: enabled && (input?.menu ?? true),
  }
}
