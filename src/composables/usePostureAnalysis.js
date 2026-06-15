import { ref, watch } from 'vue'

// MediaPipe landmark indices
const L_EAR = 7, R_EAR = 8
const L_SHOULDER = 11, R_SHOULDER = 12
const L_HIP = 23, R_HIP = 24

// Smoothing: flag an issue only when it appears in 60%+ of the last 20 frames (~0.7s)
const SMOOTH_FRAMES = 20
const ISSUE_RATIO = 0.6

function vis(lm, idx, min = 0.3) {
  return lm[idx] && lm[idx].visibility >= min
}

/**
 * Detects posture issues using poseWorldLandmarks — real 3D coordinates in meters.
 * Origin is at the hip midpoint; Y points up, Z points toward the camera.
 *
 * Thresholds are in real-world units:
 *  - forwardHead:       ears > 5 cm in front of shoulders (Z axis)
 *  - headTilt:          ear height diff > 3 cm (Y axis) — head tilted left/right
 *  - roundedShoulders:  shoulders > 6 cm in front of hip plane (Z axis)
 *  - curvedBack:        spine angle from vertical > 20°
 *  - lateralTilt:       shoulder height difference > 3 cm (Y axis)
 */
function detectFrame(wlm) {
  const none = { forwardHead: false, headTilt: false, roundedShoulders: false, curvedBack: false, lateralTilt: false }
  if (!vis(wlm, L_SHOULDER) || !vis(wlm, R_SHOULDER)) return none

  const lS = wlm[L_SHOULDER], rS = wlm[R_SHOULDER]
  const sMidY = (lS.y + rS.y) / 2
  const sMidZ = (lS.z + rS.z) / 2

  // ── Shoulder lateral tilt: height difference between shoulders > 3 cm
  const lateralTilt = Math.abs(lS.y - rS.y) > 0.03

  // ── Head issues: forward/backward (Z) and lateral tilt (Y between ears) are separate
  // Use lower visibility threshold (0.2) — ears can be partially occluded when tilted
  let forwardHead = false
  let headTilt = false
  if (vis(wlm, L_EAR, 0.2) && vis(wlm, R_EAR, 0.2)) {
    const earMidZ = (wlm[L_EAR].z + wlm[R_EAR].z) / 2
    // abs covers BOTH: head forward (earMidZ > sMidZ) AND head thrown back (earMidZ < sMidZ)
    forwardHead = Math.abs(earMidZ - sMidZ) > 0.05
    // 2 cm threshold — more sensitive than before (was 3 cm)
    headTilt = Math.abs(wlm[L_EAR].y - wlm[R_EAR].y) > 0.02
  }

  // ── Rounded shoulders: shoulders more than 6 cm in front of hip plane
  let roundedShoulders = false
  if (vis(wlm, L_HIP) && vis(wlm, R_HIP)) {
    const hipMidZ = (wlm[L_HIP].z + wlm[R_HIP].z) / 2
    roundedShoulders = sMidZ - hipMidZ > 0.06
  }

  // ── Curved back: spine angle from vertical > 20° (sagittal plane)
  let curvedBack = false
  if (vis(wlm, L_HIP) && vis(wlm, R_HIP)) {
    const hipMidY = (wlm[L_HIP].y + wlm[R_HIP].y) / 2
    const hipMidZ = (wlm[L_HIP].z + wlm[R_HIP].z) / 2
    const dy = sMidY - hipMidY
    const dz = sMidZ - hipMidZ
    curvedBack = Math.atan2(Math.abs(dz), Math.abs(dy)) > (20 * Math.PI / 180)
  }

  return { forwardHead, headTilt, roundedShoulders, curvedBack, lateralTilt }
}

export function usePostureAnalysis(landmarks, worldLandmarks) {
  const frameBuffer = []
  const issues = ref({ forwardHead: false, headTilt: false, roundedShoulders: false, curvedBack: false, lateralTilt: false })

  watch(() => worldLandmarks.value, (wlm) => {
    if (!wlm) return

    frameBuffer.push(detectFrame(wlm))
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

  return { issues }
}
