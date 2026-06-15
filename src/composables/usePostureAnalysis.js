import { ref, watch } from 'vue'

const L_EAR = 7, R_EAR = 8
const L_SHOULDER = 11, R_SHOULDER = 12
const L_HIP = 23, R_HIP = 24

const SMOOTH_FRAMES = 20
const ISSUE_RATIO = 0.6

const DEG = Math.PI / 180

function vis(lm, idx, min = 0.3) {
  return lm[idx] && lm[idx].visibility >= min
}

/**
 * Port of LearnOpenCV findAngle() to normalized landmark coords.
 * Returns the angle (degrees) between segment (x1,y1)→(x2,y2) and the upward vertical.
 * 0° = perfectly vertical, 90° = horizontal.
 */
function findAngle(x1, y1, x2, y2) {
  const dy = y2 - y1, dx = x2 - x1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-6) return 0
  return Math.acos(Math.max(-1, Math.min(1, -dy / len))) * 180 / Math.PI
}

function detectFrame(lm) {
  const none = { headTilt: false, lateralTilt: false, curvedBack: false }
  if (!lm || !vis(lm, L_SHOULDER) || !vis(lm, R_SHOULDER)) return none

  const lS = lm[L_SHOULDER], rS = lm[R_SHOULDER]

  // ── NECK INCLINATION: L_SHOULDER → L_EAR vs vertical ───────────────────
  // Catches head tilting left/right (and nodding down from front camera).
  // Fallback to R_EAR when left ear not visible.
  let headTilt = false
  const earLm = vis(lm, L_EAR, 0.2) ? lm[L_EAR]
              : vis(lm, R_EAR, 0.2) ? lm[R_EAR]
              : null
  if (earLm) {
    const neckAngle = findAngle(lS.x, lS.y, earLm.x, earLm.y)
    headTilt = neckAngle > 20  // > 20° from vertical = head misaligned
  }

  // ── TORSO INCLINATION: L_HIP → L_SHOULDER vs vertical ──────────────────
  // Catches body leaning left/right (and forward from front camera).
  let curvedBack = false
  if (vis(lm, L_HIP)) {
    const torsoAngle = findAngle(lm[L_HIP].x, lm[L_HIP].y, lS.x, lS.y)
    curvedBack = torsoAngle > 10  // > 10° from vertical = spine off-axis
  }

  // ── SHOULDER LATERAL TILT: angle of shoulder line from horizontal ───────
  // Absolute check — horizontal shoulder line = 0°, so no calibration needed.
  const shoulderAngle = Math.abs(Math.atan2(rS.y - lS.y, rS.x - lS.x) / DEG)
  const lateralTilt = shoulderAngle > 5  // > 5° shoulder height asymmetry

  return { headTilt, lateralTilt, curvedBack }
}

export function usePostureAnalysis(landmarks) {
  const frameBuffer = []
  const issues = ref({ headTilt: false, forwardHead: false, roundedShoulders: false, curvedBack: false, lateralTilt: false })

  watch(() => landmarks.value, (lm) => {
    if (!lm) return

    frameBuffer.push(detectFrame(lm))
    if (frameBuffer.length > SMOOTH_FRAMES) frameBuffer.shift()

    const n = frameBuffer.length
    if (n < 3) return

    issues.value = {
      headTilt:         frameBuffer.filter(f => f.headTilt).length / n >= ISSUE_RATIO,
      forwardHead:      false,  // not detectable from front camera without 3D
      roundedShoulders: false,  // not detectable from front camera without 3D
      curvedBack:       frameBuffer.filter(f => f.curvedBack).length / n >= ISSUE_RATIO,
      lateralTilt:      frameBuffer.filter(f => f.lateralTilt).length / n >= ISSUE_RATIO,
    }
  })

  return { issues }
}
