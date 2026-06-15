import { ref, onUnmounted } from 'vue'
import { Pose } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'

export function useMediaPipe() {
  const landmarks = ref(null)
  const isInitialized = ref(false)
  const cameraReady = ref(false)
  const cameraError = ref(null)
  let pose = null
  let camera = null
  let poseReady = false

  async function init(videoEl) {
    try {
      pose = new Pose({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
      })

      pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      pose.onResults((results) => {
        isInitialized.value = true
        landmarks.value = results.poseLandmarks ?? null
      })

      camera = new Camera(videoEl, {
        onFrame: async () => {
          if (poseReady) await pose.send({ image: videoEl })
        },
        width: 1280,
        height: 720,
        facingMode: 'user',
      })

      // Start camera and download WASM concurrently so video appears immediately
      await Promise.all([
        camera.start().then(() => { cameraReady.value = true }),
        pose.initialize().then(() => { poseReady = true }),
      ])
    } catch (err) {
      cameraError.value = err.message
    }
  }

  function stop() {
    poseReady = false
    if (camera) { camera.stop(); camera = null }
    if (pose) { pose.close(); pose = null }
  }

  onUnmounted(stop)

  return { landmarks, isInitialized, cameraReady, cameraError, init }
}
