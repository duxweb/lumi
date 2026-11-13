/** Rounds the peak up to four even steps of a short decimal, so every tick reads as a round number. */
export function niceCeiling(value: number): number {
  if (value <= 0)
    return 4
  const raw = value / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10].find(factor => factor * magnitude >= raw)! * magnitude
  return step * 4
}

/** Tick values from the top of the scale down to zero, in four even steps. */
export function scaleTicks(top: number): number[] {
  return [1, 0.75, 0.5, 0.25, 0].map(share => Math.round(top * share))
}
