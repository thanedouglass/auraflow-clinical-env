# Product Requirements Document (PRD)
## Project: AuraFlow-Clinical (Auditory Neuromodulation Engine)

### 1. Executive Summary & Vision
AuraFlow-Clinical is an interactive, research-grade clinical tool designed to investigate correlations between auditory interventions (Solfeggio frequencies, binaural beats, and polyrhythms) and observable shifts in surface-level electroencephalographic (EEG) activity and behavioral metrics.

Built to meet rigorous academic standards for Human-Centered AI (HCI) and algorithmic safety, this application serves as a high-fidelity data ingestion engine. It maps auditory stimuli to real-time EEG telemetry and autonomic regulation metrics, allowing users to voluntarily share biometric data. This architecture prioritizes transparent data collection, explicit acknowledgment of consumer EEG hardware limitations (frontal/temporal surface recordings only), and federated learning models investigating putative correlations between audio intervention timing and measurable shifts in executive functioning capacity.

### 2. High-Level Architecture (GCP / TypeScript / Python)
The system eschews consumer-facing fluff (no auth flows, no social sharing) in favor of a clinical operator dashboard and a headless biometric processor.

* **Frontend (Clinical Dashboard):** React/TypeScript leveraging HTML Canvas for real-time, low-latency visual rendering of neural data.
* **Backend (Biometric Pipeline):** Python/GCP infrastructure handling the headless audio engine (Hermes) and routing physiological data arrays.
* **Edge Processing:** Elata SDK (WASM) for zero-latency localized EEG analysis.

### 3. Elata SDK Integration & Federated Learning Pipeline
The application must establish a federated learning pipeline by locally analyzing raw EEG data and transmitting anonymized, aggregated metrics capturing surface-level frontal/temporal electrical activity to the central inference model.

The Antigravity sub-agents must utilize the `@elata-biosciences/eeg-web` and `@elata-biosciences/eeg-web-ble` packages to implement the following signal-processing models:

* **`AthenaWasmDecoder` & `BleTransport`:** * Initialize the BLE transport to ingest raw Athena protocol packets from the consumer-grade EEG hardware (Muse 2, Muse S variants).
* **`WasmAlphaBumpDetector`:** * Monitor transient increases in alpha band power (8-13 Hz) to establish temporal correlations between specific auditory stimuli and detectable shifts in surface-level electrical activity. This provides behavioral choice bias data for investigating stimulus-response timing.
* **`WasmAlphaPeakModel`:** * Track the individual alpha peak frequency (8-13 Hz) as a baseline metric for each participant before and during auditory intervention. This reflects localized frontal/temporal electrical activity only.
* **`WasmCalmnessModel`:** * Compute the ongoing alpha-to-beta power ratio (0.0 to 1.0). This metric serves as a standardized measurement of surface-level electroencephalographic correlates associated with reduced behavioral stress response, not a direct measure of subjective stress or deep neural state.

### 4. Core Modules & Agent Instructions

#### A. The Somatic Monitor (HTML Canvas / UI)
* **Requirement:** Build a highly responsive UI using HTML Canvas to plot real-time telemetry from the Elata WASM models, specifically surface-level frontal/temporal EEG metrics.
* **Visuals:** Must display the alpha-to-beta power ratio and overlay temporal markers whenever `WasmAlphaBumpDetector` identifies transient shifts in electrical activity. All visualizations must include explicit disclaimers that these are surface-level recordings, not deep neural imaging.

#### B. The Auditory Intervention Board
* **Requirement:** An interface for the clinical operator to trigger specific auditory stimuli (Solfeggio frequencies, subliminal affirmations at -30dB, polyrhythms).
* **Telemetry Sync:** Every playback event must append a metadata timestamp to the EEG data stream, allowing researchers to analyze temporal correlations between audio stimulus onset and measurable shifts in surface-level electrical activity. This data collection mechanism is explicitly designed for post-hoc behavioral pattern analysis, not for real-time causal inference of audio-EEG relationships.

#### C. The Headless Audio Engine (Hermes Legacy Port)
* **Requirement:** Port the existing `pydub` and `edge-tts` logic from the Ayo's Den `engine_config.json` architecture. 
* **Constraint:** Audio generation remains headless. The UI solely acts as the Control Plane to update `gain_reduction_db` and track the resulting surface-level electrical activity shifts. All correlations identified are descriptive, not prescriptive.

### 5. Repository Scaffolding Rules (Elata Canonical Standards)
Antigravity agents must adhere strictly to Elata's monorepo workflows:
* Use `./run.sh` from the repo root for orchestration.
* Base the initial scaffold on `@elata-biosciences/create-elata-demo`.
* All EEG decoding and signal processing logic must be instantiated locally via WASM to ensure clinical data privacy before federated aggregation.