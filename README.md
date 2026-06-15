# Posture Fix

A real-time posture detection web app that uses your camera to analyze sitting posture and give instant visual feedback.

## How it works

The app uses [MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose) to detect 33 body landmarks through your browser camera. A skeleton overlay is drawn on top of the live feed and compared against a calibrated reference pose.

**Detected issues:**
- Forward head
- Rounded shoulders
- Curved back (slouching)
- Lateral tilt (one shoulder higher than the other)

**Feedback:**
- Skeleton segments turn **red** when a posture issue is detected for more than 4 seconds
- A text banner appears at the bottom describing what to correct
- Everything turns back to **green** when posture is corrected

## Stack

- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [MediaPipe Pose](https://www.npmjs.com/package/@mediapipe/pose)
- Deployed on [Vercel](https://vercel.com/)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and allow camera access.

## Usage

1. **Wait** for the AI model to load (indicator disappears top-right)
2. **Sit straight** in your normal good posture
3. **Press "Calibrează postura"** and hold still for the 3-second countdown
4. The app now monitors your posture in real time — skeleton turns red when something is off

You can recalibrate at any time by pressing the button again.

## Project structure

```
src/
├── components/
│   ├── CameraView.vue          # Main view — camera + all overlays
│   ├── SkeletonOverlay.vue     # Canvas skeleton drawing
│   ├── CalibrationOverlay.vue  # Calibration button + countdown
│   ├── PostureFeedback.vue     # Text feedback banner
│   └── StatusRow.vue           # Status panel row component
├── composables/
│   ├── useCamera.js            # Camera access
│   ├── useMediaPipe.js         # MediaPipe Pose integration
│   ├── useCalibration.js       # Calibration logic
│   ├── usePostureAnalysis.js   # Posture deviation analysis
│   └── usePostureFeedback.js   # Debounced feedback (4s timer)
└── utils/
    └── angles.js               # Math helpers
```

## Roadmap

- [ ] User accounts + posture history
- [ ] Personalised exercise recommendations based on detected issues
- [ ] Standing posture detection
- [ ] Session statistics

## Requirements

- A modern browser with camera access (Chrome, Edge, Firefox, Safari)
- HTTPS connection (required for camera — handled automatically by Vercel)
- Works on desktop and mobile (portrait mode)
