<template>
  <div class="relative w-full h-full bg-black overflow-hidden">

    <!-- Video + skeleton: mirrored only for front camera -->
    <div class="absolute inset-0" :style="facingMode === 'user' ? 'transform: scaleX(-1)' : ''">
      <video
        ref="videoRef"
        class="absolute inset-0 w-full h-full object-cover"
        playsinline
        muted
      />
      <SkeletonOverlay
        ref="skeletonRef"
        :landmarks="landmarks"
        :issues="issues"
        :is-calibrated="true"
        :video-el="videoRef"
      />
    </div>

    <PostureFeedback :active-messages="activeMessages" />

    <!-- Camera loading -->
    <div
      v-if="!cameraReady && !cameraError"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-white text-center">
        <div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p class="text-sm">Se încarcă camera...</p>
      </div>
    </div>

    <!-- AI model loading -->
    <div
      v-if="cameraReady && !isInitialized"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div class="text-white text-center">
        <div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p class="text-sm">Se încarcă modelul AI...</p>
      </div>
    </div>

    <!-- Status panel -->
    <div class="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs p-3 rounded-xl space-y-1.5 min-w-[180px]">
      <div class="font-semibold text-white/70 mb-2 text-[10px] uppercase tracking-wider">
        Status postură
      </div>
      <StatusRow label="Cap înainte"       :ok="!issues.forwardHead"      :active="isInitialized" />
      <StatusRow label="Umeri aplecați"    :ok="!issues.roundedShoulders" :active="isInitialized" />
      <StatusRow label="Spate curbat"      :ok="!issues.curvedBack"       :active="isInitialized" />
      <StatusRow label="Aplecare laterală" :ok="!issues.lateralTilt"      :active="isInitialized" />
    </div>

    <!-- Camera switch button -->
    <button
      v-if="cameraReady"
      @click="switchCamera"
      class="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full active:scale-90 transition-transform"
      aria-label="Schimbă camera"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l2-2m0 0l-2-2m2 2H13" />
      </svg>
    </button>

    <!-- Photo capture button -->
    <button
      v-if="isInitialized"
      @click="capturePhoto"
      class="absolute bottom-8 right-6 bg-white text-black p-3 rounded-full shadow-lg active:scale-90 transition-transform"
      aria-label="Fă o poză"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>

    <div
      v-if="cameraError"
      class="absolute inset-0 flex items-center justify-center bg-black"
    >
      <div class="text-white text-center p-8 max-w-sm">
        <p class="text-lg font-semibold mb-2">Nu pot accesa camera</p>
        <p class="text-sm text-gray-400">{{ cameraError }}</p>
        <p class="text-xs text-gray-500 mt-4">
          Asigură-te că ai dat permisiunea de acces la cameră în browser.
        </p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SkeletonOverlay from './SkeletonOverlay.vue'
import PostureFeedback from './PostureFeedback.vue'
import StatusRow from './StatusRow.vue'
import { useMediaPipe } from '../composables/useMediaPipe.js'
import { usePostureAnalysis } from '../composables/usePostureAnalysis.js'
import { usePostureFeedback } from '../composables/usePostureFeedback.js'

const videoRef = ref(null)
const skeletonRef = ref(null)

const { landmarks, isInitialized, cameraReady, cameraError, facingMode, init, switchCamera } = useMediaPipe()
const { issues } = usePostureAnalysis(landmarks)
const { activeMessages } = usePostureFeedback(issues)

onMounted(async () => {
  await init(videoRef.value)
})

function capturePhoto() {
  const videoEl = videoRef.value
  const skeletonCanvas = skeletonRef.value?.canvas
  if (!videoEl || !skeletonCanvas || !skeletonCanvas.width) return

  const w = skeletonCanvas.width
  const h = skeletonCanvas.height

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')

  // Draw video with same object-cover rect as SkeletonOverlay uses
  const vW = videoEl.videoWidth, vH = videoEl.videoHeight
  if (!vW || !vH) return
  const scale = Math.max(w / vW, h / vH)
  const drawW = vW * scale, drawH = vH * scale
  const offX = (w - drawW) / 2, offY = (h - drawH) / 2

  ctx.drawImage(videoEl, offX, offY, drawW, drawH)

  // Draw skeleton on top (canvas content is in unmirrored coords, matching video)
  ctx.drawImage(skeletonCanvas, 0, 0)

  out.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `postura-${Date.now()}.jpg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/jpeg', 0.9)
}
</script>
