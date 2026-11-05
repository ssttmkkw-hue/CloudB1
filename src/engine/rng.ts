// sfc32 伪随机数，状态可序列化（4 个 uint32）
export type RngState = [number, number, number, number];

export function hashSeed(str: string): RngState {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const st: RngState = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  for (let i = 0; i < 12; i++) next(st);
  return st;
}

/** 返回 [0,1) 的浮点数，并原地推进状态 */
export function next(s: RngState): number {
  let [a, b, c, d] = s;
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  s[0] = a >>> 0; s[1] = b >>> 0; s[2] = c >>> 0; s[3] = d >>> 0;
  return (t >>> 0) / 4294967296;
}

export const randInt = (s: RngState, min: number, max: number) => min + Math.floor(next(s) * (max - min + 1));
export const pick = <T>(s: RngState, arr: readonly T[]): T => arr[Math.floor(next(s) * arr.length)];

export function shuffle<T>(s: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function weighted<T>(s: RngState, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = next(s) * total;
  for (const [v, w] of items) {
    r -= w;
    if (r < 0) return v;
  }
  return items[items.length - 1][0];
}
