# Keys Militia: Bug Log

Every bug found in playtests or testing, with what caused it and how it was fixed. New bugs go at the top. The README changelog says *what* changed; this file says *what went wrong and why*.

**How to log one:** copy the template, fill it in, put it at the top of the list.

```
### B-000: Short title
- **Found:** date · version · how (playtest / test / report)
- **Where:** map / mode / system
- **What happened:** what you saw
- **Cause:** why it happened
- **Fix:** what changed (files)
- **Status:** fixed in x.y / open
```

---

## Log

### B-029: The Drone and the Zombie K9 could be picked as your character
- **Found:** 2026-11-12 · 0.33 · playtest
- **Where:** lobby
- **What happened:** you could play as the Drone or the K9, which aren't meant to be playable.
- **Cause:** the lobby only checked who can be a partner, not who can be you.
- **Fix:** `playable: false` on both in `cast.js` and `canPick()` used by the lobby (greyed heads, skipped when browsing, old saves fall back to Victor); the match falls back to Victor too.
- **Status:** fixed in 0.33

### B-028: Coming back from another tab skipped things
- **Found:** 2026-11-12 · 0.32 · playtest
- **Where:** every mode, the countdown and the match clock
- **What happened:** after switching browser tabs and coming back, the countdown could end at once (straight into the slow drop-in) and timers in the match jumped ahead.
- **Cause:** the browser stops the game in a hidden tab, and when you're back the game clock jumps ahead by the time you were away; the countdown and match timers read that clock.
- **Fix:** leaving the tab mid-match opens the pause box (Training just waits); the countdown counts the real time between frames (`IntroScene.countdown`); the match and drop timers are pushed back by the paused time as with Esc (`GameScene`). The drop-in only runs at FIGHT.
- **Status:** fixed in 0.33

### B-027: The ending's slow motion looked glitchy
- **Found:** 2026-11-12 · 0.32 · playtest (Duo with a Mutant)
- **Where:** the ending beat, every mode
- **What happened:** in the slow motion before the results, bodies moved slowly but legs, flames, blood and effects ran at full speed.
- **Cause:** only the physics was slowed; every animation still got the real frame time.
- **Fix:** during the ending, the frame time handed to everything is slowed too, and tweens run slowed (`GameScene.update`, `endSequence`); reset when a new match starts.
- **Status:** fixed in 0.33

### B-026: Walker partners jumped and flew at the same time
- **Found:** 2026-11-12 · 0.32 · playtest (Duo with a Mutant)
- **Where:** Duo, Mutant / Zombie / Skeleton partners
- **What happened:** the partner looked like it was jumping and flying at once, lagged behind and kept hopping.
- **Cause:** partners got a jetpack but kept the walker's slow speeds (Mutant 35%), so it fell behind and teleported along your path; it only "thrusted" when rising, so level flight used the falling pose. Over a drop it hovered forever when you stood on ground.
- **Fix:** partners use your speeds whoever they are; flying uses the flying pose unless it's dropping fast; over a drop it comes to you (`PartnerSystem`).
- **Status:** fixed in 0.33

### B-025: START / Enter on the intro (and READY) sometimes didn't answer
- **Found:** 2026-11-12 · 0.32 · playtest (npm run dev)
- **Where:** mode intro, lobby
- **What happened:** from the second match on, Enter / START on the mode intro did nothing.
- **Cause:** Phaser reuses the same scene object each time; the intro's "already started" flag from the last match was never reset (the lobby's open Info / Arsenal flags likewise).
- **Fix:** reset at the top of `create()` in `IntroScene` and `LobbyScene`.
- **Status:** fixed in 0.33

### B-024: Frozen characters behind the countdown, no boot flames on machines
- **Found:** 2026-11-12 · 0.31.2 · playtest
- **Where:** match start; Android, Robot and Scrap Bot flying
- **What happened:** you and your partner hung frozen in the air behind the countdown. Machines flying on their boot thrusters showed almost no flame.
- **Cause:** the match was paused one frame after you spawned in the air, so that frame stayed on screen. The boot flames sat inside the shin, behind the boot, small, and turned sideways with the leg. Also, starting the drop-in at the resume used the paused clock, which jumps forward on the next frame, so the slow descent ended at once (caught in testing).
- **Fix:** you and your partner wait out of sight (`waiting`) and drop in slowly at FIGHT (`Player.dropIn`, `GameScene.startMatch`, run on the first frame after the resume); the partner lands beside you on the same ground and starts following from there. Boot flames are drawn in the world at each sole, pointing down, bigger and glowing. (`CharacterRig`, `rigs.js`, `PartnerSystem`, `HazardSystem` note)
- **Status:** fixed in 0.31.3

