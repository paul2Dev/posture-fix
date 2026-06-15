<template>
  <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  landmarks: { type: Array, default: null },
  issues: { type: Object, default: () => ({}) },
  isCalibrated: { type: Boolean, default: false },
  videoEl: { type: Object, default: null },
})

const canvasRef = ref(null)

// MediaPipe indices
const NOSE = 0
const L_EAR = 7, R_EAR = 8
const L_SHOULDER = 11, R_SHOULDER = 12
const L_ELBOW = 13, R_ELBOW = 14
const L_WRIST = 15, R_WRIST = 16
const L_HIP = 23, R_HIP = 24
const L_KNEE = 25, R_KNEE = 26
const L_ANKLE = 27, R_ANKLE = 28

// Structura scheletului conform descrierii:
// Cap → Gât → Umeri (Y sus)
// Gât → Șolduri (triunghi jos: gât + șold stâng + șold drept)
// Umeri → Coate → Încheieturi (brațe)
// Șolduri → Genunchi → Glezne (picioare)

function segmentColor(type) {
  if (!props.isCalibrated) return '#22c55e'
  const { forwardHead, headTilt, roundedShoulders, curvedBack, lateralTilt } = props.issues
  if (type === 'head' && (forwardHead || headTilt)) return '#ef4444'
  if (type === 'shoulder' && (roundedShoulders || lateralTilt)) return '#ef4444'
  if (type === 'torso' && curvedBack) return '#ef4444'
  return '#22c55e'
}

function getVideoRect(canvas) {
  const video = props.videoEl
  if (!video || !video.videoWidth || !video.videoHeight) {
    return { offsetX: 0, offsetY: 0, drawW: canvas.width, drawH: canvas.height }
  }
  const cW = canvas.width, cH = canvas.height
  const vW = video.videoWidth, vH = video.videoHeight
  // object-cover: scale so both dimensions fill the container, cropping overflow
  const scale = Math.max(cW / vW, cH / vH)
  const drawW = vW * scale
  const drawH = vH * scale
  const offsetX = (cW - drawW) / 2
  const offsetY = (cH - drawH) / 2
  return { offsetX, offsetY, drawW, drawH }
}

function toCanvas(lm, rect) {
  return { x: lm.x * rect.drawW + rect.offsetX, y: lm.y * rect.drawH + rect.offsetY }
}

function ok(lm, min = 0.2) {
  return lm && lm.visibility >= min
}

function drawSegment(ctx, pa, pb, color) {
  // Glow
  ctx.beginPath()
  ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y)
  ctx.strokeStyle = color + '33'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke()
  // Line
  ctx.beginPath()
  ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y)
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke()
}

