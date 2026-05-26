# Context & Terminology Document
## Project: AuraFlow-Clinical (Auditory Neuromodulation Engine)

## Language & Terminology

**AuraFlow Data Engine**:
The core autonomous biometric processing layer that synchronizes raw EEG telemetry with specific sonic interventions to track nervous system regulation. 
_Avoid_: Producer cockpit, mixing board, music player.

**Sonic Intervention**:
A targeted acoustic frequency profile (e.g., Solfeggio frequencies, binaural beats, polyrhythms) deployed specifically to facilitate somatic down-regulation and bypass digital/algorithmic conditioning.
_Avoid_: Sound track, audio fix, background music.

**Biometric Grounding**:
The baseline clinical boundary ensuring all generated metrics (calmness scores, alpha peak tracking) are derived strictly from localized, raw EEG data via WASM models, rather than qualitative user assumptions or generative hallucination.

## Flagged Ambiguities & Constraints

- **Fidelity Dependency:** The engine relies strictly on hardware telemetry ("garbage in, garbage out"). Generative layers and subagents must *never* invent biometric data points, smooth over missing packets, or fabricate alpha bumps to artificially inflate the intervention's success metric.
- **Guardrail Enforcement:** System operations must continuously reinforce zero-latency localized processing (via `@elata-biosciences/eeg-web`). Data privacy must be maintained locally before any anonymized aggregation is passed to the federated learning pipeline.

## Antigravity CLI Subagent Architecture

When executing commands, Antigravity CLI must utilize the following multi-agent orchestration pattern to compartmentalize the frontend, backend, and SDK integrations:

Your prompt → Orchestrator Agent
                ├── reads & profiles the Elata SDK PRD and context
                ├── defines subagent roles autonomously for clinical deployment
                ├── spawns eeg_wasm_integrator    ──┐ (Configures Elata calmness/alpha models)
                ├── spawns headless_audio_engine  ──┤ (Routes Solfeggio/binaural interventions)
                └── spawns canvas_renderer        ──┘ (Builds the low-latency HTML Canvas UI)
                         ↓ (all finish)
                Orchestrator: assembles → SomaticMonitor Dashboard (React/TypeScript)