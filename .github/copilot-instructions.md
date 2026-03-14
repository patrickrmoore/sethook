- [x] Verify that the copilot-instructions.md file in the .github directory is created.
  - Created and restored after scaffolding.

- [x] Clarify Project Requirements
  - Vite React TypeScript PWA for fishing reaction training with random strike cues, haptics, and wrist-flick timing.

- [x] Scaffold the Project
  - Scaffolded the app in the current workspace with Vite React TypeScript.

- [x] Customize the Project
  - Replaced the starter template with the Hookset Trainer experience, motion detection, install prompt handling, and offline support.

- [x] Install Required Extensions
  - No extensions needed.

- [x] Compile the Project
  - Verified `npm run build` and `npm run lint` complete successfully.

- [x] Create and Run Task
  - Added and started a background `dev server` task using `npm run dev -- --host`.

- [ ] Launch the Project
  - Dev server is running. Ask before setting up a debug launch configuration.

- [x] Ensure Documentation is Complete
  - Updated README and restored this file with current project details.

- Keep the app mobile-first and test motion input on a physical device.
- Prefer `navigator.vibrate()` and `devicemotion` when supported, with graceful fallbacks when they are not.
- Preserve the current simple offline service worker unless deployment requirements change.
