# SKILL: HTML-in-Canvas API Integration (AuraFlow)

## 1. Core Philosophy & Architectural Intent
The HTML-in-Canvas API is a bleeding-edge browser capability (currently Origin Trial in Chrome 148-150) that allows native DOM elements (HTML/CSS) to be drawn directly into `<canvas>` and WebGL/WebGPU textures. 

**For AuraFlow, we use this to achieve "Sovereign UI":**
We maintain the extreme performance of native WebGL/Canvas graphics for our biometric graphs (`EmpiricalPulseGraph`) and neural meshes (`TRIBEv2`), while completely preserving the accessibility, selectability, and CSS-stylability of the open web. We NEVER import heavy external charting libraries (like Chart.js or D3) into the cockpit if native Canvas + HTML-in-Canvas can solve it.

## 2. AuraFlow High-Value Use Cases
When implementing features in the Producer Cockpit, the agent should actively look for opportunities to deploy these three patterns:

1. **The "Holographic" Verification Chip (3D Neural Mesh Integration):**
   Render the Somatic Impact summary (Calmness, Alpha, BPM) as a stylized HTML chip floating *inside* the 3D fMRI brain scan using Three.js `THREE.HTMLTexture`. The UI rotates with the mesh but remains fully selectable and accessible to screen readers.
2. **Somatic Ledger Data-Scrubbing Tooltips (2D Canvas Integration):**
   Instead of calculating complex 2D bounding boxes for graph hover-states, render standard HTML tooltips directly into the 2D biometric Canvas using `ctx.drawElementImage()`. This allows researchers to highlight and copy exact `resonance_score` timestamps natively.
3. **In-Canvas "REFRESHER" Controls:**
   Embed "Start/Stop Capture" or frequency toggle `<button>` elements directly inside the WebGL/Canvas scene, bypassing complex raycasting libraries. The API automatically maps the physical click events to the transformed CSS location.

## 3. Environment & Setup Prerequisites
*Agent Directive: Ensure the project environment is configured for these APIs before attempting to use them.*

* **Browser:** Chrome Canary 149+ with `chrome://flags/#canvas-draw-element` enabled.
* **Ambient Types:** The agent MUST inject these types into `vite-env.d.ts` to prevent TypeScript compilation failures, as standard `lib.dom.d.ts` does not yet include them:

```typescript
// Ambient declarations for the experimental HTML-in-Canvas API
interface CanvasRenderingContext2D {
  drawElementImage(element: HTMLElement, x: number, y: number): DOMMatrix;
}
interface WebGLRenderingContext {
  texElementImage2D(target: number, level: number, internalformat: number, format: number, type: number, source: HTMLElement): void;
}
interface HTMLCanvasElement {
  getElementTransform(element: HTMLElement, screenSpaceTransform: DOMMatrix): DOMMatrix;
  onpaint: ((this: GlobalEventHandlers, ev: Event) => any) | null;
}