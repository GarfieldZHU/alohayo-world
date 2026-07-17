export interface MaskContourOptions {
  width: number
  height: number
  isInside: (x: number, y: number) => boolean
  smoothingPasses?: number
}

interface Edge {
  startX: number
  startY: number
  endX: number
  endY: number
}

const pointKey = (x: number, y: number) => `${x},${y}`

function smoothContour(points: number[], closed: boolean, passes: number) {
  let current = points
  for (let pass = 0; pass < passes && current.length >= 8; pass += 1) {
    const next: number[] = []
    const pointCount = current.length / 2
    if (!closed) next.push(current[0]!, current[1]!)
    const segmentCount = closed ? pointCount : pointCount - 1
    for (let index = 0; index < segmentCount; index += 1) {
      const nextIndex = (index + 1) % pointCount
      const x1 = current[index * 2]!
      const y1 = current[index * 2 + 1]!
      const x2 = current[nextIndex * 2]!
      const y2 = current[nextIndex * 2 + 1]!
      next.push(x1 * 0.75 + x2 * 0.25, y1 * 0.75 + y2 * 0.25)
      next.push(x1 * 0.25 + x2 * 0.75, y1 * 0.25 + y2 * 0.75)
    }
    if (!closed) next.push(current.at(-2)!, current.at(-1)!)
    current = next
  }
  if (closed && current.length >= 4) current.push(current[0]!, current[1]!)
  return new Float32Array(current)
}

/**
 * Traces clockwise cell-mask frontiers and applies deterministic Chaikin smoothing.
 * Coordinates are cell-corner units and the output stays allocation-light for worker use.
 */
export function extractMaskContours({
  width,
  height,
  isInside,
  smoothingPasses = 2,
}: MaskContourOptions): Float32Array[] {
  const edges: Edge[] = []
  const add = (startX: number, startY: number, endX: number, endY: number) => {
    edges.push({ startX, startY, endX, endY })
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isInside(x, y)) continue
      if (!isInside(x, y - 1)) add(x, y, x + 1, y)
      if (!isInside(x + 1, y)) add(x + 1, y, x + 1, y + 1)
      if (!isInside(x, y + 1)) add(x + 1, y + 1, x, y + 1)
      if (!isInside(x - 1, y)) add(x, y + 1, x, y)
    }
  }

  const byStart = new Map<string, number[]>()
  edges.forEach((edge, index) => {
    const key = pointKey(edge.startX, edge.startY)
    const candidates = byStart.get(key) ?? []
    candidates.push(index)
    byStart.set(key, candidates)
  })

  const used = new Uint8Array(edges.length)
  const contours: Float32Array[] = []
  for (let startIndex = 0; startIndex < edges.length; startIndex += 1) {
    if (used[startIndex]) continue
    const start = edges[startIndex]!
    const points = [start.startX, start.startY]
    let edgeIndex = startIndex
    let closed = false
    while (!used[edgeIndex]) {
      const edge = edges[edgeIndex]!
      used[edgeIndex] = 1
      points.push(edge.endX, edge.endY)
      if (edge.endX === start.startX && edge.endY === start.startY) {
        closed = true
        break
      }
      const candidates = byStart.get(pointKey(edge.endX, edge.endY)) ?? []
      const next = candidates.find((candidate) => !used[candidate])
      if (next === undefined) break
      edgeIndex = next
    }
    if (points.length >= 4) {
      if (closed) points.splice(-2, 2)
      contours.push(smoothContour(points, closed, Math.max(0, Math.floor(smoothingPasses))))
    }
  }
  return contours
}
