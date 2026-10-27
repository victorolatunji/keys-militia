# Keys Militia
*A VAO game. Living plan book: update it whenever the plan changes.*

**Version:** 0.10
**Owner:** Victor Olatunji / VAO
**Budget:** $0, free tools and free assets only
**Status:** Phase 4 complete. Phase 4.5 (Arsenal I) next.
**Live build:** https://victorolatunji.github.io/keys-militia/

---

## 1. Pitch
A 2D arena shooter **influenced by Mini Militia**, but its own game: **typing is your weapon**. Move with arrows or mouse, and type the word above an enemy to fire at them.

## 2. Pillars
1. **Move or type, never both at once.** Reposition, then fight.
2. **Typing = power.** Speed and accuracy win, not aim.
3. **Every map plays differently.** Each one has its own hazard and advantage.
4. **Fair.** The best gear comes from airdrops, not from paying.
5. **Plays in the browser.** No download.

---

## 3. Controls
| Action | Input |
|---|---|
| Run / face | Left, Right |
| Jetpack | Up (combine for diagonals: Up+Right, Down+Left, etc.) |
| Drop / descend | Down |
| Shoot | Type the word on an enemy (locks on by first letter) |
| Switch gun | Shift |
| Throw | Hold Space, aim with Up/Down, release (hold longer = farther) |
| Pick from crate or drop panel | 1 / 2 (gun slot), 3 (throwable) |
| Alt movement (setting) | Hold right-click to fly toward the cursor |

**Move or type rule:**
- When you start typing, your character **stops moving and auto-faces** the target. On the ground you hold position; **in the air you drift down slowly** (no hovering in place).
- Press any arrow to move again. Your half-typed word stays saved.
- Only a **fresh** arrow press cancels typing. Holding an arrow while you start typing does not.
- Words use **lowercase letters only**, so Shift, Space, digits and arrows never clash with typing.

---

## 4. Combat
- **Line of sight:** words only appear on enemies you can actually hit **and that are on screen**. Behind a wall or off screen, no word. Checked with a tile raycast from your eyes to the target.
- **Leaving sight** hides the word and breaks your lock. Coming back into sight gives a different word.
- **One word = one shot.** A new word spawns after each hit until the enemy dies.
- **Shots are instant (hitscan) and always hit:** finishing a word hits immediately with a tracer. Guns get no travel time, so a correctly typed word is never wasted (decided in 0.9).
- **Range falloff:** gun damage drops with distance from you to the target. Full damage up to `startPx`, then a straight line down to `minMultiplier` at `endPx` (per gun, `falloff` in `weapons.js`). Weakened hits show a paler damage number. The sniper has no falloff.
- After a shot you **stay in typing mode**, so you can chain words. Press an arrow to move.
- You **auto-face** your locked target with every correct letter.
- **Enemy HP** decides how many shots it takes (health bar shown above the enemy).
- **Weapon** decides word length and damage (pistol = short words, low damage; sniper = long words, high damage).
- **No reloads.** Your typing speed is your fire rate. (Ammo counts arrive in Phase 4.5; still no reload button.)
- **Typo** = a wrong letter on your locked word, or a first letter that matches no word. The gun jams briefly (0.5s, `typoJamMs` in `player.js`) and letters typed during the jam are ignored. The lock breaks and progress resets, but the word stays the same so you can retry it.
- **Word refresh:** words change every ~8 to 12 seconds (shorter on Hard, longer on Easy; range in `WORD_REFRESH` in `words.js`), after every hit, and when an enemy leaves and re-enters line of sight. Each target has its own timer, so words don't all change at once.
- **Word lock:** once you type the first letter, that word never changes until you finish it, make a typo, or the enemy dies or leaves your sight.
- **Unique first letters:** no two words on screen start with the same letter, so lock-on is never ambiguous.
- **Multiplayer:** each player sees their own words on enemies. Nobody can read what you're about to type, and players never race for the same word.
- **Obstacles** (walls, rocks, mountains) block bullets. Ricochet only on specific weapons.
- **Throwables** go over cover and hit enemies with no word showing. **Damage falloff:** full damage within `directHitRadius`, falling to 0 at `blastRadius`. Walls between the blast and a target block it. Your own throwables hurt you (`selfDamage`).
- **Collisions:** characters (you, dummies, bots) are solid to each other. Landed crates are solid to everything and stack; falling crates pass through characters. A crate whose center lands over empty space tips off the edge. Grenades bounce off terrain, crates and characters, and ignore the thrower for 0.3s after the throw (`ownerIgnoreMs`).
- **Blast knockback:** survivors get pushed away from the blast and up a little, stronger with more damage (full push at `knockbackFullAt`). Right after a push you have no control for a moment (`knockbackStaggerMs` in `player.js`), so a blast near the edge can throw you into the void. Stationary dummies don't move; bots will.
- **Hit effects:** blood particles and pain sounds. **Death:** body splits into pieces (gibs).
- **Gore toggle** in settings: Off / Cartoon (default) / Full.

