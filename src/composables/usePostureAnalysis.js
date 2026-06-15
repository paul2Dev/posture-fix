import { ref, watch } from 'vue'

const L_EAR = 7, R_EAR = 8
const L_SHOULDER = 11, R_SHOULDER = 12
const L_HIP = 23, R_HIP = 24

const SMOOTH_FRAMES = 20
const ISSUE_RATIO   = 0.6
const CALIB_FRAMES  = 120  // ~4s at 30fps

const DEG = Math.PI / 180

function vis(lm, idx, min = 0.3) {
  return lm[idx] && lm[idx].visibility >= min
}

/**
 * Extract 2D angle measurements per frame.
 * All angles are based on poseLandmarks (direct image pixels — no 3D estimation error).
 *
 * earLineAngle   : angle of ear-to-ear line from horizontal — 0° when head is level
 * shoulderAngle  : angle of shoulder-to-shoulder line from horizontal — 0° when shoulders level
 * spineAngle     : angle of (hipMid→shoulderMid) from vertical — 0° when spine is straight
 *
 * Using midpoints and line-angles means the result is symmetric and camera-distance-invariant.
 * Using calibration-relative deltas means camera placement (angle, height) doesn't matter.
 */
function measure(lm) {
  if (!lm || !vis(lm, L_SHOULDER) || !vis(lm, R_SHOULDER)) return null

  const lS = lm[L_SHOULDER], rS = lm[R_SHOULDER]
  const sMidX = (lS.x + rS.x) / 2
  const sMidY = (lS.y + rS.y) / 2

  const m = {
    earLineAngle:  null,
    shoulderAngle: Math.atan2(rS.y - lS.y, rS.x - lS.x) / DEG,
    spineAngle:    null,
  }

  // Ear-to-ear line angle from horizontal
  if (vis(lm, L_EAR, 0.2) && vis(lm, R_EAR, 0.2)) {
    m.earLineAngle = Math.atan2(
      lm[R_EAR].y - lm[L_EAR].y,
      lm[R_EAR].x - lm[L_EAR].x
    ) / DEG
  }

  // Spine midpoint vector from vertical
  if (vis(lm, L_HIP) && vis(lm, R_HIP)) {
    const hipMidX = (lm[L_HIP].x + lm[R_HIP].x) / 2
    const hipMidY = (lm[L_HIP].y + lm[R_HIP].y) / 2
    const dx = sMidX - hipMidX
    const dy = sMidY - hipMidY  // negative = shoulders above hips (Y down)
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len > 1e-6) {
      // Angle from upward vertical: 0° = straight, increases when leaning
      m.spineAngle = Math.acos(Math.max(-1, Math.min(1, -dy / len))) / DEG
    }
  }

  return m
}

function avgOf(frames, key) {
  const valid = frames.filter(f => f[key] !== null).map(f => f[key])
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

function buildBaseline(frames) {
  return {
    earLineAngle:  avgOf(frames, 'earLineAngle'),
    shoulderAngle: avgOf(frames, 'shoulderAngle'),
    spineAngle:    avgOf(frames, 'spineAngle'),
  }
}

/**
 * All thresholds are DELTAS from the calibrated baseline.
 * Generous values so normal micro-movements don't trigger alerts.
 */
function detectFrame(m, bl) {
  // Head tilted left/right: ear line rotated > 15° from calibrated angle
  const headTilt = m.earLineAngle !== null && bl.earLineAngle !== null
    ? Math.abs(m.earLineAngle - bl.earLineAngle) > 15
    : false

  // One shoulder higher than baseline by > 10°
  const lateralTilt = bl.shoulderAngle !== null
    ? Math.abs(m.shoulderAngle - bl.shoulderAngle) > 10
    : false

  // Spine leaning > 10° more than baseline
  const curvedBack = m.spineAngle !== null && bl.spineAngle !== null
    ? Math.abs(m.spineAngle - bl.spineAngle) > 10
    : false

  return { headTilt, lateralTilt, curvedBack }
}

export function usePostureAnalysis(landmarks) {
  const frameBuffer = []
  const calibBuffer = []
  let baseline = null

  const isCalibrated  = ref(false)
  const calibProgress = ref(0)
  const issues = ref({
    headTilt: false, forwardHead: false,
    roundedShoulders: false, curvedBack: false, lateralTilt: false,
  })

  watch(() => landmarks.value, (lm) => {
    if (!lm) return
    const m = measure(lm)
    if (!m) return

    if (!baseline) {
      calibBuffer.push(m)
      calibProgress.value = Math.min(calibBuffer.length / CALIB_FRAMES, 1)
      if (calibBuffer.length >= CALIB_FRAMES) {
        baseline = buildBaseline(calibBuffer)
        isCalibrated.value = true
      }
      return
    }

    frameBuffer.push(detectFrame(m, baseline))
    if (frameBuffer.length > SMOOTH_FRAMES) frameBuffer.shift()

    const n = frameBuffer.length
    if (n < 3) return

    issues.value = {
      headTilt:         frameBuffer.filter(f => f.headTilt).length / n >= ISSUE_RATIO,
      forwardHead:      false,
      roundedShoulders: false,
      curvedBack:       frameBuffer.filter(f => f.curvedBack).length / n >= ISSUE_RATIO,
      lateralTilt:      frameBuffer.filter(f => f.lateralTilt).length / n >= ISSUE_RATIO,
    }
  })

  return { issues, isCalibrated, calibProgress }
}
