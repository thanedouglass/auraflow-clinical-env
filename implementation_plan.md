# AuraFlow-Clinical Engine Initialization

This plan covers the initialization of the AuraFlow-Clinical monorepo, connecting to the GCP/Firebase environment, and building the high-fidelity SomaticMonitor HTML-in-Canvas interface.

## Proposed Changes

### 1. Monorepo Scaffolding & Orchestration

#### [NEW] [run.sh](file:///Users/thanedouglass/Desktop/auraflow-clinical-env/run.sh)
- Create a canonical orchestration script `run.sh` in the repository root.
- The script will execute the `npx -y @elata-biosciences/create-elata-demo@latest ./` command to scaffold the monorepo base according to Elata standards.

### 2. Firebase Hosting Initialization

#### [NEW] [firebase.json](file:///Users/thanedouglass/Desktop/auraflow-clinical-env/firebase.json)
- Set the active Firebase project to `auraflow-clinical-env` using the Firebase CLI (`npx -y firebase-tools@latest use auraflow-clinical-env`).
- Initialize Firebase Hosting (`npx -y firebase-tools@latest init hosting`) to serve the static frontend built by the scaffold, configuring the public directory (likely `dist` or `build`).

### 3. Frontend Canvas & UI Components

#### [MODIFY] [vite-env.d.ts](file:///Users/thanedouglass/Desktop/auraflow-clinical-env/src/vite-env.d.ts) (or equivalent)
- Inject experimental ambient types for the HTML-in-Canvas API (e.g., `drawElementImage`, `texElementImage2D`) to satisfy TypeScript compilation, as directed by `HTML_CANVA.md`.

#### [NEW] [SomaticMonitor.tsx](file:///Users/thanedouglass/Desktop/auraflow-clinical-env/src/components/SomaticMonitor.tsx)
- Build a highly responsive React/TypeScript UI leveraging the native HTML Canvas API.
- Initialize `BleTransport` and `AthenaWasmDecoder` (from `@elata-biosciences/eeg-web` and `@elata-biosciences/eeg-web-ble`) to listen for Athena protocol packets.
- Instantiate `WasmCalmnessModel` to compute ongoing calmness scores locally.
- Instantiate `WasmAlphaBumpDetector` for event markers.
- Continuously render telemetry (calmness score and alpha state transitions) directly onto the 2D canvas context. No external charting libraries will be used.

## Verification Plan

### Automated Tests
- Run `npm run build` (or the equivalent build command) to verify the TypeScript compilation succeeds, especially for the custom HTML-in-Canvas ambient types.

### Manual Verification
- Start the Firebase emulator (`npx -y firebase-tools@latest emulators:start --only hosting`) to verify the static site renders correctly and the canvas initializes without throwing reference errors for the WebAssembly and BLE modules.
