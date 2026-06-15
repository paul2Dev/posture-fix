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
        :landmarks="landmarks"
        :issues="issues"
        :is-calibrated="isCalibrated"
        :video-el="videoRef"
      />
    </div>

    <!-- UI layer (not mirrored) -->
    <CalibrationOverlay
      :is-calibrated="isCalibrated"
      :countdown="countdown"
      @calibrate="startCalibration()"
    />
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

    <!-- AI model loading (camera is up, waiting for first pose result) -->
    <div
      v-if="cameraReady && !isInitialized"
      class="absolute top-4 right-4 bg-black/50 text-white text-xs px-3 py-1 rounded-full"
    >
      Se încarcă modelul AI...
    </div>

    <!-- Camera switch button -->
    <button
      v-if="cameraReady"
      @click="switchCamera"
      class="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full active:scale-90 transition-transform"
      :class="{ 'hidden': !isInitialized }"
      aria-label="Schimbă camera"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l2-2m0 0l-2-2m2 2H13" />
      </svg>
    </button>

    <!-- Status panel -->
    <div class="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs p-3 rounded-xl space-y-1.5 min-w-[180px]">
      <div class="font-semibold text-white/70 mb-2 text-[10px] uppercase tracking-wider">
        Status postură
      </div>
      <StatusRow label="Calibrat" :ok="isCalibrated" :active="true" />
      <StatusRow label="Cap înainte" :ok="!issues.forwardHead" :active="isCalibrated" />
      <StatusRow label="Umeri aplecați" :ok="!issues.roundedShoulders" :active="isCalibrated" />
      <StatusRow label="Spate curbat" :ok="!issues.curvedBack" :active="isCalibrated" />
      <StatusRow label="Aplecare laterală" :ok="!issues.lateralTilt" :active="isCalibrated" />
    </div>

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
import CalibrationOverlay from './CalibrationOverlay.vue'
import PostureFeedback from './PostureFeedback.vue'
import StatusRow from './StatusRow.vue'
import { useMediaPipe } from '../composables/useMediaPipe.js'
import { useCalibration } from '../composables/useCalibration.js'
import { usePostureAnalysis } from '../composables/usePostureAnalysis.js'
import { usePostureFeedback } from '../composables/usePostureFeedback.js'

const videoRef = ref(null)

const { landmarks, isInitialized, cameraReady, cameraError, facingMode, init, switchCamera } = useMediaPipe()
const { isCalibrated, referencePose, countdown, startCalibration } = useCalibration(landmarks)
const { issues } = usePostureAnalysis(landmarks, referencePose)
const { activeMessages } = usePostureFeedback(issues)

onMounted(async () => {
  await init(videoRef.value)
})
</script>
