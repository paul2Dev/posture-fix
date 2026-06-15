import { ref, watch } from 'vue'

const NOSE = 0
const L_EAR = 7, R_EAR = 8
const L_SHOULDER = 11, R_SHOULDER = 12
const L_HIP = 23, R_HIP = 24

const SMOOTH_FRAMES = 20
const ISSUE_RATIO = 0.6
const CALIB_FRAMES = 120  // ~4s at 30fps

const DEG = Math.PI / 180

function vis(lm, idx, min = 0.3) {
  return lm[idx] && lm[idx].visibility >= min
}

/**
 * Hybrid measurement — front-facing camera adaptation of the LearnOpenCV approach.
 *
 * LearnOpenCV (side camera): measures neck/torso angle from VERTICAL using one side only.
 * We (front camera): adapt to front view — lateral checks via 2D line angles,
 *   depth checks via 3D world landmarks.
 *
 * 2D metrics (poseLandmarks — direct image pixels, no 3D estimation error):
 *   shoulderAngle : angle of shoulder line from horizontal → lateral shoulder tilt
 *   earAngle      : angle of ear-to-ear line from horizontal → head lateral tilt
 *   neckAngle     : angle of shoulderMid→nose from vertical → head lean left/right (fallback)
 *   neckHeight    : (shoulderMid.y - nose.y) / shoulderWidth → head height ratio
 *                   Normalized by shoulder width so it's invariant to camera distance.
 *                   Drops when head nods forward, rises when thrown back.
 *   torsoAngle    : angle of hipMid→shoulderMid from vertical → body lean left/right
 *
 * 3D metrics (poseWorldLandmarks — metric coords in meters):
 *   earMidZ       : mean ear Z → head forward/back depth (fallback for neckHeight)
 *   sMidZ, hipZ   : shoulder & hip Z → rounded shoulders
 *   spineAngle    : sagittal spine angle → curved back (fallback for torsoAngle)
 */
