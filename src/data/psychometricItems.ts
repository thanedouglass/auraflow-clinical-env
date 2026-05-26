/**
 * Item bank for the AuraFlow baseline psychometric intake.
 *
 * Source of truth: PSYCHOMETRIC_SPEC.md at the repo root.
 *
 *   ERQ  — Gross & John (2003): 10 items, 1-7 Likert (no reversals).
 *   DERS — Gratz & Roemer (2004): 36 items, 1-5 Likert. Some items are
 *          reverse-scored — the per-item `weighting` array embeds the
 *          numeric value emitted for each visible option position (left to
 *          right in scale order), so the scoring step doesn't need a
 *          separate "reverse-keyed" list.
 *
 * The UI never shows the weighting numbers — only the option labels — so
 * participants experience a poll, not a clinical instrument.
 */

export type Instrument = 'ERQ' | 'DERS';

export interface PsychometricItem {
  id: string;
  instrument: Instrument;
  /** 1-based item number within the instrument (matches the spec). */
  number: number;
  prompt: string;
  /**
   * Weighting array. Index N corresponds to the Nth option as displayed in
   * the UI (left → right in scale order). The number stored at that index is
   * the score that the response contributes to the subscale total.
   *
   * ERQ: always [1,2,3,4,5,6,7].
   * DERS standard:  [1,2,3,4,5].
   * DERS reverse:   [5,4,3,2,1].
   */
  weighting: number[];
  /** ERQ subscale assignment. Undefined for DERS. */
  subscale?: 'reappraisal' | 'suppression';
}

const ERQ_SCALE: number[] = [1, 2, 3, 4, 5, 6, 7];

const ERQ_REAPPRAISAL = new Set([1, 3, 5, 7, 8, 10]);

export const ERQ_OPTIONS: Array<{ value: number; label: string; hint?: string }> = [
  { value: 1, label: '1', hint: 'Strongly disagree' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4', hint: 'Neutral' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7', hint: 'Strongly agree' },
];

export const DERS_OPTIONS: Array<{ label: string }> = [
  { label: 'Almost never' },
  { label: 'Sometimes' },
  { label: 'About half the time' },
  { label: 'Most of the time' },
  { label: 'Almost always' },
];

const ERQ_ITEMS_RAW: Array<{ n: number; prompt: string }> = [
  { n: 1, prompt: "When I want to feel more positive emotion (such as joy or amusement), I change what I'm thinking about." },
  { n: 2, prompt: 'I keep my emotions to myself.' },
  { n: 3, prompt: 'When I want to feel less negative emotion (such as sadness or anger), I change what I’m thinking about.' },
  { n: 4, prompt: 'When I am feeling positive emotions, I am careful not to express them.' },
  { n: 5, prompt: "When I'm faced with a stressful situation, I make myself think about it in a way that helps me stay calm." },
  { n: 6, prompt: 'I control my emotions by not expressing them.' },
  { n: 7, prompt: "When I want to feel more positive emotion, I change the way I'm thinking about the situation." },
  { n: 8, prompt: "I control my emotions by changing the way I think about the situation I'm in." },
  { n: 9, prompt: 'When I am feeling negative emotions, I make sure not to express them.' },
  { n: 10, prompt: 'When I want to feel less negative emotion, I change the way I’m thinking about the situation.' },
];

const STD = [1, 2, 3, 4, 5];
const REV = [5, 4, 3, 2, 1];