### B-023: The Alien was the Rookie in Training
- **Found:** 2026-11-12 · 0.31.1 · playtest
- **Where:** Training
- **What happened:** Training started with the Alien as you, not Victor.
- **Cause:** Training took whoever you last picked in the lobby. Training is Victor's story (the Rookie arriving at the Militia Camp), so it should always be him.
- **Fix:** Training always uses the hero (`TRAINING.character`), from the menu and on TRAIN AGAIN. (`MenuScene.go`, `GameScene.init`, `training.js`)
- **Status:** fixed in 0.31.2

### B-022: A match felt like jumping into a fight already going
- **Found:** 2026-11-12 · 0.30.2 · playtest
- **Where:** every mode with enemies
- **What happened:** after the countdown, enemies were already out on the map and the fight was on from the first second.
- **Cause:** the starting enemies were created with the map, before the intro and the countdown, so they were already placed (some near you) when the match began. Military also came in from fixed spawn points on the ground, not from the sky.
- **Fix:** the field starts empty; after FIGHT the starting enemies drop in one by one. Military and other jetpack enemies drop in from the sky over the top level, away from you. Waves wait for FIGHT too. (`GameScene.startMatch` / `botSpawnPoint`, `MatchSystem.update`)
- **Status:** fixed in 0.31

### B-021: Flashbang glitched after the bang
- **Found:** 2026-11-12 · 0.30 · playtest
- **Where:** Flashbang on you
- **What happened:** right after a flashbang went off, the screen hitched and showed a frozen copy of the picture.
- **Cause:** the flash grabbed the whole screen as an "afterimage". Reading the frame back from the graphics card stalls the game for a moment, and the frozen picture over the live view looked like a rendering bug. The glare's fade also relied on a tween delay, the same pattern as B-012.
- **Fix:** no afterimage; the white glare (now started by a timed call) and the blur and brightness that clear last stay. (`WeaponSystem.flashBlind`)
- **Status:** fixed in 0.30.2

### B-020: Fell through the floor
- **Found:** 2026-11-12 · 0.30 · playtest (screenshot: the player and partner Arije standing on the bottom row of a map, inside the ground)
- **Where:** a ground-fighter map (Graveyard-style floors), Duo
- **What happened:** you and your partner ended up below the floor, inside solid ground.
- **Cause:** not pinned down yet. Falls are capped well under a tile per physics step, so it's likely a push (knockback, a body pushing another, a moving slab) shoving someone into the tiles.
- **Fix:** a safety net: a few times a second, anyone whose middle and feet are both inside solid tiles is lifted to the first open space above them (or put back at the nearest spawn). Checked by burying you and your partner at the bottom of Graveyard: both were back on the floor within a quarter second. (`src/systems/Unstuck.js`, `GameScene.update`)
- **Status:** safety net in 0.30.2; root cause open

### B-019: Your partner showed as its type on the end screen
- **Found:** 2026-11-12 · 0.29.2 (in testing)
- **Where:** end screen scoreboard, Duo
- **What happened:** the partner's row read "Soldier" instead of "Kolawole" when the partner hadn't hurt or been hurt by anyone yet.
- **Cause:** the scoreboard row took its name the first time the partner was counted, which came before its cast name was set.
- **Fix:** the row picks up the partner's cast name (and its head icon) when it's used and again when the scoreboard is built. (`StatsSystem.rowOf` / `summary`)
- **Status:** fixed in 0.30

### B-018: The match clock ran on during the intro
- **Found:** 2026-11-12 · 0.29 (in testing)
- **Where:** the new mode intro and Esc pause
- **What happened:** after the 11-second countdown, You vs Military showed 9:50 instead of 10:00, and the first crate dropped the moment the fight began.
- **Cause:** a paused scene's clock keeps reading the game's time, so every deadline set before the pause (match end, stages, waves, airdrops) passed while you were reading the intro.
- **Fix:** when the scene resumes, the match's and the airdrops' deadlines move back by the time it was paused (`MatchSystem.shiftTime`, `AirdropSystem.shiftTime`, GameScene pause/resume).
- **Status:** fixed in 0.29

