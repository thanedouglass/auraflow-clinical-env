export type SolfeggioProfile = {
  frequency: number;
  targetVector: number[];
};

export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length.');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i += 1) {
    const a = vectorA[i];
    const b = vectorB[i];

    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export const SOLFEGGIO_PROFILES: SolfeggioProfile[] = [
  {
    frequency: 396,
    targetVector: [0.78, 0.12, 0.22],
  },
  {
    frequency: 417,
    targetVector: [0.62, 0.18, 0.48],
  },
  {
    frequency: 528,
    targetVector: [0.91, 0.28, 0.15],
  },
];

export function getOptimalSolfeggio(userVector: number[]): number {
  if (userVector.length !== 3) {
    throw new Error('User vector must have exactly three values.');
  }

  let bestFrequency = SOLFEGGIO_PROFILES[0].frequency;
  let bestScore = -Infinity;

  for (const profile of SOLFEGGIO_PROFILES) {
    const score = cosineSimilarity(userVector, profile.targetVector);

    if (score > bestScore) {
      bestScore = score;
      bestFrequency = profile.frequency;
    }
  }

  return bestFrequency;
}