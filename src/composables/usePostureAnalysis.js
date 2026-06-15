import { computed } from 'vue'

const NOSE = 0
const L_EAR = 7, R_EAR = 8
const L_SHOULDER = 11, R_SHOULDER = 12

const THRESHOLD = 0.025 // 2.5% of normalized frame

function vis(lm, idx, min = 0.5) {
  return lm[idx] && lm[idx].visibility >= min
}

function getMetrics(lm) {
  const hasEars = vis(lm, L_EAR) && vis(lm, R_EAR)
  const hasShoulders = vis(lm, L_SHOULDER) && vis(lm, R_SHOULDER)
  const hasNose = vis(lm, NOSE)

  const avgShoulderY = hasShoulders ? (lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2 : null
  const avgEarY = hasEars ? (lm[L_EAR].y + lm[R_EAR].y) / 2 : null

  return {
    // Ears drop toward shoulders when head tilts forward or body slouches
    earToShoulder: hasEars && hasShoulders ? avgEarY - avgShoulderY : null,
    // Shoulder width narrows when they roll forward
    shoulderWidth: hasShoulders ? Math.abs(lm[R_SHOULDER].x - lm[L_SHOULDER].x) : null,
    // Nose drops toward shoulders when slouching
    noseToShoulder: hasNose && hasShoulders ? lm[NOSE].y - avgShoulderY : null,
    // Vertical asymmetry between shoulders
    lateralDiff: hasShoulders ? lm[L_SHOULDER].y - lm[R_SHOULDER].y : null,
  }
}

export function usePostureAnalysis(landmarks, referencePose) {
  const issues = computed(() => {
    const none = { forwardHead: false, roundedShoulders: false, curvedBack: false, lateralTilt: false }
    if (!landmarks.value || !referencePose.value) return none

    const cur = getMetrics(landmarks.value)
    const ref = getMetrics(referencePose.value)

    return {
      // Ears closer to shoulders than in reference = head forward / neck tilt
      forwardHead: cur.earToShoulder !== null && ref.earToShoulder !== null
        ? ref.earToShoulder - cur.earToShoulder > THRESHOLD
        : false,
      // Shoulders narrower than reference = rolling forward
      roundedShoulders: cur.shoulderWidth !== null && ref.shoulderWidth !== null
        ? ref.shoulderWidth - cur.shoulderWidth > THRESHOLD
        : false,
      // Nose dropped closer to shoulders = slouching / curved back
      // noseToShoulder is negative (nose above shoulders), increases toward 0 when slouching
      curvedBack: cur.noseToShoulder !== null && ref.noseToShoulder !== null
        ? cur.noseToShoulder - ref.noseToShoulder > THRESHOLD
        : false,
      // Asymmetric shoulder height vs reference
      lateralTilt: cur.lateralDiff !== null && ref.lateralDiff !== null
        ? Math.abs(cur.lateralDiff - ref.lateralDiff) > THRESHOLD
        : false,
    }
  })

  const hasAnyIssue = computed(() => Object.values(issues.value).some(Boolean))

  return { issues, hasAnyIssue }
}
