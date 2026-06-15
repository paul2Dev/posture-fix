import { ref, onUnmounted } from 'vue'
// Pose and Camera are loaded as global scripts in index.html (UMD, not ES modules)

export function useMediaPipe() {
  const landmarks = ref(null)
  const isInitialized = ref(false)
  const cameraReady = ref(false)
  const cameraError = ref(null)
  const facingMode = ref('user')
  let pose = null
  let camera = null
  let poseReady = false
  let savedVideoEl = null

  function buildCamera(videoEl) {
    return new window.Camera(videoEl, {
      onFrame: async () => {
        if (poseReady) await pose.send({ image: videoEl })
      },
      width: 1280,
      height: 720,
      facingMode: facingMode.value,
    })
  }

  async function init(videoEl) {
    savedVideoEl = videoEl
    try {
      pose = new window.Pose({
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

      camera = buildCamera(videoEl)

      // Start camera and download WASM concurrently so video appears immediately
      await Promise.all([
        camera.start().then(() => { cameraReady.value = true }),
        pose.initialize().then(() => { poseReady = true }),
      ])
    } catch (err) {
      cameraError.value = err.message
    }
  }

  async function switchCamera() {
    if (!savedVideoEl) return
    if (camera) { camera.stop(); camera = null }
    facingMode.value = facingMode.value === 'user' ? 'environment' : 'user'
    landmarks.value = null
    camera = buildCamera(savedVideoEl)
    await camera.start()
  }

  function stop() {
    poseReady = false
    if (camera) { camera.stop(); camera = null }
    if (pose) { pose.close(); pose = null }
  }

  onUnmounted(stop)

  return { landmarks, isInitialized, cameraReady, cameraError, facingMode, init, switchCamera }
}
