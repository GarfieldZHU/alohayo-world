export const HYDROLOGY_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

const OPPOSITE_DIRECTION = [1, 0, 3, 2, 7, 6, 5, 4] as const

export interface HydrologySample {
  elevationValue: number
  water: boolean
}

export interface HydrologyRaster {
  width: number
  height: number
  rawElevation: Float32Array
  filledElevation: Float32Array
  water: Uint8Array
  slope: Uint8Array
  flowDirection: Int8Array
  flowAccumulation: Uint32Array
  watershed: Uint32Array
  depression: Uint8Array
  erosionPotential: Uint8Array
  sedimentLoad: Uint8Array
  deposition: Uint8Array
  floodplain: Uint8Array
}

export interface GeomorphologyParameters {
  erosionSlopeWeight: number
  erosionFlowWeight: number
  depressionRetention: number
  sedimentTransport: number
  depositionSlopeMax: number
  floodplainAccumulationMin: number
  floodplainSlopeMax: number
  floodplainRadius: number
}

export const DEFAULT_GEOMORPHOLOGY: GeomorphologyParameters = {
  erosionSlopeWeight: 0.62,
  erosionFlowWeight: 0.38,
  depressionRetention: 0.72,
  sedimentTransport: 0.84,
  depositionSlopeMax: 0.2,
  floodplainAccumulationMin: 0.28,
  floodplainSlopeMax: 0.16,
  floodplainRadius: 2,
}

class MinHeap {
  private indices: number[] = []

  private priorities: number[] = []

  get size(): number {
    return this.indices.length
  }

  push(index: number, priority: number) {
    let cursor = this.indices.length
    this.indices.push(index)
    this.priorities.push(priority)
    while (cursor > 0) {
      const parent = Math.floor((cursor - 1) / 2)
      const parentPriority = this.priorities[parent]!
      const parentIndex = this.indices[parent]!
      if (parentPriority < priority || (parentPriority === priority && parentIndex <= index)) {
        break
      }
      this.indices[cursor] = parentIndex
      this.priorities[cursor] = parentPriority
      cursor = parent
    }
    this.indices[cursor] = index
    this.priorities[cursor] = priority
  }

