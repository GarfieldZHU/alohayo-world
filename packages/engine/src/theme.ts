import type { UiTheme } from './types'

export interface ThemePalette {
  containerBackground: string
  statusFill: string
  minimapFill: number
  minimapStroke: number
  minimapExplorerStroke: number
  minimapPanelBorder: string
  minimapPanelBackground: string
  minimapPanelText: string
  minimapPanelMuted: string
  minimapPanelButtonBackground: string
  minimapPanelButtonActive: string
  devBorder: string
  devBackground: string
  devBackgroundHover: string
  devText: string
  devAccent: string
  devMuted: string
  devInputBackground: string
  devInputBorder: string
  devButtonBackground: string
}

export function themePalette(theme: UiTheme): ThemePalette {
  return theme === 'light'
    ? {
        containerBackground: '#e7eef8',
        statusFill: '#143247',
        minimapFill: 0xf6fbff,
        minimapStroke: 0x3b82f6,
        minimapExplorerStroke: 0xe7eef8,
        minimapPanelBorder: 'rgba(59,130,246,0.18)',
        minimapPanelBackground: 'rgba(255,255,255,0.7)',
        minimapPanelText: '#143247',
        minimapPanelMuted: '#476072',
        minimapPanelButtonBackground: 'rgba(232, 241, 253, 0.88)',
        minimapPanelButtonActive: '#2563eb',
        devBorder: 'rgba(59,130,246,0.28)',
        devBackground: 'rgba(255, 255, 255, 0.56)',
        devBackgroundHover: 'rgba(255, 255, 255, 0.94)',
        devText: '#143247',
        devAccent: '#2563eb',
        devMuted: '#476072',
        devInputBackground: 'rgba(231, 238, 248, 0.92)',
        devInputBorder: '#98b0c8',
        devButtonBackground: 'rgba(219, 234, 254, 0.96)',
      }
    : {
        containerBackground: '#07111f',
        statusFill: '#d8f3ff',
        minimapFill: 0x091725,
        minimapStroke: 0x72d7c8,
        minimapExplorerStroke: 0x10222f,
        minimapPanelBorder: 'rgba(114,215,200,0.24)',
        minimapPanelBackground: 'rgba(7,17,31,0.68)',
        minimapPanelText: '#d8f3ff',
        minimapPanelMuted: '#9bb2bf',
        minimapPanelButtonBackground: 'rgba(24, 49, 65, 0.82)',
        minimapPanelButtonActive: '#72d7c8',
        devBorder: 'rgba(114,215,200,0.35)',
        devBackground: 'rgba(7, 17, 31, 0.42)',
        devBackgroundHover: 'rgba(7, 17, 31, 0.92)',
        devText: '#d8f3ff',
        devAccent: '#72d7c8',
        devMuted: '#9bb2bf',
        devInputBackground: '#0c1e2b',
        devInputBorder: '#315263',
        devButtonBackground: '#173241',
      }
}
