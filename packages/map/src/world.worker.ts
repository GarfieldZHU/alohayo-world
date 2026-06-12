import {
  applyMapAreas,
  generateWorld,
  type GenerateWorldRequest,
  type GenerateWorldResponse,
} from './index'

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<GenerateWorldRequest>) => void) | null
  postMessage(message: GenerateWorldResponse, options: { transfer: ArrayBufferLike[] }): void
}

workerScope.onmessage = (event: MessageEvent<GenerateWorldRequest>) => {
  if (event.data.type !== 'generate') return
  let world = generateWorld(event.data.seed, event.data.width, event.data.height)
  if (event.data.mapAreas?.length && event.data.terrainCodes) {
    world = applyMapAreas(world, event.data.mapAreas, event.data.terrainCodes)
  }
  const response: GenerateWorldResponse = { type: 'generated', world }
  workerScope.postMessage(response, {
    transfer: [
      world.elevation.buffer,
      world.moisture.buffer,
      world.temperature.buffer,
      world.biomes.buffer,
      world.landmass.buffer,
      world.waterbody.buffer,
      world.authoredArea.buffer,
    ],
  })
}