### B-017: Ground-bound enemies vibrated on open maps
- **Found:** 2026-11-11 · 0.26.1 · playtest
- **Where:** Space, Sky Islands, Forest, Hell, Glacier (any open-air map)
- **What happened:** zombies, K9s, Scrap Bots and mutants shook in place and moved wrongly.
- **Cause:** they have no jetpack. On open maps with gaps, low gravity and air to fight in, they can't reach a player who flies, so they keep trying to hop and turn back.
- **Fix:** ground-bound types (movement `walker` or `leaper`) only spawn on maps marked `groundFighters` (Graveyard, Wastelands, Catacombs), in slots and in waves. There they come more often than the shooters (`walkerBoost`, 5 enemies on those maps), but a jetpack shooter is always out on every map. Each map also weights its families (Space sci-fi, Forest military, Graveyard undead). (`EnemySpawner` `fitsMap` / `pickForMap` / `rollFamily`, `MatchSystem.spawnWaveEnemy`, `maps.js`)
- **Status:** fixed in 0.26.2

### B-016: Spawns dropped you onto a lower floor, or into lava
- **Found:** 2026-11-11 · 0.26 · playtest
- **Where:** random spawns, every map (seen in Hell and Forest)
- **What happened:** in Hell you spawned on ground next to a lava pool and fell straight in. In Forest you appeared on the top level and dropped down to the second level.
- **Cause:** the new left/middle/right spawns reused the nearest of the map's own spawn points (yours, the dummies' and the bots'). Some of those sit on lower floors or beside hazards.
- **Fix:** spawns are found from the sky down: the first solid ground in each third of the map, roughly flat under you, not thin ice or crumbling rock, not down a gap to a lower floor, not a rooftop at the very top of the map, and clear of lava, water, toxic pools, falls, geysers and vents. You drop in from 260 px above. Catacombs (no sky) keeps its own spawn points. Checked on all 11 maps. (`GameScene.threeSpawns` / `airSpawn`, `spawnDrop` in `player.js`)
- **Status:** fixed in 0.26.1

### B-015: Airdrops stacked, buried items, or fell into the void
- **Found:** 2026-11-11 · 0.25 · playtest
- **Where:** airdrops, every map
- **What happened:** two crates landed in the same place. A crate landed on a special item, so you couldn't reach the item. Some crates fell into the void.
- **Cause:** a drop spot was chosen by checking a single column under the crate's middle, with no check for other crates or items. Crates landing half over an edge tipped off.
- **Fix:** a crate only drops where the ground is the same height under its middle and both sides. It stays at least `clearPx` away from other crates and items, and an item that still ends up under a landed crate is pushed out to the side. (`AirdropSystem.findDropX` / `flatLanding` / `clearOfOthers` / `unbury`, `airdrops.js`)
- **Status:** fixed in 0.26

### B-014: AI partner glitched while moving
- **Found:** 2026-11-11 · 0.25 · playtest
- **Where:** Duo partner
- **What happened:** the partner stuttered (stop, go, stop) and its legs flickered between running and falling poses.
- **Cause:** it stopped and started every frame right at its follow distance, and its speed snapped instantly. Its legs also switched to the falling pose on every small bump, which affected every character.
- **Fix:** it now sets off again only once you're `startPx` farther away, and its speed eases (`steer`), except when it's far behind. Rigs keep the ground pose for `groundGraceMs` after leaving the ground. (`PartnerSystem.move`, `partner.js`, `CharacterRig.update`, `rigs.js`)
- **Status:** fixed in 0.26

### B-013: Training coaches got stuck
- **Found:** 2026-11-11 · 0.25 · playtest
- **Where:** Training
- **What happened:** coaches got caught on ledges and sandbags and jumped (teleported) to their spot.
- **Cause:** they walked to fixed station spots on the ground only, and teleported if blocked for 1 s.
- **Fix:** they stay with you, one either side. They run beside you, fly with jetpacks when you're up or a ledge is in the way, and never go past a closed gate. (`TrainingSystem.moveCoach`, `training.js`)
- **Status:** fixed in 0.26

### B-012: Flamethrower puffs stuck at the nozzle
- **Found:** 2026-11-11 · 0.26 (in testing)
- **Where:** Flamethrower
- **What happened:** only the first fire puff flew out. The rest sat at the gun.
- **Cause:** relying on the tweens' own `delay` left the later puffs stuck in place.
- **Fix:** each puff starts its tween from a timed call instead. (`WeaponSystem.sprayFlame`)
- **Status:** fixed in 0.26

