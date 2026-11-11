// The AI partner (Duo, offline): any character you pick fights beside you.
// It's there to help, not to carry you: it shoots often but lightly, its
// kills are its own (not yours), enemies ignore it, and it rarely dies (it
// only falls or drowns; then it's back beside you).
export const PARTNER = {
  select: {
    key: 'BACKTICK',                 // the ` key (left of 1): solo → each character → solo (testing, until the menus; F-keys open browser tools)
    storageKey: 'keys-militia.partner',
    // Who can be your partner (BOTS keys). Not the ones that attack by
    // charging or pouncing (Drone, Scrap Bot the bomber, Zombie K9): they
    // don't work as a teammate who keeps its distance and shoots.
    order: ['soldier', 'mercenary', 'commando', 'armouredTrooper', 'zombie', 'skeleton', 'infectedSoldier',
      'android', 'robot', 'alien', 'cyborg', 'mutant'],
  },
  // Its name on your side (its tag and the end screen), where it differs
  // from the enemy one: your Soldier is an Elite.
  callsigns: { Soldier: 'Elite' },
  hpScale: 3,               // much tougher than the enemy version
  regenPerSec: 6,           // heals itself

  // Moving: it replays YOUR path. Every few px you move is a point on it;
  // it goes through the points in order, so it goes wherever you went
  // (tunnels, gaps, flying, dropping down) and never takes its own route.
  path: {
    stepPx: 12,             // a new point each time you've moved this far
    maxPoints: 500,         // (about 6000px of your path is kept)
    reachPx: 14,            // close enough to a point: on to the next
    roomPx: 120,            // it stays this far behind you, measured along the path
    startPx: 60,            // ...and sets off again only once you're this much farther (no stop-go stutter)
    steer: 0.35,            // share of the way to its wanted speed per frame (smooth, no snapping)
    makeWayPx: 56,          // you walk into it: it steps aside
    catchUp: { perPx: 4, maxSpeed: 1000 }, // behind by more than roomPx: 4 px/s faster per px, up to 1000 px/s (you fall up to 900)
    stuckMs: 700,           // no progress toward a point for this long...
    jumpPx: 260,            // ...or your path jumps (you respawned): it hops along to catch up
    lostPx: 900,            // farther than this from you: it reappears behind you
  },
  behindPx: 70,             // where it comes back in after a fall or a respawn: a little behind you

  // Watching
  watchPx: 700,             // it turns to face an enemy it can see this close
  glanceEveryMs: [3500, 6500], // no enemy in sight and you're standing still: now and then it looks behind you

  // Fighting: often, but light hits (about 7-12 to kill)
  attackEveryMs: [1000, 1600], // one attack this often...
  rangePx: 520,             // ...at an enemy this close that it can see
  meleeRangePx: 70,
  damageShare: [0.08, 0.14], // ...doing this share of the enemy's full HP

  respawnMs: 2500,          // after a fall: back beside you
  color: 0x06d6a0,          // its outline and name tag
  bullet: { length: 10, width: 3, color: 0x06d6a0, speed: 1500 },
};
