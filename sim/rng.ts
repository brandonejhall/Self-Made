// Seeded PRNG (mulberry32). The RNG state lives inside GameState so that
// saves, replays and balance runs reproduce exactly.

export function nextRandom(rngState: number): [value: number, nextState: number] {
  let t = (rngState + 0x6d2b79f5) >>> 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [value, t];
}

export function nextInt(rngState: number, min: number, maxInclusive: number): [number, number] {
  const [v, s] = nextRandom(rngState);
  return [min + Math.floor(v * (maxInclusive - min + 1)), s];
}