---

## 5. Loadout and pickups
**Slots:** 2 guns + 1 throwable.

**Default spawn:** melee + a basic SMG or assault rifle (usable, not the best). Players spawn by dropping in from the sky.

**Airdrops:** crates parachute down on a timer (one every ~20s, max 2 on the map), swaying as they fall. Each crate holds one item. A landed crate vanishes after ~40s (blinks first). Tuning in `src/data/airdrops.js`.

**Pickup panel:**
- Get **near** a landed crate or a dropped item (no need to touch it): it gets a yellow outline and a panel at the bottom of the screen shows what's inside.
- The game **does not pause**, so you can get killed while choosing.
- **1 / 2** swap that gun slot; your old gun goes into the crate so you can swap back. **3** takes throwables (same type tops you up to `maxCarry`). A gun you already hold can't be taken twice. Move away and the panel closes.
- Swapping the gun in your hand counts as a weapon switch (lock breaks, words re-roll).

**Death drops:** when you die, your guns and throwables pop out where you fell. Anyone can grab them with the same panel. They vanish after **60 seconds** (blink first); at most 8 on the map. Nothing drops in the void. You respawn with the default loadout.

**Arsenal (planned for phases 4.5 and 5.5):**
- **The weapon decides the words:** each category sets word length, how many words make one attack, and reach.
- **Categories:** melee (knife, machete, hammer, spade, bat, sword, axe: words only on enemies within reach), pistols, SMGs, shotguns, assault rifles, LMGs (two words = one burst), rifles (marksman, sniper), launchers (rocket: straight; thumper: lobbed), specials (flamethrower, EMP gun, laser, saw launcher).
- **Throwables:** grenade, time bomb, gas, flashbang, concussion, EMP grenade, proximity mine. Thrown with Space, no words.
- **Status effects** (shared by players and bots): shocked (EMP: no jetpack, no switching), dazed (concussion: weak jetpack, slow run), blinded (flashbang: white screen, words hidden), gassed (HP drains in the cloud), burning.
- **Ammo for everything except melee**, scaled by damage (stronger = fewer shots). No reload button: typing speed is still fire rate. An empty gun is dropped; melee never runs out.
- **Supply drops:** throwables, health packs and fuel tanks fall on their own (outside crates), each type on its own timer. Guns and launchers come in crates.
- **Utility:** riot shield, health pack, fuel tank, armor vest.
- **Our own weapon names**, not real model names or Mini Militia's. Every weapon gets an icon for crates and the panel (placeholders until the art pass).

**Later ideas:** dual pistols; throwing a grenade drops one of your dual pistols.

---

## 6. Movement
- **Gravity is always on.** Nobody floats in place.
- **Slow fall while typing mid-air:** you drift down slowly, not fast. Upward momentum carries briefly, then you drift. Typing long words in the air is a risk, especially over the void.
- **Jetpack** for players and most enemies, with a **fuel bar** that refills on the ground only (also while typing on the ground).
- **Jetpack feel:** thrust builds speed (acceleration), capped rise speed, release Up and you arc back down. Down in the air falls faster.
- **Escape move:** pressing Up while typing mid-air exits typing and fires the jetpack instantly.
- **Jet booster** pickup gives extra fuel or speed.
- **Run out of fuel over the void, and you fall.**
- **Knocked back by a blast:** no control for a short stagger (also while typing), then normal rules again.
- **Tuning** lives in `src/data/player.js` (run speed, air speed, thrust, rise cap, fuel drain and refill, typing fall speed, knockback stagger, respawn delay).

---

## 7. Characters and enemies
**Characters (cosmetic only, same size and stats):** soldier, zombie, bot, wizard, archer, ninja, and more over time.

**Enemy behaviors (one Bot class with a behavior setting):**
| Type | Behavior | Jetpack |
|---|---|---|
| Shooter | Keeps distance and fires | Yes |
| Rusher | Runs in for melee | Some (zombies are ground-only) |
| Bomber | Runs in and explodes (TNT) | Yes |

**Enemy tiers:** grunt (1 word), soldier (2 to 3 words), heavy or boss (many words).

---

