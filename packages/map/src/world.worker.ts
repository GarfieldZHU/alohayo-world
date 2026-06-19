import {
  applyMapAreas,
  generateChunkWithAreas,
  generateWorld,
  type WorldWorkerRequest,
  type WorldWorkerResponse,
} from './index'

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorldWorkerRequest>) => void) | null
  postMessage(message: WorldWorkerResponse, options: { transfer: ArrayBufferLike[] }): void
}

workerScope.onmessage = (event: MessageEvent<WorldWorkerRequest>) => {
  if (event.data.type === 'generate') {
    let world = generateWorld(
      event.data.seed,
      event.data.width,
      event.data.height,
      event.data.biomeDefinitions
    )
    if (event.data.mapAreas?.length && event.data.terrainCodes) {
      world = applyMapAreas(
        world,
        event.data.mapAreas,
        event.data.terrainCodes,
        event.data.biomeDefinitions
      )
    }
    workerScope.postMessage(
      { type: 'generated', id: event.data.id, world },
      {
        transfer: [
          world.elevation.buffer,
          world.moisture.buffer,
          world.temperature.buffer,
          world.biomes.buffer,
          world.landmass.buffer,
          world.waterbody.buffer,
          world.authoredArea.buffer,
        ],
      }
    )
    return
  }

  if (event.data.type !== 'generate-chunk') return
  const chunk = generateChunkWithAreas(
    event.data.seed,
    event.data.chunkX,
    event.data.chunkY,
    event.data.chunkSize,
    event.data.surveyWidth,
    event.data.surveyHeight,
    event.data.mapAreas ?? [],
    event.data.terrainCodes ?? {},
    event.data.biomeDefinitions
  )
  workerScope.postMessage(
    { type: 'generated-chunk', id: event.data.id, chunk },
    {
      transfer: [
        chunk.elevation.buffer,
        chunk.moisture.buffer,
        chunk.temperature.buffer,
        chunk.biomes.buffer,
        chunk.authoredArea.buffer,
        chunk.region.buffer,
      ],
    }
  )
}
