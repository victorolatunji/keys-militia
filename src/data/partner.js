// The AI partner (Duo, offline): any character you pick fights beside you.
// It's there to help, not to carry you: it shoots now and then, its kills
// are its own (not yours), enemies ignore it, and it rarely dies (it only
// falls or drowns; then it's back beside you).
export const PARTNER = {
  select: {
    key: 'BACKTICK',                 // the ` key (left of 1): solo → each character → solo (testing, until the menus; F-keys open browser tools)
    storageKey: 'keys-militia.partner',
    // Every character can be your partner (BOTS keys), even a Drone or a K9.
    order: ['soldier', 'mercenary', 'commando', 'armouredTrooper', 'zombie', 'skeleton', 'infectedSoldier',
      'android', 'robot', 'drone', 'scrapBot', 'alien', 'cyborg', 'mutant', 'zombieK9'],
  },
  hpScale: 3,               // much tougher than the enemy version
  regenPerSec: 6,           // heals itself
  followPx: { min: 0, max: 40 },   // how close it gets to the spot it's heading for
  spacePx: 110,             // it gives you this much room: closer than this, it holds
  makeWayPx: 60,            // closer than this (you walked into it): it steps aside
  trailEveryMs: 60,         // it walks your path: your position is noted this often...
  trailDelayMs: 450,        // ...and it follows where you were this long ago (through tunnels, up and down, in the air)
  trailLength: 60,          // (about 3.5s of your path is kept)
  behindPx: 70,             // where it comes back in after a fall: a little behind you
  glanceEveryMs: [3500, 6500], // no enemy in sight: now and then it looks the other way, watching your back
  watchPx: 700,
  catchUp: { farPx: 200, speed: 1.35 }, // farther than this behind you: it moves this much faster             // it turns to face an enemy this close
  catchUpPx: 900,           // farther than this from you (off screen): it catches up
  attackEveryMs: [2600, 4200], // one attack this often...
  rangePx: 520,             // ...at an enemy this close that it can see
  meleeRangePx: 70,
  damageShare: [0.2, 0.35], // ...doing this share of the enemy's full HP
  respawnMs: 2500,          // after a fall: back beside you
  color: 0x06d6a0,          // its outline and name tag
  bullet: { length: 10, width: 3, color: 0x06d6a0, speed: 1500 },
};
