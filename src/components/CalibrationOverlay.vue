<template>
  <!-- Countdown display -->
  <div
    v-if="countdown !== null"
    class="absolute inset-0 flex items-center justify-center pointer-events-none"
  >
    <div class="text-white font-bold drop-shadow-lg" style="font-size: 20vw; line-height: 1;">
      {{ countdown }}
    </div>
  </div>

  <!-- Calibration button -->
  <div class="absolute bottom-24 left-0 right-0 flex justify-center">
    <button
      v-if="countdown === null"
      @click="$emit('calibrate')"
      class="px-6 py-3 rounded-full font-semibold text-sm shadow-lg transition-all active:scale-95"
      :class="isCalibrated
        ? 'bg-white/20 text-white border border-white/40 hover:bg-white/30'
        : 'bg-white text-black hover:bg-gray-100'"
    >
      {{ isCalibrated ? 'Recalibrează' : 'Calibrează postura' }}
    </button>
  </div>

  <!-- Instructions before first calibration -->
  <div
    v-if="!isCalibrated && countdown === null"
    class="absolute bottom-40 left-0 right-0 flex justify-center pointer-events-none"
  >
    <div class="bg-black/50 text-white text-sm px-4 py-2 rounded-full">
      Stai drept și apasă „Calibrează postura"
    </div>
  </div>
</template>

<script setup>
defineProps({
  isCalibrated: { type: Boolean, default: false },
  countdown: { type: Number, default: null },
})
defineEmits(['calibrate'])
</script>