  pop(): { index: number; priority: number } | null {
    if (!this.indices.length) return null
    const index = this.indices[0]!
    const priority = this.priorities[0]!
    const lastIndex = this.indices.pop()!
    const lastPriority = this.priorities.pop()!
    if (this.indices.length) {
      let cursor = 0
      while (true) {
        const left = cursor * 2 + 1
        const right = left + 1
        if (left >= this.indices.length) break
        let child = left
        if (right < this.indices.length) {
          const leftPriority = this.priorities[left]!
          const rightPriority = this.priorities[right]!
          const leftIndex = this.indices[left]!
          const rightIndex = this.indices[right]!
          if (
            rightPriority < leftPriority ||
            (rightPriority === leftPriority && rightIndex < leftIndex)
          ) {
            child = right
          }
        }
        const childPriority = this.priorities[child]!
        const childIndex = this.indices[child]!
        if (
          childPriority > lastPriority ||
          (childPriority === lastPriority && childIndex >= lastIndex)
        ) {
          break
        }
        this.indices[cursor] = childIndex
        this.priorities[cursor] = childPriority
        cursor = child
      }
      this.indices[cursor] = lastIndex
      this.priorities[cursor] = lastPriority
    }
    return { index, priority }
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function hydrologyNeighborIndex(
  index: number,
  direction: number,
  width: number,
  height: number
): number {
  if (direction < 0 || direction >= HYDROLOGY_DIRECTIONS.length) return -1
  const [dx, dy] = HYDROLOGY_DIRECTIONS[direction]!
  const x = index % width
  const y = Math.floor(index / width)
  const nextX = x + dx
  const nextY = y + dy
  if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return -1
  return nextY * width + nextX
}

export function buildHydrologyRaster(args: {
  width: number
  height: number
  sample: (x: number, y: number, index: number) => HydrologySample
  geomorphology?: GeomorphologyParameters
}): HydrologyRaster {
  const { width, height, sample, geomorphology = DEFAULT_GEOMORPHOLOGY } = args
  const size = width * height
  const rawElevation = new Float32Array(size)
  const filledElevation = new Float32Array(size)
  const water = new Uint8Array(size)
  const slope = new Uint8Array(size)
  const flowDirection = new Int8Array(size)
  const flowAccumulation = new Uint32Array(size)
  const watershed = new Uint32Array(size)
  const depression = new Uint8Array(size)
  const erosionPotential = new Uint8Array(size)
  const sedimentLoad = new Uint8Array(size)
  const deposition = new Uint8Array(size)
  const floodplain = new Uint8Array(size)
  const visited = new Uint8Array(size)
  const heap = new MinHeap()

  flowDirection.fill(-1)

  for (let index = 0; index < size; index += 1) {
    const x = index % width
    const y = Math.floor(index / width)
    const sampled = sample(x, y, index)
    rawElevation[index] = sampled.elevationValue
    filledElevation[index] = sampled.elevationValue
    water[index] = sampled.water ? 1 : 0
  }

  const seedCell = (index: number) => {
    if (visited[index]) return
    visited[index] = 1
    heap.push(index, rawElevation[index]!)
  }

  for (let x = 0; x < width; x += 1) {
    seedCell(x)
    seedCell((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    seedCell(y * width)
    seedCell(y * width + width - 1)
  }
  for (let index = 0; index < size; index += 1) {
    if (water[index]) seedCell(index)
  }

  while (heap.size) {
    const next = heap.pop()
    if (!next) break
    const { index, priority } = next
    if (priority > filledElevation[index]!) continue
    const x = index % width
    const y = Math.floor(index / width)

    for (let direction = 0; direction < HYDROLOGY_DIRECTIONS.length; direction += 1) {
      const [dx, dy] = HYDROLOGY_DIRECTIONS[direction]!
      const nextX = x + dx
      const nextY = y + dy
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
      const neighbor = nextY * width + nextX
      if (visited[neighbor]) continue
      visited[neighbor] = 1
      const spill = Math.max(rawElevation[neighbor]!, priority)
      filledElevation[neighbor] = spill
      flowDirection[neighbor] = OPPOSITE_DIRECTION[direction]!
      heap.push(neighbor, spill)
    }
  }

  for (let index = 0; index < size; index += 1) {
    const direction = flowDirection[index]!
    if (direction < 0) continue
    const downstream = hydrologyNeighborIndex(index, direction, width, height)
    if (downstream < 0) {
      flowDirection[index] = -1
      continue
    }
    const structuralDrop = Math.max(0, filledElevation[index]! - filledElevation[downstream]!)
    const rawDrop = Math.max(0, rawElevation[index]! - rawElevation[downstream]!)
    slope[index] = Math.round(clamp01(Math.max(structuralDrop, rawDrop) * 10) * 255)
    depression[index] = Math.round(
      clamp01(Math.max(0, filledElevation[index]! - rawElevation[index]!) * 12) * 255
    )
  }

  const order = Array.from({ length: size }, (_, index) => index)
  order.sort((left, right) => {
    const filledDelta = filledElevation[right]! - filledElevation[left]!
    if (filledDelta !== 0) return filledDelta
    const rawDelta = rawElevation[right]! - rawElevation[left]!
    if (rawDelta !== 0) return rawDelta
    return right - left
  })

  for (let index = 0; index < size; index += 1) {
    flowAccumulation[index] = water[index] ? 0 : 1
  }
  for (const index of order) {
    const direction = flowDirection[index]!
    if (direction < 0) continue
    const downstream = hydrologyNeighborIndex(index, direction, width, height)
    if (downstream < 0 || downstream === index) continue
    flowAccumulation[downstream] = flowAccumulation[downstream]! + flowAccumulation[index]!
  }

  const resolveWatershed = (start: number): number => {
    if (watershed[start]) return watershed[start]!
    const trail: number[] = []
    let current = start
    while (true) {
      const known = watershed[current]
      if (known) {
        for (const index of trail) watershed[index] = known
        return known
      }
      trail.push(current)
      const direction = flowDirection[current]!
      if (direction < 0) {
        const outletId = current + 1
        for (const index of trail) watershed[index] = outletId
        return outletId
      }
      const downstream = hydrologyNeighborIndex(current, direction, width, height)
      if (downstream < 0 || downstream === current) {
        const outletId = current + 1
        for (const index of trail) watershed[index] = outletId
        return outletId
      }
      current = downstream
    }
  }

  for (let index = 0; index < size; index += 1) {
    resolveWatershed(index)
  }

  const accumulationDenominator = Math.log2(Math.max(2, size + 1))
  const sedimentMass = new Float32Array(size)
  for (const index of order) {
    if (water[index]) continue
    const slopeValue = slope[index]! / 255
    const flowValue = clamp01(Math.log2(flowAccumulation[index]! + 1) / accumulationDenominator)
    const retention = (depression[index]! / 255) * geomorphology.depressionRetention
    const erosion = clamp01(
      (slopeValue * geomorphology.erosionSlopeWeight +
        flowValue * geomorphology.erosionFlowWeight) *
        (1 - retention)
    )
    erosionPotential[index] = Math.round(erosion * 255)
    const available = sedimentMass[index]! + erosion
    const lowSlope = clamp01(1 - slopeValue / Math.max(0.001, geomorphology.depositionSlopeMax))
    const deposited =
      available * clamp01(lowSlope + retention) * (1 - geomorphology.sedimentTransport)
    const transported = Math.max(0, available - deposited) * geomorphology.sedimentTransport
    deposition[index] = Math.round(clamp01(deposited) * 255)
    sedimentLoad[index] = Math.round(clamp01(available) * 255)
    const direction = flowDirection[index]!
    const downstream = hydrologyNeighborIndex(index, direction, width, height)
    if (downstream >= 0 && downstream !== index) {
      sedimentMass[downstream] = sedimentMass[downstream]! + transported
    }
  }

  const floodplainRadius = Math.max(0, Math.floor(geomorphology.floodplainRadius))
  for (let index = 0; index < size; index += 1) {
    if (water[index] || slope[index]! / 255 > geomorphology.floodplainSlopeMax) continue
    const x = index % width
    const y = Math.floor(index / width)
    let nearDrainage = false
    for (let dy = -floodplainRadius; dy <= floodplainRadius && !nearDrainage; dy += 1) {
      for (let dx = -floodplainRadius; dx <= floodplainRadius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > floodplainRadius) continue
        const nextX = x + dx
        const nextY = y + dy
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
        const neighbor = nextY * width + nextX
        const flowValue = Math.log2(flowAccumulation[neighbor]! + 1) / accumulationDenominator
        if (flowValue >= geomorphology.floodplainAccumulationMin) {
          nearDrainage = true
          break
        }
      }
    }
    if (nearDrainage) floodplain[index] = 255
  }

  return {
    width,
    height,
    rawElevation,
    filledElevation,
    water,
    slope,
    flowDirection,
    flowAccumulation,
    watershed,
    depression,
    erosionPotential,
    sedimentLoad,
    deposition,
    floodplain,
  }
}
