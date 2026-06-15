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

  // ── HEAD LATERAL TILT: angle of ear-to-ear LINE from horizontal ─────────
  // From front camera, ears are at same height when head is level → 0° from horizontal.
  // findAngle(L_SHOULDER→L_EAR) doesn't work from front because the ear is naturally
  // ~25-30° off-axis from the shoulder even in perfect upright posture.
  let headTilt = false
  if (vis(lm, L_EAR, 0.2) && vis(lm, R_EAR, 0.2)) {
    const earLineAngle = Math.abs(Math.atan2(
      lm[R_EAR].y - lm[L_EAR].y,
      lm[R_EAR].x - lm[L_EAR].x
    ) / DEG)
    headTilt = earLineAngle > 10  // > 10° from horizontal = head tilted
  }

  // ── SHOULDER LATERAL TILT: angle of shoulder line from horizontal ───────
  const shoulderAngle = Math.abs(Math.atan2(rS.y - lS.y, rS.x - lS.x) / DEG)
  const lateralTilt = shoulderAngle > 8  // > 8° — natural micro-asymmetry is < 8°

  // ── TORSO LEAN: midpoint-based spine vector vs vertical ─────────────────
  // Use midpoints (not one side) so it's symmetric from front camera.
  let curvedBack = false
  if (vis(lm, L_HIP) && vis(lm, R_HIP)) {
    const hipMidX  = (lm[L_HIP].x + lm[R_HIP].x) / 2
    const hipMidY  = (lm[L_HIP].y + lm[R_HIP].y) / 2
    const sMidX    = (lS.x + rS.x) / 2
    const sMidY    = (lS.y + rS.y) / 2
    const torsoAngle = findAngle(hipMidX, hipMidY, sMidX, sMidY)
    curvedBack = torsoAngle > 8  // > 8° spine off vertical
  }

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