## 8. Maps
**Shared rules:**
- Every map floats over a **void**. Fall in and you die.
- **The void** is drawn as a dark gradient with rising mist (map config: void top, death line, colors). Falling past the death line kills you, clears your half-typed text, and you drop back in from the sky after a short delay.
- Maps are either **open sky** (limitless upward) or **enclosed** (dome or roof).
- Each map has **one hazard and one advantage**.
- **Typeable hazards:** some hazards show a word, and typing it triggers the trap on enemies.
- Each map is a **config** (tileset, background, sky type, hazard, advantage, spawn points), so new maps are cheap to add.
- **Maps are built in Tiled:** 32×32 tiles, tile layer `ground` (every painted tile is solid), object layer `spawns` with a point named `player`. Tileset embedded in the map, tile layer format CSV, saved as `.json`. The config in `maps.js` points at the Tiled file and holds everything else (void, background, hazards).

**Map list (draft, tune while prototyping):**
| Map | Sky | Hazard | Advantage |
|---|---|---|---|
| Forest | Open | Water drains HP over time | Hide in water or bushes (no word shows on you) |
| Hell | Open | Lava below, fire geysers | Heat vents refill jetpack fuel |
| Glacier | Open | Slippery ice | Type a word on an icicle to drop it on enemies |
| Catacombs | Enclosed | Darkness, limited vision | Tight tunnels for ambushes, torches reveal enemies |
| City | Open | Live power lines | Tall buildings for cover and height |
| Desert | Open | Quicksand pits | Sandstorms hide your word from enemies |
| Factory | Enclosed | Crushers and conveyors | Type a word on a crusher to trigger it |
| Sky Islands | Open | Strong winds push you | Ride the wind for long flights |
| Space Station | Enclosed | Airlocks pull you into the void | Low gravity, big jumps on less fuel |
| Graveyard | Open | Hands grab you from the ground | Tombstones block bullets |

---

## 9. Kill credit and scoring
**Fall deaths:**
- Fall into the void after enemies took **more than 50% of your HP in the last ~10 seconds**: the kill goes to whoever dealt you the most damage.
- Otherwise: **suicide**.

**Match score:** `kills × 100 + assists × 50 − deaths × 25` (tiebreak: K/D)

**End-of-match awards:**
- **Most Kills**
- **MVP ⭐** (highest score)

---

## 10. Game modes
| Mode | Online? | Notes |
|---|---|---|
| Team vs Bots | No | Your team plus bots against bots |
| Zombies | No | Waves of rushers |
| Endless vs Bots | No | Survive until you die |
| Free for All | Yes | Timer, respawns, scoring above |
| Team Deathmatch | Yes | Timer, respawns, scoring above |

Offline modes cost nothing to run. Online modes come after launch (see roadmap).

---

## 11. Players and progress
- **Guest play first:** name, character pick and progress saved in the browser (localStorage), free.
- **Sign-in later:** for online play and cross-device saves (Supabase or Firebase free tier).
- **Customization:** name change, character select. **Lobby** arrives with online play.
- **Currency:** none at launch. Later: **coins earned by playing** unlock skins and maps. If money is ever involved: cosmetics only, never weapons.

---

## 12. Audience
**Everyone: kids, teens and adults.**
- **Word difficulty setting:** Easy (short, common words), Normal, Hard (long, tricky words). Bots and matchmaking can scale with it.
- **Family-friendly by default:** cartoon-style blood and gibs. Gore toggle: Off / Cartoon (default) / Full.
- **Clean word lists:** no swear words or offensive terms.
- **Online (later):** name filter, and preset quick-chat instead of free text chat.

---

## 13. Tech stack ($0)
| Part | Tool |
|---|---|
| Engine | Phaser 3 (pinned with `npm install phaser@3`; Phaser 4 exists but we stay on 3) |
| Build tool | Vite |
| Runtime | Node.js (v24 locally, v22 in CI) |
| Editor | VS Code |
| Shell | Windows PowerShell (project commands are written for PowerShell) |
| Code hosting | GitHub (`victorolatunji/keys-militia`, public) |
| Game hosting | GitHub Pages via GitHub Actions (dev builds); itch.io at launch |
| Map editor | Tiled (exports to Phaser as JSON) |
| Physics | Phaser Arcade Physics (built in) |
| Art | Kenney.nl (CC0), Inkscape (free, vector characters), recolors, Piskel / Aseprite |
| Sound | jsfxr, Kenney audio packs |
| Saves | localStorage, later Supabase / Firebase free tier |
| Online (later) | WebRTC peer-to-peer (e.g. PeerJS) |

Log every asset and its license in `CREDITS.md`, including in-house placeholders.