function measure(lm, wlm) {
  if (!lm || !vis(lm, L_SHOULDER) || !vis(lm, R_SHOULDER)) return null

  const lS2 = lm[L_SHOULDER], rS2 = lm[R_SHOULDER]
  const shoulderMidX   = (lS2.x + rS2.x) / 2
  const shoulderMidY   = (lS2.y + rS2.y) / 2
  const shoulderWidth  = Math.abs(rS2.x - lS2.x)

  const m = {
    // 2D
    shoulderAngle: Math.atan2(rS2.y - lS2.y, rS2.x - lS2.x),
    earAngle:    null,
    neckAngle:   null,
    neckHeight:  null,
    torsoAngle:  null,
    // 3D
    sMidZ:      null,
    earMidZ:    null,
    hipZ:       null,
    spineAngle: null,
  }

  // 2D ear-to-ear line angle (primary head lateral tilt)
  if (vis(lm, L_EAR, 0.2) && vis(lm, R_EAR, 0.2)) {
    m.earAngle = Math.atan2(lm[R_EAR].y - lm[L_EAR].y, lm[R_EAR].x - lm[L_EAR].x)
  }

  // 2D nose-based metrics — adapted from LearnOpenCV neck inclination for front camera
  if (vis(lm, NOSE) && shoulderWidth > 0.05) {
    const nx = lm[NOSE].x, ny = lm[NOSE].y
    // Angle of neck vector (shoulderMid → nose) from vertical — catches left/right lean
    m.neckAngle  = Math.atan2(nx - shoulderMidX, shoulderMidY - ny)
    // Normalized nose height above shoulders — catches nodding forward/back
    // Invariant to camera distance because both numerator and denominator scale together
    m.neckHeight = (shoulderMidY - ny) / shoulderWidth
  }

  // 2D torso angle from vertical (hipMid → shoulderMid) — lateral body lean
  if (vis(lm, L_HIP) && vis(lm, R_HIP)) {
    const hipMidX = (lm[L_HIP].x + lm[R_HIP].x) / 2
    const hipMidY = (lm[L_HIP].y + lm[R_HIP].y) / 2
    m.torsoAngle = Math.atan2(shoulderMidX - hipMidX, hipMidY - shoulderMidY)
  }

  // 3D world-landmark measurements (depth axis — not visible in 2D)
  if (wlm && vis(wlm, L_SHOULDER) && vis(wlm, R_SHOULDER)) {
    const lS3 = wlm[L_SHOULDER], rS3 = wlm[R_SHOULDER]
    const sMidZ = (lS3.z + rS3.z) / 2
    const sMidY = (lS3.y + rS3.y) / 2
    m.sMidZ = sMidZ

    if (vis(wlm, L_EAR, 0.2) && vis(wlm, R_EAR, 0.2)) {
      m.earMidZ = (wlm[L_EAR].z + wlm[R_EAR].z) / 2
    }

    if (vis(wlm, L_HIP) && vis(wlm, R_HIP)) {
      const hipY = (wlm[L_HIP].y + wlm[R_HIP].y) / 2
      m.hipZ     = (wlm[L_HIP].z + wlm[R_HIP].z) / 2
      m.spineAngle = Math.atan2(sMidZ - m.hipZ, sMidY - hipY)
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
    shoulderAngle: avgOf(frames, 'shoulderAngle'),
    earAngle:      avgOf(frames, 'earAngle'),
    neckAngle:     avgOf(frames, 'neckAngle'),
    neckHeight:    avgOf(frames, 'neckHeight'),
    torsoAngle:    avgOf(frames, 'torsoAngle'),
    sMidZ:         avgOf(frames, 'sMidZ'),
    earMidZ:       avgOf(frames, 'earMidZ'),
    hipZ:          avgOf(frames, 'hipZ'),
    spineAngle:    avgOf(frames, 'spineAngle'),
  }
}

function detectFrame(m, bl) {
  // ── HEAD LATERAL TILT ────────────────────────────────────────────────────
  // Primary: ear line angle. Fallback: neck angle from nose.
  let headTilt = false
  if (m.earAngle !== null && bl.earAngle !== null) {
    headTilt = Math.abs(m.earAngle - bl.earAngle) > 8 * DEG
  } else if (m.neckAngle !== null && bl.neckAngle !== null) {
    headTilt = Math.abs(m.neckAngle - bl.neckAngle) > 8 * DEG
  }

  // ── HEAD FORWARD / BACK ──────────────────────────────────────────────────
  // Primary: neckHeight (2D, distance-invariant ratio — LearnOpenCV concept adapted).
  // Fallback: 3D ear Z delta.
  let forwardHead = false
  if (m.neckHeight !== null && bl.neckHeight !== null) {
    // Ratio dropped = nose closer to shoulders = head forward/down
    // Ratio rose   = nose further from shoulders = head back/up
    forwardHead = Math.abs(m.neckHeight - bl.neckHeight) > 0.10
  } else if (m.earMidZ !== null && bl.earMidZ !== null) {
    forwardHead = Math.abs(m.earMidZ - bl.earMidZ) > 0.015
  }

  // ── SHOULDER LATERAL TILT ────────────────────────────────────────────────
  // Shoulder line rotated > 5° from calibrated angle
  const lateralTilt = bl.shoulderAngle !== null
    ? Math.abs(m.shoulderAngle - bl.shoulderAngle) > 5 * DEG
    : false

  // ── ROUNDED SHOULDERS ────────────────────────────────────────────────────
  // 3D only: shoulder Z gap relative to hips increased (shoulders rolled forward)
  let roundedShoulders = false
  if (m.hipZ !== null && bl.hipZ !== null && m.sMidZ !== null && bl.sMidZ !== null) {
    roundedShoulders = (m.sMidZ - m.hipZ) - (bl.sMidZ - bl.hipZ) > 0.035
  }

  // ── CURVED BACK / BODY LEAN ──────────────────────────────────────────────
  // Primary: 2D torso angle from vertical (catches lateral body lean from front).
  // Fallback: 3D sagittal spine angle (catches forward lean).
  let curvedBack = false
  if (m.torsoAngle !== null && bl.torsoAngle !== null) {
    curvedBack = Math.abs(m.torsoAngle - bl.torsoAngle) > 8 * DEG
  }
  if (!curvedBack && m.spineAngle !== null && bl.spineAngle !== null) {
    curvedBack = Math.abs(m.spineAngle - bl.spineAngle) > 10 * DEG
  }

  return { forwardHead, headTilt, roundedShoulders, curvedBack, lateralTilt }
}

export function usePostureAnalysis(landmarks, worldLandmarks) {
  const frameBuffer = []
  const calibBuffer = []
  let baseline = null

  const isCalibrated  = ref(false)
  const calibProgress = ref(0)
  const issues = ref({ forwardHead: false, headTilt: false, roundedShoulders: false, curvedBack: false, lateralTilt: false })

  watch(() => worldLandmarks.value, (wlm) => {
    const lm = landmarks.value
    if (!lm || !wlm) return
    const m = measure(lm, wlm)
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
