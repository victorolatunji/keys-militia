# Keys Militia
*A VAO game. Living plan book: update it whenever the plan changes.*

**Version:** 0.6
**Owner:** Victor Olatunji / VAO
**Budget:** $0, free tools and free assets only
**Status:** Phase 0 complete. Phase 1 (Movement) in progress, steps 1 and 2 done.
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
| Switch weapon / throwable | Shift |
| Throw | Hold Space, aim with Up/Down, release (hold longer = farther) |
| Pick from airdrop panel | 1 / 2 / 3 |
| Alt movement (setting) | Hold right-click to fly toward the cursor |

**Move or type rule:**
- When you start typing, your character **stops moving and auto-faces** the target. On the ground you hold position; **in the air you drift down slowly** (no hovering in place).
- Press any arrow to move again. Your half-typed word stays saved.
- Words use **lowercase letters only**, so Shift, Space, digits and arrows never clash with typing.

---

## 4. Combat
- **Line of sight:** words only appear on enemies you can actually hit. Behind a wall, no word.
- **One word = one shot.** A new word spawns after each hit until the enemy dies.
- **Enemy HP** decides how many shots it takes (health bar shown above the enemy).
- **Weapon** decides word length and damage (pistol = short words, low damage; sniper = long words, high damage).
- **No reloads.** Your typing speed is your fire rate.
- **Typo** jams the gun briefly (about 0.5s).
- **Word refresh:** words change every ~8 to 12 seconds (shorter on Hard, longer on Easy), after every hit, and when an enemy leaves and re-enters line of sight.
- **Word lock:** once you type the first letter, that word never changes until you finish it, make a typo, or the enemy dies or leaves your sight.
- **Unique first letters:** no two words on screen start with the same letter, so lock-on is never ambiguous.
- **Multiplayer:** each player sees their own words on enemies. Nobody can read what you're about to type, and players never race for the same word.
- **Obstacles** (walls, rocks, mountains) block bullets. Ricochet only on specific weapons.
- **Throwables** go over cover and hit enemies with no word showing. **Damage falloff:** direct hit kills, less damage farther from the blast.
- **Hit effects:** blood particles and pain sounds. **Death:** body splits into pieces (gibs).
- **Gore toggle** in settings: Off / Cartoon (default) / Full.

---

## 5. Loadout and pickups
**Slots:** 2 guns + 1 throwable.

**Default spawn:** melee + a basic SMG or assault rifle (usable, not the best). Players spawn by dropping in from the sky.

**Airdrops:** crates fall from the sky on a timer.
- **Guns:** pistol, SMG, assault rifle, shotgun, marksman, LMG, sniper, launcher, flamethrower, EMP gun, and more over time.
- **Throwables:** grenade, time bomb, flammables, EMP grenade, and more over time.
- **Utility:** shield (absorbs damage then breaks), HP booster, jet booster.

**Pickup panel:**
- Get **near** a crate (no need to touch it) and a small panel pops up.
- The game **does not pause**, so you can get killed while choosing.
- Press **1 / 2 / 3** to swap that slot. Move away and the panel closes.

**Death drops:** you drop your items when killed. Anyone can grab them. They vanish after about **60 seconds**.

**Later ideas:** dual pistols; throwing a grenade drops one of your dual pistols.

---

## 6. Movement
- **Gravity is always on.** Nobody floats in place.
- **Slow fall while typing mid-air:** you drift down slowly, not fast. Typing long words in the air is a risk, especially over the void.
- **Jetpack** for players and most enemies, with a **fuel bar** that refills on the ground only.
- **Jetpack feel:** thrust builds speed (acceleration), capped rise speed, release Up and you arc back down. Down in the air falls faster.
- **Jet booster** pickup gives extra fuel or speed.
- **Run out of fuel over the void, and you fall.**
- **Tuning** lives in `src/data/player.js` (run speed, air speed, thrust, rise cap, fuel drain and refill).

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
- Maps are either **open sky** (limitless upward) or **enclosed** (dome or roof).
- Each map has **one hazard and one advantage**.
- **Typeable hazards:** some hazards show a word, and typing it triggers the trap on enemies.
- Each map is a **config** (tileset, background, sky type, hazard, advantage, spawn points), so new maps are cheap to add.

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
| Map editor | Tiled (exports to Phaser) |
| Physics | Phaser Arcade Physics (built in) |
| Art | Kenney.nl (CC0), Inkscape (free, vector characters), recolors, Piskel / Aseprite |
| Sound | jsfxr, Kenney audio packs |
| Saves | localStorage, later Supabase / Firebase free tier |
| Online (later) | WebRTC peer-to-peer (e.g. PeerJS) |

Log every asset and its license in `CREDITS.md`.

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

**Keep (genre):** side view, small chunky outlined cartoon characters, floating islands with grass tops and rocky cross-sections, parallax backgrounds, jetpack flames and smoke, bright tracers, explosion bursts.

