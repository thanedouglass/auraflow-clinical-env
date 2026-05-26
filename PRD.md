# Product Requirements Document (PRD)
## Project: AuraFlow-Clinical (Auditory Neuromodulation Engine)

### 1. Executive Summary & Vision
AuraFlow-Clinical is an interactive, research-grade clinical tool designed to validate the efficacy of sonic interventions (Solfeggio frequencies, binaural beats, and polyrhythms) in regulating the human nervous system. 

Built to meet rigorous academic standards for Human-Centered AI (HCI) and algorithmic safety, this application serves as a high-fidelity data ingestion engine. It maps auditory stimuli to real-time neural responses, allowing users to voluntarily share brain data. This architecture will bypass algorithmic conditioning, providing direct somatic verification and acting as a primary data feeder for federated learning models assessing cognitive repair.

### 2. High-Level Architecture (GCP / TypeScript / Python)
The system eschews consumer-facing fluff (no auth flows, no social sharing) in favor of a clinical operator dashboard and a headless biometric processor.

* **Frontend (Clinical Dashboard):** React/TypeScript leveraging HTML Canvas for real-time, low-latency visual rendering of neural data.
* **Backend (Biometric Pipeline):** Python/GCP infrastructure handling the headless audio engine (Hermes) and routing physiological data arrays.
* **Edge Processing:** Elata SDK (WASM) for zero-latency localized EEG analysis.

### 3. Elata SDK Integration & Federated Learning Pipeline
The application must establish a federated learning pipeline by locally analyzing raw EEG data and transmitting anonymized, aggregated calmness and alpha metrics to the central model.

The Antigravity sub-agents must utilize the `@elata-biosciences/eeg-web` and `@elata-biosciences/eeg-web-ble` packages to implement the following models:

* **`AthenaWasmDecoder` & `BleTransport`:** * Initialize the BLE transport to ingest raw Athena protocol packets from the hardware headbands.
* **`WasmAlphaBumpDetector`:** * Monitor transient increases in alpha band power to map exact timestamps of state transitions occurring precisely when specific Solfeggio frequencies are introduced via the audio engine.
* **`WasmAlphaPeakModel`:** * Track the individual alpha peak frequency (8-13 Hz) as a baseline metric for each clinical participant before and during the auditory intervention.
* **`WasmCalmnessModel`:** * Compute the ongoing calmness score (alpha-to-beta power ratio). This 0.0 to 1.0 score serves as the primary quantitative validation of stress reduction, replacing legacy qualitative interviews.

### 4. Core Modules & Agent Instructions

#### A. The Somatic Monitor (HTML Canvas / UI)
* **Requirement:** Build a highly responsive UI using HTML Canvas (`HTML_CANVA.md` skills) to plot real-time telemetry from the Elata WASM models.
* **Visuals:** Must display the `WasmCalmnessModel` score and overlay visual markers whenever `WasmAlphaBumpDetector` triggers a state transition.

#### B. The Auditory Intervention Board
* **Requirement:** An interface for the clinical operator to trigger specific auditory stimuli (Solfeggio frequencies, subliminal affirmations at -30dB, polyrhythms).
* **Telemetry Sync:** Every playback event must append a metadata timestamp to the EEG data stream, allowing researchers to perfectly correlate a 528Hz frequency drop with a subsequent shift in the participant's alpha peak.

#### C. The Headless Audio Engine (Hermes Legacy Port)
* **Requirement:** Port the existing `pydub` and `edge-tts` logic from the Ayo's Den `engine_config.json` architecture. 
* **Constraint:** Audio generation remains headless. The UI solely acts as the Control Plane to update `gain_reduction_db` and track the resulting biometric shifts.

### 5. Repository Scaffolding Rules (Elata Canonical Standards)
Antigravity agents must adhere strictly to Elata's monorepo workflows:
* Use `./run.sh` from the repo root for orchestration.
* Base the initial scaffold on `@elata-biosciences/create-elata-demo`.
* All EEG decoding and signal processing logic must be instantiated locally via WASM to ensure clinical data privacy before federated aggregation.