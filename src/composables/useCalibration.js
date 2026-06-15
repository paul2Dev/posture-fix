import { ref } from 'vue'

export function useCalibration(landmarks) {
  const isCalibrated = ref(false)
  const referencePose = ref(null)
  const countdown = ref(null)

  function startCalibration() {
    let count = 3
    countdown.value = count

    const interval = setInterval(() => {
      count--
      countdown.value = count
      if (count === 0) {
        clearInterval(interval)
        countdown.value = null
        if (landmarks.value) {
          referencePose.value = JSON.parse(JSON.stringify(landmarks.value))
          isCalibrated.value = true
        }
      }
    }, 1000)
  }

  function reset() {
    isCalibrated.value = false
    referencePose.value = null
    countdown.value = null
  }

  return { isCalibrated, referencePose, countdown, startCalibration, reset }
}
