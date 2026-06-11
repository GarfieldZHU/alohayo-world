import { generateWorld, type GenerateWorldRequest, type GenerateWorldResponse } from './index'

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<GenerateWorldRequest>) => void) | null
  postMessage(message: GenerateWorldResponse, options: { transfer: ArrayBufferLike[] }): void
}

workerScope.onmessage = (event: MessageEvent<GenerateWorldRequest>) => {
  if (event.data.type !== 'generate') return
  const world = generateWorld(event.data.seed, event.data.width, event.data.height)
  const response: GenerateWorldResponse = { type: 'generated', world }
  workerScope.postMessage(response, {
    transfer: [
      world.elevation.buffer,
      world.moisture.buffer,
      world.temperature.buffer,
      world.biomes.buffer,
      world.landmass.buffer,
      world.waterbody.buffer,
    ],
  })
}