function drawJoint(ctx, x, y, size, color) {
  const outer = size + 2
  ctx.beginPath(); ctx.arc(x, y, outer, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill()
  ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'; ctx.fill()
  ctx.beginPath(); ctx.arc(x, y, size * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = color; ctx.fill()
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!props.landmarks) return

  const lm = props.landmarks
  const rect = getVideoRect(canvas)

  // Calculez punctul virtual de gât: 50% între midpoint umeri și nas
  const hasShoulders = ok(lm[L_SHOULDER]) && ok(lm[R_SHOULDER])
  const hasNose = ok(lm[NOSE])
  if (!hasShoulders) return

  const midX = (lm[L_SHOULDER].x + lm[R_SHOULDER].x) / 2
  const midY = (lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2
  const neckLm = {
    x: midX,
    y: hasNose ? midY + (lm[NOSE].y - midY) * 0.5 : midY - 0.06,
  }

  const pNeck = toCanvas(neckLm, rect)
  const pHead = hasNose ? toCanvas(lm[NOSE], rect) : null
  const pLS = toCanvas(lm[L_SHOULDER], rect)
  const pRS = toCanvas(lm[R_SHOULDER], rect)
  const pLEar = ok(lm[L_EAR], 0.2) ? toCanvas(lm[L_EAR], rect) : null
  const pREar = ok(lm[R_EAR], 0.2) ? toCanvas(lm[R_EAR], rect) : null

  const cHead = segmentColor('head')
  const cShoulder = segmentColor('shoulder')
  const cTorso = segmentColor('torso')

  // — URECHI → NAS (triunghi cap)
  if (pHead && pLEar) drawSegment(ctx, pLEar, pHead, cHead)
  if (pHead && pREar) drawSegment(ctx, pREar, pHead, cHead)
  if (pLEar && pREar) drawSegment(ctx, pLEar, pREar, cHead)  // linia ureche-ureche

  // — REFERINȚĂ VERTICALĂ (ca în LearnOpenCV): linie punctată de la umărul stâng în sus
  // Arată vizual față de ce unghi se măsoară neck inclination
  {
    const refLen = 80  // px
    const refX = pLS.x, refY = pLS.y
    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = cHead + '80'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(refX, refY)
    ctx.lineTo(refX, refY - refLen)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // — CAP (nas) → GÂT
  if (pHead) drawSegment(ctx, pHead, pNeck, cHead)

  // — GÂT → UMERI (Y superior)
  drawSegment(ctx, pNeck, pLS, cShoulder)
  drawSegment(ctx, pNeck, pRS, cShoulder)

  // — BRAȚE
  if (ok(lm[L_ELBOW])) {
    const p = toCanvas(lm[L_ELBOW], rect)
    drawSegment(ctx, pLS, p, '#22c55e')
    if (ok(lm[L_WRIST])) drawSegment(ctx, p, toCanvas(lm[L_WRIST], rect), '#22c55e')
  }
  if (ok(lm[R_ELBOW])) {
    const p = toCanvas(lm[R_ELBOW], rect)
    drawSegment(ctx, pRS, p, '#22c55e')
    if (ok(lm[R_WRIST])) drawSegment(ctx, p, toCanvas(lm[R_WRIST], rect), '#22c55e')
  }

  // — TRIUNGHI TRUNCHI: Gât → Șold stâng → Șold drept → Gât
  const hasLHip = ok(lm[L_HIP]), hasRHip = ok(lm[R_HIP])
  if (hasLHip) {
    const p = toCanvas(lm[L_HIP], rect)
    // Referință verticală de la șoldul stâng (torso inclination reference)
    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = cTorso + '80'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x, p.y - 60)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
    drawSegment(ctx, pNeck, p, cTorso)
    if (ok(lm[L_KNEE])) {
      const pk = toCanvas(lm[L_KNEE], rect)
      drawSegment(ctx, p, pk, '#22c55e')
      if (ok(lm[L_ANKLE])) drawSegment(ctx, pk, toCanvas(lm[L_ANKLE], rect), '#22c55e')
    }
  }
  if (hasRHip) {
    const p = toCanvas(lm[R_HIP], rect)
    drawSegment(ctx, pNeck, p, cTorso)
    if (ok(lm[R_KNEE])) {
      const pk = toCanvas(lm[R_KNEE], rect)
      drawSegment(ctx, p, pk, '#22c55e')
      if (ok(lm[R_ANKLE])) drawSegment(ctx, pk, toCanvas(lm[R_ANKLE], rect), '#22c55e')
    }
  }
  if (hasLHip && hasRHip) {
    drawSegment(ctx, toCanvas(lm[L_HIP], rect), toCanvas(lm[R_HIP], rect), cTorso)
  }

  // — PUNCTE ARTICULAȚII
  if (pLEar) drawJoint(ctx, pLEar.x, pLEar.y, 4, cHead)
  if (pREar) drawJoint(ctx, pREar.x, pREar.y, 4, cHead)
  if (pHead) drawJoint(ctx, pHead.x, pHead.y, 7, cHead)
  drawJoint(ctx, pNeck.x, pNeck.y, 5, cShoulder)
  drawJoint(ctx, pLS.x, pLS.y, 5, cShoulder)
  drawJoint(ctx, pRS.x, pRS.y, 5, cShoulder)
  for (const idx of [L_ELBOW, R_ELBOW, L_WRIST, R_WRIST]) {
    if (ok(lm[idx])) { const { x, y } = toCanvas(lm[idx], rect); drawJoint(ctx, x, y, 4, '#22c55e') }
  }
  for (const idx of [L_HIP, R_HIP]) {
    if (ok(lm[idx])) { const { x, y } = toCanvas(lm[idx], rect); drawJoint(ctx, x, y, 5, cTorso) }
  }
  for (const idx of [L_KNEE, R_KNEE, L_ANKLE, R_ANKLE]) {
    if (ok(lm[idx])) { const { x, y } = toCanvas(lm[idx], rect); drawJoint(ctx, x, y, 4, '#22c55e') }
  }

  // — INELE PULSANTE pe articulațiile cheie
  drawPulsingRings(ctx, lm, rect, pHead, pLEar, pREar, pLS, pRS)
}

function drawPulsingRings(ctx, lm, rect, pHead, pLEar, pREar, pLS, pRS) {
  const { forwardHead, headTilt, roundedShoulders, lateralTilt, curvedBack } = props.issues
  const t = (Date.now() % 1400) / 1400
  const pulse = (Math.sin(t * Math.PI * 2) + 1) / 2  // 0→1→0

  function ring(pt, hasIssue) {
    if (!pt) return
    const color = hasIssue ? '#ef4444' : '#22c55e'
    const radius = hasIssue ? 16 + pulse * 10 : 14
    const alpha  = hasIssue ? 0.35 + pulse * 0.45 : 0.18
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = hasIssue ? 2.5 : 1.5
    ctx.globalAlpha = alpha
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  if (pHead) ring(pHead, forwardHead)       // nas: cap înainte / spate
  if (pLEar) ring(pLEar, headTilt)          // ureche stângă: cap lateral
  if (pREar) ring(pREar, headTilt)          // ureche dreaptă: cap lateral

  const shoulderIssue = roundedShoulders || lateralTilt
  ring(pLS, shoulderIssue)
  ring(pRS, shoulderIssue)

  if (ok(lm[L_HIP])) ring(toCanvas(lm[L_HIP], rect), curvedBack)
  if (ok(lm[R_HIP])) ring(toCanvas(lm[R_HIP], rect), curvedBack)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const parent = canvas?.parentElement
  if (!canvas || !parent) return
  canvas.width = parent.clientWidth
  canvas.height = parent.clientHeight
  draw()
}

defineExpose({ canvas: canvasRef })

watch(() => props.landmarks, draw, { deep: true })

const resizeObserver = new ResizeObserver(resizeCanvas)
onMounted(() => {
  resizeCanvas()
  if (canvasRef.value?.parentElement) resizeObserver.observe(canvasRef.value.parentElement)
})
onUnmounted(() => resizeObserver.disconnect())
</script>
