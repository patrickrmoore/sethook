# Hookset Trainer

Hookset Trainer is a mobile-friendly fishing training PWA that waits a random amount of time, fires a strike indicator, and measures how quickly the angler reacts with a wrist flick.

## Features

- Randomized strike cue timing for reaction drills
- Motion-based hook-set detection using `devicemotion`
- Haptic cue support with `navigator.vibrate()` when available
- Manual strike fallback for testing on desktop
- Installable PWA with manifest and offline caching service worker

## Run locally

- `npm install`
- `npm run dev`

## Build

- `npm run build`
- `npm run preview`

## Usage notes

- For best results, open the app on your phone.
- On iPhone or iPad, tap **Enable motion** if the browser requests permission.
- Haptics depend on browser and device support.
- The service worker caches app assets after first load for repeat offline use.