### B-011: Zombies vibrated in one spot
- **Found:** 0.25 · playtest
- **Where:** melee enemies (zombies, skeletons, mutants, K9)
- **What happened:** zombies shook in place under you.
- **Cause:** they kept hopping toward a player they couldn't reach, and flipped between "in range" and "out of range" every frame.
- **Fix:** rushers charge, strike, fall back and take turns. Walkers only jump if the goal is within reach, and they pass through each other. (`BotBrain` rush, `BotCombat`, `CollisionSystem`, `RUSH` in `enemies.js`)
- **Status:** fixed in 0.26

### B-010: Mercenary's torso missing
- **Found:** art pass · playtest
- **Where:** Mercenary rig
- **What happened:** her head sat on her legs with no torso showing.
- **Cause:** her head art has a braid hanging below the neck, so the head was placed too low and covered the torso.
- **Fix:** a neck override for her head (`OVERRIDES` in `rigs.js`, `NECK` in `pack-sprites.py`).
- **Status:** fixed in art pass step 2

### B-009: Army green tint and darker back limbs not showing
- **Found:** art pass · test
- **Where:** character rigs
- **What happened:** army green Soldiers looked brown, and the back arm and leg weren't darker.
- **Cause:** tints were only applied when the hit flash changed, and at the start it hadn't changed yet.
- **Fix:** the flash state starts as "unset", so the first frame paints the tints. (`CharacterRig.updateTint`)
- **Status:** fixed in art pass step 2

### B-008: Death scattered a blue square, not the body
- **Found:** art pass · playtest
- **Where:** deaths (you and bots)
- **What happened:** on death the old placeholder square flew apart.
- **Cause:** the death effect still used the physics box, not the rig.
- **Fix:** the rig's real body parts scatter as images. (`CharacterRig.pieces`, `EffectsSystem.death`)
- **Status:** fixed in art pass step 2

### B-007: HP bars and tags over faces
- **Found:** art pass · playtest
- **Where:** HP bars, name tags, status icons, speech bubbles
- **What happened:** bars and tags covered characters' heads.
- **Cause:** they were placed from the physics box's top, but the drawn character is taller than its box.
- **Fix:** a `visualTop` (top of the drawn head) is used for everything placed above a character.
- **Status:** fixed in art pass step 2

### B-006: Coaches aimed their guns at you
- **Found:** 0.25 · playtest
- **Where:** Training
- **What happened:** the coaches pointed their guns at the player while talking.
- **Cause:** with no target, the rig aimed at whatever it faced.
- **Fix:** coaches hold their weapons lowered (`restAim`).
- **Status:** fixed in 0.25

### B-005: Expired crate counted as a finished lesson
- **Found:** 0.25 · test
- **Where:** Training, airdrop lesson
- **What happened:** if the lesson's crate timed out, the lesson passed without you taking a gun.
- **Cause:** the check only looked for "the crate is gone".
- **Fix:** an expired crate is dropped again.
- **Status:** fixed in 0.25

### B-004: Enemies fell through the ground when dropping in
- **Found:** 0.24 · playtest
- **Where:** bot spawns
- **What happened:** an enemy dropping from the sky passed through the ground.
- **Cause:** some drop-in points were inside solid rock, so the physics pushed the bot out downward.
- **Fix:** the drop point first rises out of solid tiles. (`GameScene.botSpawnPoint`)
- **Status:** fixed in 0.24

### B-003: Partner stuck, or died in the void
- **Found:** 0.24 · playtest
- **Where:** Duo partner
- **What happened:** the partner got stuck on walls, and followed you off ledges to its death.
- **Cause:** it walked straight toward you instead of where you'd been.
- **Fix:** it replays your path. It only follows over the void once your path is back over ground (`lastSafeId`), and hovers otherwise. (`PartnerSystem`)
- **Status:** fixed in 0.24

### B-002: F9 opened the browser console
- **Found:** 0.24 · playtest
- **Where:** partner select key
- **What happened:** pressing F9 to switch partner opened the browser's tools in some browsers.
- **Cause:** F-keys are taken by the browser.
- **Fix:** the partner key is now ` (left of 1). Rule added: no F-keys that open browser tools.
- **Status:** fixed in 0.24

### B-001: Build broke on a backtick in a label
- **Found:** 0.24 · build
- **Where:** GameScene
- **What happened:** the build failed.
- **Cause:** a ` character inside a template string ended the string early.
- **Fix:** the label spells the key out in words.
- **Status:** fixed in 0.24
