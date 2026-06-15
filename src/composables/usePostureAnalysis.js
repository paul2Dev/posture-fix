import { ref, watch } from 'vue'

const L_EAR = 7, R_EAR = 8
const L_SHOULDER = 11, R_SHOULDER = 12
const L_HIP = 23, R_HIP = 24

const SMOOTH_FRAMES = 20
const ISSUE_RATIO = 0.6
const CALIB_FRAMES = 120  // ~4s at 30fps — silent auto-calibration, no button needed

function vis(lm, idx, min = 0.3) {
  return lm[idx] && lm[idx].visibility >= min
}

// Extract raw measurements from a world-landmark frame
function measure(wlm) {
  if (!vis(wlm, L_SHOULDER) || !vis(wlm, R_SHOULDER)) return null
  const lS = wlm[L_SHOULDER], rS = wlm[R_SHOULDER]
  const sMidZ = (lS.z + rS.z) / 2
  const sMidY = (lS.y + rS.y) / 2
  const m = {
    shoulderYDiff: lS.y - rS.y,   // positive = left shoulder higher
    sMidZ,
    sMidY,
    earMidZ: null,
    earYDiff: null,
    hipZ: null,
    spineAngle: null,
  }
  if (vis(wlm, L_EAR, 0.2) && vis(wlm, R_EAR, 0.2)) {
    m.earMidZ  = (wlm[L_EAR].z + wlm[R_EAR].z) / 2
    m.earYDiff = wlm[L_EAR].y - wlm[R_EAR].y
  }
  if (vis(wlm, L_HIP) && vis(wlm, R_HIP)) {
    const hipY  = (wlm[L_HIP].y + wlm[R_HIP].y) / 2
    m.hipZ      = (wlm[L_HIP].z + wlm[R_HIP].z) / 2
    m.spineAngle = Math.atan2(sMidZ - m.hipZ, sMidY - hipY)  // signed sagittal angle
  }
  return m
}

function avgOf(frames, key) {
  const valid = frames.filter(f => f[key] !== null).map(f => f[key])
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

function buildBaseline(frames) {
  return {
    shoulderYDiff: avgOf(frames, 'shoulderYDiff'),
    sMidZ:        avgOf(frames, 'sMidZ'),
    earMidZ:      avgOf(frames, 'earMidZ'),
    earYDiff:     avgOf(frames, 'earYDiff'),
    hipZ:         avgOf(frames, 'hipZ'),
    spineAngle:   avgOf(frames, 'spineAngle'),
  }
}

// All thresholds are RELATIVE deviations from the calibrated baseline
function detectFrame(m, bl) {
  // Shoulder lateral tilt: height diff changed > 1.5 cm from baseline
  const lateralTilt = Math.abs(m.shoulderYDiff - bl.shoulderYDiff) > 0.015

  // Head: compare Z and Y of ears against calibrated position
  let forwardHead = false, headTilt = false
  if (m.earMidZ !== null && bl.earMidZ !== null) {
    forwardHead = Math.abs(m.earMidZ - bl.earMidZ) > 0.015    // ears moved 1.5 cm on Z from baseline
    if (m.earYDiff !== null && bl.earYDiff !== null) {
      headTilt = Math.abs(m.earYDiff - bl.earYDiff) > 0.012   // head tilted 1.2 cm more than baseline
    }
  }

  // Rounded shoulders: shoulder–hip Z gap increased > 3.5 cm from baseline
  let roundedShoulders = false
  if (m.hipZ !== null && bl.hipZ !== null) {
    const curDiff  = m.sMidZ - m.hipZ
    const baseDiff = bl.sMidZ - bl.hipZ
    roundedShoulders = (curDiff - baseDiff) > 0.035
  }

  // Curved back: sagittal spine angle deviated > 10° from baseline
  let curvedBack = false
  if (m.spineAngle !== null && bl.spineAngle !== null) {
    curvedBack = Math.abs(m.spineAngle - bl.spineAngle) > (10 * Math.PI / 180)
  }

  return { forwardHead, headTilt, roundedShoulders, curvedBack, lateralTilt }
}

export function usePostureAnalysis(landmarks, worldLandmarks) {
  const frameBuffer = []
  const calibBuffer = []
  let baseline = null

  const isCalibrated  = ref(false)
  const calibProgress = ref(0)   // 0→1 during the 2-second calibration window
  const issues = ref({ forwardHead: false, headTilt: false, roundedShoulders: false, curvedBack: false, lateralTilt: false })

  watch(() => worldLandmarks.value, (wlm) => {
    if (!wlm) return
    const m = measure(wlm)
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
      forwardHead:      frameBuffer.filter(f => f.forwardHead).length / n >= ISSUE_RATIO,
      headTilt:         frameBuffer.filter(f => f.headTilt).length / n >= ISSUE_RATIO,
      roundedShoulders: frameBuffer.filter(f => f.roundedShoulders).length / n >= ISSUE_RATIO,
      curvedBack:       frameBuffer.filter(f => f.curvedBack).length / n >= ISSUE_RATIO,
      lateralTilt:      frameBuffer.filter(f => f.lateralTilt).length / n >= ISSUE_RATIO,
    }
  })

  return { issues, isCalibrated, calibProgress }
}
