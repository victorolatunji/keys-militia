// Training (Phase 8 step 5): 8 fixed lessons on the Militia Camp map, in
// order, each at its own station. A coach explains in a speech bubble, the
// hint bar shows the keys, the game checks when you've done it, the coach
// says so, and the gate to the next station opens.
// Where things are (spots, targets, gates) comes from the map's "training"
// layer (tools/make-maps.mjs, camp()); TrainingSystem runs the lessons.
//
// A lesson:
//   key      its spot on the map (where the coaches stand)
//   title    shown at the top
//   lines    [coach, text] said in order when it starts ('sarge' or 'tech')
//   keys     the hint bar
//   check    what finishes it:
//              reach    run past the "flag" point
//              perch    land on the "tower" (standing on it)
//              targets  shoot down every target at `points` (a map point name)
//              melee    take the "meleetarget" down with your melee weapon
//              blast    take the "blasttarget" down with a throwable
//              crate    a crate lands on the "pad": take a gun from it
//              fight    two easy enemies drop into the yard: take them down
//   good     what the coach says when you've done it
//   gate     open the next gate when done (lessons sharing a station don't)
export const TRAINING = {
  coaches: {
    sarge: { bot: 'commando', title: 'Sergeant' },  // moving and fighting
    tech: { bot: 'android', title: 'Android R' },   // typing and gear
  },
  targetHp: 20,           // one finished word takes a target down
  lettersPerSec: 40,      // speech bubbles type out this fast
  readMs: 1800,           // a line stays up at least this long (plus 45 ms a letter) before the next
  goodMs: 1600,           // after "Good": the next lesson starts this much later
  coachSpeed: 300,        // coaches run this fast (px/s)...
  coachFly: 420,          // ...and fly this fast with their jetpacks, staying with you
  coachSide: { sarge: 85, tech: -85 }, // where each stays, from you (px; + = to your right)
  enemy: { bot: 'soldier', hp: 0.6, damage: 0.35, reaction: 1.5, typing: 0.6 }, // live fire: easy Soldiers
  storageKey: 'keys-militia.trained', // set once you graduate

  lessons: [
    {
      key: 'move', title: 'Move', check: 'reach', gate: true,
      lines: [
        ['sarge', 'Welcome to the camp, recruit. Let\'s see you move.'],
        ['sarge', 'Left and Right arrows. Run to the flag.'],
      ],
      keys: '←  →   run',
      good: ['sarge', 'Good. You can run. Now fly.'],
    },
    {
      key: 'fly', title: 'Fly', check: 'perch', gate: true,
      lines: [
        ['sarge', 'Hold Up to fire your jetpack.'],
        ['sarge', 'Land on top of the watchtower. Fuel only refills on the ground.'],
        ['sarge', 'Down drops you faster.'],
      ],
      keys: '↑   jetpack      ↑ + ← →   fly sideways      ↓   drop',
      good: ['sarge', 'Nice landing. Come down. Android R takes it from here.'],
    },
    {
      key: 'type', title: 'Type to shoot', check: 'targets', points: 'target', gate: false,
      lines: [
        ['tech', 'Your keyboard is your trigger.'],
        ['tech', 'Every target you can see gets a word. Type it to shoot.'],
        ['tech', 'The first letter locks on. Take down all three.'],
      ],
      keys: 'type the word on a target   ·   the first letter locks on',
      good: ['tech', 'Clean. Now, about mistakes.'],
    },
    {
      key: 'typos', title: 'Typos and moving', check: 'targets', points: 'target2', gate: true,
      lines: [
        ['tech', 'A wrong letter jams your gun for a moment. Stay accurate.'],
        ['tech', 'While you type you stand still. Any arrow moves you again.'],
        ['tech', 'Your half-typed word waits for you. Two more targets.'],
      ],
      keys: 'a typo jams your gun   ·   an arrow stops typing (the word stays)',
      good: ['tech', 'Good hands. The sergeant wants you up close.'],
    },
    {
      key: 'melee', title: 'Switch weapons', check: 'melee', gate: true,
      lines: [
        ['sarge', 'Shift switches weapon: gun 1, gun 2, then melee.'],
        ['sarge', 'Melee words only show up close. Get in there.'],
        ['sarge', 'Take that target down with your melee weapon.'],
      ],
      keys: 'Shift   switch weapon (gun 1 → gun 2 → melee)',
      good: ['sarge', 'That\'s how it\'s done. Now throw something.'],
    },
    {
      key: 'throw', title: 'Throw', check: 'blast', gate: true,
      lines: [
        ['sarge', 'That target hides behind the sandbags. Bullets won\'t reach it.'],
        ['sarge', 'Hold the left mouse button, point past the wall, let go.'],
        ['sarge', 'Or hold Space, aim with Up and Down, release. Tab switches throwable.'],
      ],
      keys: 'hold left mouse + point + release   ·   or hold Space, ↑ ↓ aim, release   ·   Tab   switch throwable',
      good: ['sarge', 'Boom. Supplies are coming in.'],
    },
    {
      key: 'airdrop', title: 'Airdrop', check: 'crate', gate: true,
      lines: [
        ['tech', 'Crates drop from the sky during a fight. One\'s coming in now.'],
        ['tech', 'Walk up to it. Each gun inside has a number: press it to take that gun.'],
        ['tech', 'It goes straight to your hand.'],
      ],
      keys: 'walk to the crate   ·   1-6   take a gun',
      good: ['tech', 'Locked and loaded. Last test, recruit.'],
    },
    {
      key: 'fight', title: 'Live fire', check: 'fight', gate: false,
      lines: [
        ['sarge', 'Two hostiles are dropping into the yard. They shoot back.'],
        ['sarge', 'Use everything you learned. Take them down.'],
      ],
      keys: 'type to shoot   ·   ↑ fly   ·   Shift switch   ·   mouse throw',
      good: ['sarge', 'Yard\'s clear. You\'re ready, soldier.'],
    },
  ],
};