// Per-item weighting arrays from PSYCHOMETRIC_SPEC.md. Items with a leading
// weighting of 5 are reverse-scored.
const DERS_ITEMS_RAW: Array<{ n: number; prompt: string; weighting: number[] }> = [
  { n: 1, prompt: 'I am clear about my feelings.', weighting: REV },
  { n: 2, prompt: 'I pay attention to how I feel.', weighting: REV },
  { n: 3, prompt: 'I experience my emotions as overwhelming and out of control.', weighting: STD },
  { n: 4, prompt: 'I have no idea how I am feeling.', weighting: STD },
  { n: 5, prompt: 'I have difficulty making sense out of my feelings.', weighting: STD },
  { n: 6, prompt: 'I am attentive to my feelings.', weighting: REV },
  { n: 7, prompt: 'I know exactly how I am feeling.', weighting: REV },
  { n: 8, prompt: 'I care about what I am feeling.', weighting: REV },
  { n: 9, prompt: 'I am confused about how I feel.', weighting: STD },
  { n: 10, prompt: "When I'm upset, I acknowledge my emotions.", weighting: REV },
  { n: 11, prompt: "When I'm upset, I become angry with myself for feeling that way.", weighting: STD },
  { n: 12, prompt: "When I'm upset, I become embarrassed for feeling that way.", weighting: STD },
  { n: 13, prompt: "When I'm upset, I have difficulty getting work done.", weighting: STD },
  { n: 14, prompt: "When I'm upset, I become out of control.", weighting: STD },
  { n: 15, prompt: "When I'm upset, I believe that I will remain that way for a long time.", weighting: STD },
  { n: 16, prompt: "When I'm upset, I believe that I'll end up feeling very depressed.", weighting: STD },
  { n: 17, prompt: "When I'm upset, I believe that my feelings are valid and important.", weighting: REV },
  { n: 18, prompt: "When I'm upset, I have difficulty focusing on other things.", weighting: STD },
  { n: 19, prompt: "When I'm upset, I feel out of control.", weighting: STD },
  { n: 20, prompt: "When I'm upset, I can still get things done.", weighting: REV },
  { n: 21, prompt: "When I'm upset, I feel ashamed with myself for feeling that way.", weighting: STD },
  { n: 22, prompt: "When I'm upset, I know that I can find a way to eventually feel better.", weighting: REV },
  { n: 23, prompt: "When I'm upset, I feel like I am weak.", weighting: STD },
  { n: 24, prompt: "When I'm upset, I feel like I can remain in control of my behaviours.", weighting: REV },
  { n: 25, prompt: "When I'm upset, I feel guilty for feeling that way.", weighting: STD },
  { n: 26, prompt: "When I'm upset, I have difficulty concentrating.", weighting: STD },
  { n: 27, prompt: "When I'm upset, I have difficulty controlling my behaviours.", weighting: STD },
  { n: 28, prompt: "When I'm upset, I believe that there is nothing I can do to make myself feel better.", weighting: STD },
  { n: 29, prompt: "When I'm upset, I become irritated with myself for feeling that way.", weighting: STD },
  { n: 30, prompt: "When I'm upset, I start to feel very bad about myself.", weighting: STD },
  { n: 31, prompt: "When I'm upset, I believe that wallowing in it is all I can do.", weighting: STD },
  { n: 32, prompt: "When I'm upset, I lose control over my behaviours.", weighting: STD },
  { n: 33, prompt: "When I'm upset, I have difficulty thinking about anything else.", weighting: STD },
  { n: 34, prompt: "When I'm upset, I take time to figure out what I'm really feeling.", weighting: REV },
  { n: 35, prompt: "When I'm upset, it takes me a long time to feel better.", weighting: STD },
  { n: 36, prompt: "When I'm upset, my emotions feel overwhelming.", weighting: STD },
];

export const PSYCHOMETRIC_ITEMS: PsychometricItem[] = [
  ...ERQ_ITEMS_RAW.map<PsychometricItem>(({ n, prompt }) => ({
    id: `erq-${n}`,
    instrument: 'ERQ',
    number: n,
    prompt,
    weighting: ERQ_SCALE,
    subscale: ERQ_REAPPRAISAL.has(n) ? 'reappraisal' : 'suppression',
  })),
  ...DERS_ITEMS_RAW.map<PsychometricItem>(({ n, prompt, weighting }) => ({
    id: `ders-${n}`,
    instrument: 'DERS',
    number: n,
    prompt,
    weighting,
  })),
];

export interface PsychometricScores {
  erq: {
    reappraisal: number;
    suppression: number;
    reappraisalMean: number;
    suppressionMean: number;
  };
  ders: {
    total: number;
    /** Mean per item, on the 1-5 scale. */
    mean: number;
  };
  answeredAt: number;
}

/**
 * Compute baseline scores from the recorded response map.
 *
 * `responses` is keyed by item id and stores the *option index* the
 * participant selected (0-based). The weighting array on each item is
 * indexed by that same position, so reverse-scoring is implicit.
 */
export function scoreResponses(
  responses: Record<string, number>,
  items: PsychometricItem[] = PSYCHOMETRIC_ITEMS,
): PsychometricScores {
  let reappraisalSum = 0;
  let reappraisalCount = 0;
  let suppressionSum = 0;
  let suppressionCount = 0;
  let dersSum = 0;
  let dersCount = 0;

  for (const item of items) {
    const optionIndex = responses[item.id];
    if (optionIndex === undefined) continue;
    const weight = item.weighting[optionIndex];
    if (typeof weight !== 'number') continue;

    if (item.instrument === 'ERQ') {
      if (item.subscale === 'reappraisal') {
        reappraisalSum += weight;
        reappraisalCount += 1;
      } else {
        suppressionSum += weight;
        suppressionCount += 1;
      }
    } else {
      dersSum += weight;
      dersCount += 1;
    }
  }

  return {
    erq: {
      reappraisal: reappraisalSum,
      suppression: suppressionSum,
      reappraisalMean: reappraisalCount ? reappraisalSum / reappraisalCount : 0,
      suppressionMean: suppressionCount ? suppressionSum / suppressionCount : 0,
    },
    ders: {
      total: dersSum,
      mean: dersCount ? dersSum / dersCount : 0,
    },
    answeredAt: Date.now(),
  };
}
