import { ref, watch } from 'vue'

const MESSAGES = {
  forwardHead: 'Ridică bărbia și trage capul înapoi',
  roundedShoulders: 'Deschide umerii, trage omoplații înapoi',
  curvedBack: 'Îndreaptă spatele, stai pe șezut',
  lateralTilt: 'Echilibrează greutatea pe ambele șolduri',
}

const DEBOUNCE_MS = 4000

export function usePostureFeedback(issues) {
  const activeMessages = ref([])
  const timers = {}
  const pending = {}

  watch(
    issues,
    (newIssues) => {
      for (const [key, isActive] of Object.entries(newIssues)) {
        if (isActive) {
          if (!pending[key]) {
            pending[key] = setTimeout(() => {
              if (!activeMessages.value.includes(MESSAGES[key])) {
                activeMessages.value = [...activeMessages.value, MESSAGES[key]]
              }
            }, DEBOUNCE_MS)
          }
        } else {
          clearTimeout(pending[key])
          pending[key] = null
          activeMessages.value = activeMessages.value.filter((m) => m !== MESSAGES[key])
        }
      }
    },
    { deep: true }
  )

  return { activeMessages }
}