**Make it ours:**
- **Words first:** words are always the highest-contrast thing on screen (bright text on a dark plate). Backgrounds muted, characters mid-contrast.
- **Typing effects:** letters light up as typed; a finished word shatters into letters that fly at the target; a typo shakes the word red and puffs smoke from the gun.
- **Cast:** soldier, zombie, bot, wizard, archer, ninja. Rounder and more colorful than military sprites, one bold team accent color.
- **Visible void:** dark misty drop with a faint glow under every map.
- **Per-map palettes:** each map has its own color identity.
- **Camera:** slightly wider than Mini Militia so multiple words stay readable.

**Sizes:** character 32×48 px at a 1280×720 game resolution (Phaser FIT scaling).

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
│   ├── scenes/                  # Boot ✅, Game ✅, Menu, Lobby, GameOver, Settings
│   ├── entities/                # Player ✅, Bot, Projectile, Crate, Pickup
│   ├── systems/
│   │   ├── TypingSystem.js      # words, lock-on, typos
│   │   ├── LineOfSight.js       # which enemies get words
│   │   ├── WeaponSystem.js      # slots, damage, throwables
│   │   ├── AirdropSystem.js     # crates, pickup panel, death drops
│   │   ├── HazardSystem.js      # map hazards and advantages
│   │   └── ScoreSystem.js       # kills, assists, fall credit, MVP
│   ├── ui/
│   │   └── Hud.js               ✅ fuel bar now; HP, weapon slots, pickup panel later
│   └── data/
│       ├── player.js            ✅ movement tuning (shared by all characters)
│       ├── maps.js              ✅ test map config
│       ├── words.js
│       ├── weapons.js
│       ├── enemies.js
│       └── characters.js
├── public/assets/               # sprites, tilesets, sounds, maps
├── README.md                    ✅ this plan book
└── CREDITS.md                   ✅ asset licenses
```

---

## 16. Roadmap
| Phase | Goal | Done when | Status |
|---|---|---|---|
| 0 | Setup | Phaser + Vite running, blank scene online | ✅ |
| 1 | Movement | Arrows, diagonals, gravity, jetpack, fuel, slow fall while typing, void death on a test map | 🔄 |
| 2 | Typing combat | Line-of-sight words, lock-on, HP, word chains, typos | |
| 3 | Weapons | 2 gun slots, throwables with aim and falloff, Shift switch | |
| 4 | Airdrops | Crates, proximity panel, death drops with timeout | |
| 5 | Enemies | Shooter, rusher, bomber bots | |
| 6 | Effects | Blood, gibs, pain sounds, gore toggle | |
| 7 | Maps | All launch maps with hazards and advantages, open and enclosed | |
| 8 | Offline modes | Team vs Bots, Zombies, Endless, scoring, awards | |
| 9 | Menus and guest | Menu, settings, name and character select, local saves | |
| 9.5 | Art pass | Replace placeholders with final sprites, tiles, backgrounds and effects | |
| 10 | Launch | Published on itch.io, linked from the VAO site | |
| 11 | Online | Sign-in, lobby, FFA and TDM | |
| 12+ | Upgrades | Coins, more weapons, characters and maps | |

**Phase 1 progress:**
- [x] Step 1: test map, walking, gravity, camera follow
- [x] Step 2: jetpack, fuel bar, diagonals, Down to descend
- [ ] Step 3: void visual, void death, drop-in respawn
- [ ] Step 4: typing state (stop, slow fall in the air, arrows resume)
- [ ] Step 5: test map rebuilt in Tiled

---

## 17. Open decisions
- [ ] Final hazard and advantage behavior per map (test in prototype)
- [ ] Match length and kill targets
- [ ] Exact weapon stats (damage, word length)
- [ ] Airdrop timer and death-drop timeout
- [ ] Mouse movement details
- [ ] Slow-fall speed while typing
- [ ] Final movement tuning (starting values in `src/data/player.js`)

---

## 18. Changelog
- **0.6:** Phase 0 done: Phaser 3 + Vite, Boot and Game scenes, live on GitHub Pages with auto-deploy. Art direction section. Art pass phase (9.5). Phase 1 steps 1–2: test map config, player walking, gravity, camera follow, jetpack with fuel bar, diagonals, Down to descend. Added `src/ui/` and `src/data/player.js`. Positioning: influenced by Mini Militia, not in its style.
- **0.5:** Word refresh timer, word lock, unique first letters, per-player words in multiplayer; placeholder-art-first approach.
- **0.4:** Gravity always on; slow fall while typing in mid-air replaces hovering.
- **0.3:** Audience set to everyone: word difficulty setting, family-friendly defaults, gore toggle levels.
- **0.2:** Controls (move or type), combat, HP and word chains, line of sight, loadout, airdrops, enemy types, maps with hazards and advantages, open/enclosed maps, fall kill credit, scoring, modes, guest play, currency plan.
- **0.1:** First draft.