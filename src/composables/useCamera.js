import { ref, onUnmounted } from 'vue'

export function useCamera() {
  const error = ref(null)
  const isReady = ref(false)
  let stream = null

  async function start(videoEl) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
      })
      videoEl.srcObject = stream
      await new Promise((resolve) => {
        videoEl.onloadedmetadata = () => {
          videoEl.play()
          resolve()
        }
      })
      isReady.value = true
    } catch (err) {
      error.value = err.message
    }
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
    isReady.value = false
  }

  onUnmounted(stop)

  return { error, isReady, start, stop }
}
