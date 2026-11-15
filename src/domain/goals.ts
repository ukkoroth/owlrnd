/**
 * Rules §3: progress counts consecutive qualifying exams in the track, newest backwards, and resets to 0 on an
 * exam below X.
 */
export function goalProgress(scoresOldestFirst: number[], threshold: number): number {
  let run = 0;
  for (let i = scoresOldestFirst.length - 1; i >= 0 && scoresOldestFirst[i]! >= threshold; i--) run++;
  return run;
}

export function goalReached(progress: number, runLength: number): boolean {
  return progress >= runLength;
}
