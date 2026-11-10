// Gravity per map (Space and Sky Islands are floaty). Everything that rises
// and falls is tuned to the map's gravity so it all feels the same world:
// things fall slower, fly up slower and hang in the air longer, but throws
// still reach about as far (their speed scales with the square root).
export const BASE_GRAVITY = 800;

// k: this map's gravity compared to normal (1 = normal, 0.15 = Space).
export const gravityK = (scene) => (scene?.physics?.world?.gravity?.y ?? BASE_GRAVITY) / BASE_GRAVITY;
// s: how speeds of rising and falling things scale (sqrt of k).
export const fallScale = (scene) => Math.sqrt(gravityK(scene));

// Movement stats for a character on this map.
export function tuneStats(stats, gravity) {
  const k = gravity / BASE_GRAVITY;
  if (Math.abs(k - 1) < 0.001) return stats;
  const s = Math.sqrt(k);
  return {
    ...stats,
    // Thrust: just as much over gravity as normal, scaled down (a softer lift).
    jetThrust: gravity + Math.max(250, (stats.jetThrust - BASE_GRAVITY) * s),
    maxRiseSpeed: stats.maxRiseSpeed * (0.6 + 0.4 * s),
    maxFallSpeed: stats.maxFallSpeed * s,
    descendBoost: stats.descendBoost * s,
    typingFallSpeed: stats.typingFallSpeed * s,
    fuelDrain: stats.fuelDrain * (0.5 + 0.5 * s), // the jetpack goes further
  };
}