**Art approach:** build every phase with placeholder shapes (rectangles and circles) first. Swap in real sprites in the art pass (Phase 9.5) once the mechanics feel right.

**Commands:**
| Command | What it does |
|---|---|
| `npm run dev` | Local dev server at http://localhost:5173 (auto-reloads) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `git push` (to `main`) | Builds and deploys the live site automatically |

---

## 14. Art direction
**Goal:** influenced by Mini Militia, but its own game with its own look. We borrow genre ideas, never their style or assets.

**Borrowed from the genre:** side view, small chunky outlined cartoon characters, floating islands with grass tops and rocky cross-sections, parallax backgrounds, jetpack flames and smoke, bright tracers, explosion bursts.

**Make it ours:**
- **Words first:** words are always the highest-contrast thing on screen (bright text on a dark plate). Backgrounds muted, characters mid-contrast.
- **Typing effects:** letters light up as typed; a finished word shatters into letters that fly at the target; a typo shakes the word red and puffs smoke from the gun.
- **Cast:** soldier, zombie, bot, wizard, archer, ninja. Rounder and more colorful than military sprites, one bold team accent color.
- **Visible void:** dark misty drop with a faint glow under every map.
- **Per-map palettes:** each map has its own color identity.
- **Camera:** slightly wider than Mini Militia so multiple words stay readable.

**Reference research:** findings from studying the Mini Militia APK live in project knowledge (`claude/mini-militia-reference-findings.md`). They are for understanding mechanics only: we never copy their code, art, sounds, maps or values. Our tuning numbers are our own.

**Sizes:** character 32×48 px, tiles 32×32 px, at a 1280×720 game resolution (Phaser FIT scaling).

---

## 15. Project structure
✅ = exists now. Everything else is planned.
```
keys-militia/
├── index.html                   ✅
├── package.json                 ✅
├── vite.config.js               ✅ base './' for GitHub Pages
├── .gitignore                   ✅
├── .github/workflows/
│   └── deploy.yml               ✅ auto-deploy to GitHub Pages on push to main
├── src/
│   ├── main.js                  ✅ Phaser config
│   ├── scenes/                  # Boot ✅ (loads maps), Game ✅, Menu, Lobby, GameOver, Settings
│   ├── entities/                # Player ✅, Dummy ✅, Grenade ✅, Crate ✅, Pickup ✅, Bot
│   ├── systems/
│   │   ├── VoidSystem.js        ✅ void visuals, fall detection
│   │   ├── TypingSystem.js      ✅ typing state, words, lock-on, typos, word refresh
│   │   ├── wordPicker.js        ✅ unique-first-letter word picks
│   │   ├── LineOfSight.js       ✅ tile raycast: which enemies get words, which blasts land
│   │   ├── WeaponSystem.js      ✅ gun slots, damage + range falloff, throwables, blast + knockback
│   │   ├── AirdropSystem.js     ✅ parachute crates, death drops
│   │   ├── PickupSystem.js      ✅ nearest crate/drop, 1/2/3 swaps
│   │   ├── CollisionSystem.js   ✅ object-vs-object collision rules
│   │   ├── HazardSystem.js      # map hazards and advantages
│   │   └── ScoreSystem.js       # kills, assists, fall credit, MVP
│   ├── ui/
│   │   ├── Hud.js               ✅ HP and fuel bars, weapon panel, state tag
│   │   ├── PickupPanel.js       ✅ pickup panel at the bottom of the screen
│   │   └── WordLabel.js         ✅ word plates above targets
│   └── data/
│       ├── player.js            ✅ movement, HP, typing and knockback tuning (shared by all characters)
│       ├── maps.js              ✅ map configs (test map)
│       ├── words.js             ✅ word lists by length, refresh timer
│       ├── weapons.js           ✅ guns, throwables, aim, loadout
│       ├── enemies.js           ✅ target dummy (bots in Phase 5)
│       ├── airdrops.js          ✅ crate timing, parachute, tipping, pickup radius, item pool, death drops
│       └── characters.js
├── public/assets/
│   ├── maps/                    # Tiled maps (.json) — test.json ✅
│   └── tilesets/                # tile images — placeholder-tiles.png ✅
├── README.md                    ✅ this plan book
└── CREDITS.md                   ✅ asset licenses
```

---

