export interface RoadRenderPoint {
  x: number
  y: number
}

export interface RoadRenderBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface RoadWeatherCoverage {
  wetness: number
  snowCover: number
  mud: number
  fade: number
}

const EPSILON = 1e-7

function samePoint(left: RoadRenderPoint, right: RoadRenderPoint) {
  return Math.abs(left.x - right.x) < EPSILON && Math.abs(left.y - right.y) < EPSILON
}

function clipLineToBounds(
  from: RoadRenderPoint,
  to: RoadRenderPoint,
  bounds: RoadRenderBounds
): [RoadRenderPoint, RoadRenderPoint] | null {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  const p = [-deltaX, deltaX, -deltaY, deltaY]
  const q = [from.x - bounds.minX, bounds.maxX - from.x, from.y - bounds.minY, bounds.maxY - from.y]
  let start = 0
  let end = 1

  for (let index = 0; index < p.length; index += 1) {
    const direction = p[index]!
    const distance = q[index]!
    if (Math.abs(direction) < EPSILON) {
      if (distance < 0) return null
      continue
    }
    const ratio = distance / direction
    if (direction < 0) start = Math.max(start, ratio)
    else end = Math.min(end, ratio)
    if (start > end) return null
  }

  return [
    { x: from.x + start * deltaX, y: from.y + start * deltaY },
    { x: from.x + end * deltaX, y: from.y + end * deltaY },
  ]
}

/** Clips one road to a chunk without joining separate visits across off-chunk space. */
export function clipRoadToBounds(
  points: readonly RoadRenderPoint[],
  bounds: RoadRenderBounds
): RoadRenderPoint[][] {
  const paths: RoadRenderPoint[][] = []
  let active: RoadRenderPoint[] | null = null

  for (let index = 1; index < points.length; index += 1) {
    const clipped = clipLineToBounds(points[index - 1]!, points[index]!, bounds)
    if (!clipped) {
      active = null
      continue
    }
    const [start, end] = clipped
    if (!active || !samePoint(active[active.length - 1]!, start)) {
      active = [start, end]
      paths.push(active)
    } else if (!samePoint(active[active.length - 1]!, end)) {
      active.push(end)
    }
  }

  return paths
}

export function roadWeatherOverlayAlpha(
  textureStrength: number,
  conditionAlpha: number,
  state: RoadWeatherCoverage
) {
  const coverage = Math.max(state.wetness, state.snowCover, state.mud)
  if (coverage <= 0.08 || state.fade <= 0.02) return 0
  return textureStrength * conditionAlpha * coverage * state.fade
}
