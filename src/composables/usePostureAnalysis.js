import { ref, watch } from 'vue'

const NOSE = 0
const L_EAR = 7, R_EAR = 8
const L_SHOULDER = 11, R_SHOULDER = 12
const L_HIP = 23, R_HIP = 24

const SMOOTH_FRAMES = 20  // ~0.7s at 30fps
const ISSUE_RATIO = 0.6   // issue flagged when present in 60%+ of recent frames

function vis(lm, idx, min = 0.3) {
  return lm[idx] && lm[idx].visibility >= min
}

function detectFrame(lm) {
  const none = { forwardHead: false, roundedShoulders: false, curvedBack: false, lateralTilt: false }
  if (!vis(lm, L_SHOULDER) || !vis(lm, R_SHOULDER)) return none

  const lS = lm[L_SHOULDER], rS = lm[R_SHOULDER]
  const shoulderWidth = Math.abs(rS.x - lS.x)
  const shoulderMidX = (lS.x + rS.x) / 2
  const shoulderMidZ = (lS.z + rS.z) / 2

  // Lateral tilt: shoulder height asymmetry > 5% of frame height
  const lateralTilt = Math.abs(lS.y - rS.y) > 0.05

  // Forward head: ears/nose more forward (lower Z) than shoulders
  let forwardHead = false
  if (vis(lm, L_EAR) && vis(lm, R_EAR)) {
    const earMidZ = (lm[L_EAR].z + lm[R_EAR].z) / 2
    forwardHead = shoulderMidZ - earMidZ > 0.08
  } else if (vis(lm, NOSE)) {
    forwardHead = shoulderMidZ - lm[NOSE].z > 0.10
  }

  // Curved back: horizontal offset between shoulder mid and hip mid, normalized by shoulder width
  let curvedBack = false
  if (vis(lm, L_HIP) && vis(lm, R_HIP) && shoulderWidth > 0.01) {
    const hipMidX = (lm[L_HIP].x + lm[R_HIP].x) / 2
    curvedBack = Math.abs(shoulderMidX - hipMidX) / shoulderWidth > 0.25
  }

  // Rounded shoulders: shoulders more forward (lower Z) than hips
  let roundedShoulders = false
  if (vis(lm, L_HIP) && vis(lm, R_HIP)) {
    const hipMidZ = (lm[L_HIP].z + lm[R_HIP].z) / 2
    roundedShoulders = hipMidZ - shoulderMidZ > 0.10
  }

  return { forwardHead, roundedShoulders, curvedBack, lateralTilt }
}

export function usePostureAnalysis(landmarks) {
  const frameBuffer = []
  const issues = ref({ forwardHead: false, roundedShoulders: false, curvedBack: false, lateralTilt: false })

  watch(() => landmarks.value, (lm) => {
    if (!lm) return

    frameBuffer.push(detectFrame(lm))
    if (frameBuffer.length > SMOOTH_FRAMES) frameBuffer.shift()

    const n = frameBuffer.length
    if (n < 3) return

    issues.value = {
      forwardHead:       frameBuffer.filter(f => f.forwardHead).length / n >= ISSUE_RATIO,
      roundedShoulders:  frameBuffer.filter(f => f.roundedShoulders).length / n >= ISSUE_RATIO,
      curvedBack:        frameBuffer.filter(f => f.curvedBack).length / n >= ISSUE_RATIO,
      lateralTilt:       frameBuffer.filter(f => f.lateralTilt).length / n >= ISSUE_RATIO,
    }
  })

  return { issues }
}
