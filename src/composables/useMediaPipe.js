import { ref, onUnmounted } from 'vue'
import { Pose } from '@mediapipe/pose'

export function useMediaPipe() {
  const landmarks = ref(null)
  let pose = null
  let rafId = null
  let active = false

  async function init(videoEl) {
    pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
    })

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    pose.onResults((results) => {
      landmarks.value = results.poseLandmarks ?? null
    })

    await pose.initialize()
    active = true
    loop(videoEl)
  }

  function loop(videoEl) {
    if (!active) return
    rafId = requestAnimationFrame(async () => {
      if (videoEl.readyState >= 2) {
        await pose.send({ image: videoEl })
      }
      loop(videoEl)
    })
  }

  function stop() {
    active = false
    if (rafId) cancelAnimationFrame(rafId)
    if (pose) pose.close()
  }

  onUnmounted(stop)

  return { landmarks, init, stop }
}
