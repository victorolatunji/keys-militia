// Mix two 0xRRGGBB colors: t = 0 gives a, t = 1 gives b.
export function blendColor(a, b, t) {
  const mix = (shift) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t) << shift;
  };
  return mix(16) | mix(8) | mix(0);
}