## 16. Roadmap
| Phase | Goal | Done when | Status |
|---|---|---|---|
| 0 | Setup | Phaser + Vite running, blank scene online | ✅ |
| 1 | Movement | Arrows, diagonals, gravity, jetpack, fuel, slow fall while typing, void death on a test map | ✅ |
| 2 | Typing combat | Line-of-sight words, lock-on, HP, word chains, typos | ✅ |
| 3 | Weapons | 2 gun slots, throwables with aim and falloff, Shift switch | ✅ |
| 4 | Airdrops | Crates, proximity panel, death drops with timeout | ✅ |
| 4.5 | Arsenal I | Weapon categories and ammo in data, melee, pistols, SMG, shotgun, rifle variants, LMG, marksman, rocket launcher, thumper, placeholder icons, frag supply drops | ⏭️ next |
| 5 | Enemies | Shooter, rusher, bomber bots | |
| 5.5 | Arsenal II | Status effects, flashbang, concussion, EMP gun and grenade, gas, time bomb, proximity mine, flamethrower, laser, riot shield, health pack, fuel tank | |
| 6 | Effects | Blood, gibs, pain sounds, gore toggle | |
| 7 | Maps | All launch maps with hazards and advantages, open and enclosed | |
| 8 | Offline modes | Team vs Bots, Zombies, Endless, scoring, awards | |
| 9 | Menus and guest | Menu, settings, name and character select, local saves | |
| 9.5 | Art pass | Replace placeholders with final sprites, tiles, backgrounds and effects | |
| 10 | Launch | Published on itch.io, linked from the VAO site | |
| 11 | Online | Sign-in, lobby, FFA and TDM | |
| 12+ | Upgrades | Coins, more weapons, characters and maps | |

---

## 17. Open decisions
- [ ] Final hazard and advantage behavior per map (test in prototype)
- [ ] Match length and kill targets
- [ ] Exact weapon stats (damage, word length, range falloff)
- [ ] Blast knockback strength and stagger time (starting values 520 px/s, 220 lift, 350ms)
- [ ] Airdrop timer and death-drop timeout (starting values 20s drops, 40s crate life, 60s death drops)
- [ ] Ammo per weapon (starting rule: shots = 600 / damage) and final weapon names and stats per category
- [ ] Mouse movement details
- [ ] Slow-fall speed while typing (starting value 60 px/s in `player.js`)
- [ ] Final movement tuning (starting values in `src/data/player.js`)
- [ ] Respawn delay and spawn points per map (starting value 1.5s, one spawn point)

---

## 18. Changelog
- **0.10:** Phase 4 done. Parachute airdrop crates that sway, land, stack and tip off edges. Solid collisions between characters, crates and grenades. Pickup panel (1 / 2 swap a gun slot, 3 takes throwables). Death drops with a 60s timeout; respawn with the default loadout. Arsenal plan added (phases 4.5 and 5.5).
- **0.9:** Plan book restored (sections 4 to 18 were accidentally cut in 0.8). Guns stay hitscan and always hit; per-gun range falloff (pistol and assault rifle weaken with distance, sniper doesn't). Grenade blasts knock survivors back with a short stagger. Status, structure and roadmap updated.
- **0.8:** Phase 2 done: target dummies with HP bars, unique-first-letter words, lock-on, word chains, typos jam the gun, line of sight and word refresh. Phase 3 started: two gun slots with Shift switching, damage and word length per gun, player HP, grenades (hold Space to charge, Up/Down to aim) with falloff, wall blocking and self-damage.
- **0.7:** Phase 1 done. Running, gravity, jetpack with fuel bar, diagonals, Down to descend. Typing state: lowercase letters stop you, slow fall mid-air, fresh arrow press resumes, buffer saved. Visible void with fall death and drop-in respawn (`VoidSystem`). Test map rebuilt in Tiled with an in-house placeholder tileset; Boot scene loads maps.
- **0.6:** Phase 0 done: Phaser 3 + Vite, Boot and Game scenes, live on GitHub Pages with auto-deploy. Art direction section. Art pass phase (9.5). Phase 1 steps 1–2: test map config, player walking, gravity, camera follow, jetpack with fuel bar, diagonals, Down to descend. Added `src/ui/` and `src/data/player.js`. Positioning: influenced by Mini Militia, not in its style.
- **0.5:** Word refresh timer, word lock, unique first letters, per-player words in multiplayer; placeholder-art-first approach.
- **0.4:** Gravity always on; slow fall while typing in mid-air replaces hovering.
- **0.3:** Audience set to everyone: word difficulty setting, family-friendly defaults, gore toggle levels.
- **0.2:** Controls (move or type), combat, HP and word chains, line of sight, loadout, airdrops, enemy types, maps with hazards and advantages, open/enclosed maps, fall kill credit, scoring, modes, guest play, currency plan.
- **0.1:** First draft.