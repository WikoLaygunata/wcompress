import { pipeline, env } from '@huggingface/transformers'

// Skip checking for local models, fetch from Hugging Face hub and use browser Cache API
env.allowLocalModels = false

let segmentator = null

self.onmessage = async (e) => {
  const { type, data } = e.data

  if (type === 'load') {
    try {
      if (!segmentator) {
        self.postMessage({
          type: 'progress',
          data: { status: 'progress', progress: 10, file: 'config.json' },
        })

        // Use the dedicated 'background-removal' pipeline task.
        segmentator = await pipeline('background-removal', 'Xenova/modnet', {
          progress_callback: (progressData) => {
            self.postMessage({ type: 'progress', data: progressData })
          },
        })

        self.postMessage({
          type: 'progress',
          data: { status: 'progress', progress: 100, file: 'ready' },
        })
      }

      self.postMessage({ type: 'ready' })
    } catch (err) {
      console.error('Worker failed to load model:', err)
      self.postMessage({ type: 'error', error: err.message || String(err) })
    }
  } else if (type === 'remove-bg') {
    if (!segmentator) {
      self.postMessage({ type: 'error', error: 'Model not loaded' })
      return
    }

    try {
      const { imageUri } = data

      // BackgroundRemovalPipeline returns a RawImage with 4 channels (RGBA).
      // The background is already transparent.
      const result = await segmentator(imageUri)

      // result is a RawImage: { data: Uint8ClampedArray, width, height, channels: 4 }
      self.postMessage({
        type: 'result',
        data: {
          width: result.width,
          height: result.height,
          channels: result.channels,
          imageData: result.data,
        },
      })
    } catch (err) {
      console.error('Worker error during segmentation:', err)
      self.postMessage({ type: 'error', error: err.message || String(err) })
    }
  }
}
