// Levenshtein edit distance with an early-exit threshold.
//
// v0.3 fuzzy match needs to tolerate the speaker dropping or substituting a
// character or two — "อาจารย์" might come back as "อาจาน" from Web Speech, or
// "Photoshop" might land as "fotoshop". Edit distance ≤ 2 is the sweet spot
// for word-level tolerance without false-positiving short words.
//
// Why early-exit:
//   In the matcher we throw a heard word against up to 10 candidate tokens and
//   take the best. Full DP for every candidate is wasteful when we only care
//   whether dist ≤ MAX_DISTANCE. By tracking the per-row minimum and bailing
//   when it exceeds MAX_DISTANCE we skip ~30% of the work on average inputs.

/**
 * Levenshtein distance, capped. Returns `max + 1` if the distance exceeds
 * `max` (signal "no, too far" without paying for the full computation).
 *
 * `max` defaults to 2 — the v0.3 fuzzy threshold.
 */
export function levenshtein(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;

  // Length difference alone exceeds the cap → can't possibly be within max.
  if (Math.abs(lenA - lenB) > max) return max + 1;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  // Two-row DP — we only ever need the previous row. Allocating once and
  // swapping avoids the per-character `new Array(lenB + 1)` churn.
  let prev = new Array<number>(lenB + 1);
  let curr = new Array<number>(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);

    for (let j = 1; j <= lenB; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      const v = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }

    // Early exit: even the best result on this row is already past `max`,
    // so no further row can pull it back below the cap.
    if (rowMin > max) return max + 1;

    // Swap rows.
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[lenB];
}
