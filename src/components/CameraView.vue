<template>
  <div class="relative w-full h-full bg-black overflow-hidden">

    <!-- Mirrored layer: video + skeleton share the same transform so coords align -->
    <div class="absolute inset-0" style="transform: scaleX(-1);">
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

    <!-- Loading state -->
    <div
      v-if="!cameraReady && !cameraError"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-white text-center">
        <div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p class="text-sm">Se încarcă camera...</p>
      </div>
    </div>

    <div
      v-if="cameraReady && !landmarks"
      class="absolute top-4 right-4 bg-black/50 text-white text-xs px-3 py-1 rounded-full"
    >
      Se încarcă modelul AI...
    </div>

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
import { useCamera } from '../composables/useCamera.js'
import { useMediaPipe } from '../composables/useMediaPipe.js'
import { useCalibration } from '../composables/useCalibration.js'
import { usePostureAnalysis } from '../composables/usePostureAnalysis.js'
import { usePostureFeedback } from '../composables/usePostureFeedback.js'

const videoRef = ref(null)

const { error: cameraError, isReady: cameraReady, start: startCamera } = useCamera()
const { landmarks, init: initMediaPipe } = useMediaPipe()
const { isCalibrated, referencePose, countdown, startCalibration } = useCalibration(landmarks)
const { issues } = usePostureAnalysis(landmarks, referencePose)
const { activeMessages } = usePostureFeedback(issues)

onMounted(async () => {
  await startCamera(videoRef.value)
  if (cameraReady.value) {
    await initMediaPipe(videoRef.value)
  }
})
</script>
