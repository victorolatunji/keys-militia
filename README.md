# Keys Militia
*A VAO game. Living plan book: update it whenever the plan changes.*

**Version:** 0.18
**Owner:** Victor Olatunji / VAO
**Budget:** $0, free tools and free assets only
**Status:** Phase 7 (Maps) in progress: Forest, Hell, Glacier, Desert, Catacombs and Graveyard done, four launch maps to go.
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
| Switch gun | Shift (gun 1 → gun 2 → melee → gun 1, empty slots skipped) |
| Throw | Hold the left mouse button and point at the spot, release to throw. Or hold Space, aim with Up/Down, release (hold longer = farther) |
| Switch throwable | Tab or mouse wheel (throwable 1 ↔ throwable 2) |
| Pick from a crate | 1–6 (one gun per key, take any 2) |
| Pick a loose item | Walk over Health Packs (when hurt), Jet Boosts, Armor Vests and more of a throwable you carry: picked up automatically. Others: 1 / 2 (gun into that slot, or refill a gun you hold), 3 (new throwable, Riot Shield) |
| Gore level | F2 (Off / Cartoon / Full, remembered in your browser) |
| Sound on/off | F4 (remembered in your browser) |
| Next map (testing) | F6 (Forest → Hell → Glacier → Desert → Catacombs → Graveyard → Test, remembered in your browser), or open the game with `?map=` and the map's name |
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
- **Bullets fly, but always hit:** finishing a word fires real bullets (streaks with a muzzle flash) that chase the target and do their damage on arrival. A correctly typed word is never wasted. If the target dies first, the rest of the burst stops. (Changed in 0.11: shots used to be instant lines.)
- **Bursts by gun family:** `hits` is the number of bullets per attack and the damage is split between them. SMGs fire fast, light bursts (4–7 bullets), assault rifles steady bursts (2–4), LMGs a long stream (8–14), shotguns burst into pellets that fan out in a cone (wider with distance), marksman rifles and snipers one very fast bullet with a thin trail. Bullet speed and length per family live in `bullets.js`.
- **One damage number per burst:** hits on the same target add up into one number that counts up (`-6`, `-12` … `-60`).
- **Range falloff:** gun damage drops with distance from you to the target. Full damage up to `startPx`, then a straight line down to `minMultiplier` at `endPx` (per gun, `falloff` in `weapons.js`). Weakened hits show a paler damage number. Marksman rifles and snipers have no falloff.
- After a shot you **stay in typing mode**, so you can chain words. Press an arrow to move.
- You **auto-face** your locked target with every correct letter.
- **Enemy HP** decides how many shots it takes (health bar shown above the enemy). HP is realistic: a soldier goes down to about 2 assault rifle words.
- **Enemies shoot back** with real bullets (red) that can miss: see section 7.
- **Health regen:** after 4s without taking damage, your HP refills at 8 per second (`regenDelayMs`, `regenPerSec` in `player.js`). Break line of sight to recover. Bots don't regenerate.
- **The weapon decides the words:** each gun uses one word list: short (3–4 letters: pistols, SMGs, shotguns, most LMGs, most melee), medium (5–6: assault rifles, launchers, heavy melee), long (7–8: marksman rifles, Arctic .50) or extraLong (9+: DL Q33, ZRG 20mm). Stronger weapons need longer words.
- **LMGs fire on belts:** every word fires a heavy burst. After a belt (5 bursts light, 3 heavy) the gun spins down to reload (4s light, 5s heavy), shown as a ring filling around you; letters wait meanwhile (switch or run if you need to). Changed in 0.13: LMGs used to need two words per burst.
- **Melee** (slot M): you spawn with a **random** melee weapon (knife, machete, bat, spade, hammer, sword or axe), a new one every spawn. All do 40 damage with short words; they differ in `reach` and push. Words only show on enemies within reach, so get close. Melee never runs out, never drops and can't be picked up.
- **Both guns empty:** you switch to melee. Picking up a gun while holding melee puts the gun in your hand.
- **Launchers** fire a round instead of hitting directly, and the blast does the damage (same falloff, wall blocking and knockback as a grenade). SMRS: a straight rocket. Thumper: a lobbed shell that explodes on impact. War Machine: 3 bouncing bombs on a short fuse. A round that touches an enemy explodes right there. They hurt you at half strength (`selfDamage 0.5`) if you're too close.
- **Ammo, no reloads.** Every gun has a number of attacks (`ammo`, starting rule `round(600 / damage)`, kept between 3 and 40), so stronger guns get fewer. One finished word (or one LMG burst) uses one. An empty gun is thrown away and you switch to your next weapon. Your typing speed is still your fire rate.
- **Typo** = a wrong letter on your locked word, or a first letter that matches no word. The gun jams briefly (0.5s, `typoJamMs` in `player.js`) and letters typed during the jam are ignored. The lock breaks and progress resets, but the word stays the same so you can retry it.
- **Word refresh:** words change every ~8 to 12 seconds (shorter on Hard, longer on Easy; range in `WORD_REFRESH` in `words.js`), after every hit, and when an enemy leaves and re-enters line of sight. Each target has its own timer, so words don't all change at once.
- **Word lock:** once you type the first letter, that word never changes until you finish it, make a typo, or the enemy dies or leaves your sight.
- **Unique first letters:** no two words on screen start with the same letter, so lock-on is never ambiguous.
- **Multiplayer:** each player sees their own words on enemies. Nobody can read what you're about to type, and players never race for the same word.
- **Obstacles** (walls, rocks, mountains) block bullets. Ricochet only on specific weapons.
- **Throwables** go over cover and hit enemies with no word showing (the ten kinds are in section 5). **Damage falloff:** full damage within `directHitRadius`, falling to 0 at `blastRadius`: the closer, the harder. **Walls weaken blasts but don't stop them:** behind a wall you still take 55% (`BLAST_THROUGH_WALL`; concussion and EMP pass walls too, flashbang and cryo need a clear line). Your own throwables hurt you (`selfDamage`), and tacticals catch you too if you're in range.
- **Chain reactions:** any explosion (frag, sticky, launcher, a bot's frag or rocket, a Scrap Bot, an EMP) sets off planted stickies within its radius.
- **Status effects** (one shared system for you and enemies, `status.js`):

| Effect | Caused by | What it does |
|---|---|---|
| Burning | Flamethrower, Molotov fire | 6 damage per second for 5s, red flames |
| Pinned | Nail Gun | 4s: no running, jumping or flying; in the air you drop and stay put |
| Bleeding | Combat Axe | 5s: the axe stays stuck in the body and the wound bleeds (4 per second, blood dripping); no pin, they can still move. Up to 3 axes at once, then it drops out |
| Blinded | Flashbang | Enemies can't see you (no shooting). You: a white glare around the bang, a faint afterimage and blurry vision that clears. Longer up close; looking away cuts it to 40% |
| Dazed | Concussion | 4s: about a third of normal speed, jetpack barely lifts, enemies attack slower |
| Shocked | EMP | 4s: no jetpack or Jet Boost (you fall), no gun switching, drones drop |
| Frozen | Cryo Bomb | 4s: very slow, jetpack frozen, enemies attack slower, ice over the body |
| Gassed | Gas Grenade | While breathing it: 20 damage per second (armor doesn't help), coughing, bleeding, an orange outline; you gasp for air. Machines and cyborgs are immune |

- **Smoke** is a drifting cloud. Only the side that threw it sees through it: for you, enemies inside show as see-through **night-vision outlines** (their real shape, green, with scanlines) and their words turn green on top of the cloud. Enemies inside are blind until they leave, and can't see you (or the words over your head) through it. Teammates will share this in team modes (`team`).
- **Collisions:** characters (you, dummies, bots) are solid to each other. Landed crates are solid to everything and stack; falling crates pass through characters. A crate whose center lands over empty space tips off the edge. Grenades bounce off terrain, crates and characters, and ignore the thrower for 0.3s after the throw (`ownerIgnoreMs`). Launcher rounds never hit their shooter.
- **Blast knockback:** survivors get pushed away from the blast and up a little, stronger with more damage (full push at `knockbackFullAt`). Right after a push you have no control for a moment (`knockbackStaggerMs` in `player.js`), so a blast near the edge can throw you into the void. Stationary dummies don't move; bots do (heavy enemies less: `knockbackScale`).
- **Hit effects (0.14):** blood sprays away from the shot (narrow for bullets, wide for melee, every way for blasts) in the color of what it hit: red, rotten green-brown (undead), green (aliens), purple (mutant), bone dust, oil and sparks (machines), straw (dummies). Fire gives ash, gas gives green coughs. Drops splat on the ground and fade.
- **Deaths (0.14):** the body breaks into pieces that bounce and fade (machines into metal plates and bolts, skeletons into bones); each piece makes a sound as it lands. Falling into the void leaves nothing.
- **Liquids (0.15):** a frag, sticky or rocket going off **under water** makes no fire: a muffled boom, bubbles and a tall column of water. It hits everyone in that water harder (110%) and anyone outside it at 35%; a blast in the air only reaches someone fully under water at 35%. Blasts just above a surface throw up spray; blasts in lava fling lava. Throwables sink slowly in water and **cook off** in lava; a molotov on water just hisses into steam. Rockets go off when they hit the surface. Enemy bullets only travel a short way into water, so diving protects you. Items and body parts sink (or burn up in lava), blood thins out in water. **Cryo** freezes water it reaches into an **iceberg** with rough cut edges: a jagged top just above the surface you can stand on and a deep chunk below that traps anyone under it, until it cracks and breaks (8s). Anyone caught in it is frozen. Cryo does nothing to lava. **EMP** shocks everyone in the water it touches (10 damage), you too.
- **Debris (0.15):** bullets that hit a wall knock off chips in that wall's color with a puff of dust; explosions throw chunks of the ground they went off against.
- **Gore toggle (F2):** Off (white impact flakes, bodies vanish in a puff) / Cartoon (default) / Full (more and darker blood, red bits, longer splats). Moves to the Settings menu in Phase 9.
- **Explosions (0.14):** no shapes, just a white-hot flash, rolling fireballs, rising smoke, sparks, bouncing debris, dust along the ground and a scorch mark (frag, sticky, rocket and Scrap Bot each look different). Tacticals have their own look: flashbang star and glitter, concussion dust shockwave, EMP crawling lightning, cryo frost and ice shards.
- **Finishing touches (0.14):** the gun (or throwable) in your hand shows at your side; a split-second freeze and shake when you land a kill; the screen kicks by weapon weight; smoke curls from the barrel and brass casings flip out and tink on the ground (`JUICE` in `effects.js`).
- **Sound (0.14):** every sound is made in code with the browser's Web Audio, no audio files (`sounds.js`). Each gun family has its own shot (enemy shots quieter and lower), explosions bang with an echo, fire crackles, the saw whines and grinds (screeches on metal), pickups whoosh, the gun jams and the LMG reloads like the real thing. Everything rings in a light room reverb; far sounds are quieter, panned to their side. Loops play while things last: smoke and gas hiss, molotov fire, you burning (with cries of pain), you gasping in gas, the jetpack (thinner with Jet Boost). Every enemy class has its own death cry (built like a real voice), machines fall apart as metal scrap, and anyone falling into the void cries out thin and echoing.

---

## 5. Loadout and pickups
**Slots:** 2 guns (1, 2) + 1 melee weapon (M, always there) + 2 throwable slots (T1, T2). The two throwable slots never mix: each holds one kind with its own count. The weapon in your hand shows at your side.

**Default spawn (reshuffled every spawn):** a random assault rifle + a random sniper or marksman rifle (never the same gun twice in a row) + a random melee weapon + 3 frag grenades (`DEFAULT_LOADOUT` in `weapons.js`). Players spawn by dropping in from the sky. Melee only ever comes with your spawn: it never drops anywhere.

**HUD:** top right, one line per slot with ammo (`> 1. AK-47 18/18`, `M. Bat (melee)`), three lines about the weapon in hand (family and word list, damage, range or reach or belt), then both throwable slots (`> T1. Frag Grenade x3`) and your Riot Shield's HP. A picture of the weapon in hand sits left of the panel and pops when you switch. An **ARMOR** bar appears next to HP while you wear a vest.

**How items reach the map** (tuning in `src/data/airdrops.js`, with the per-minute maths in its comments):
1. **Crates** parachute down (one every ~20s, max 2 on the map, gone ~40s after landing, blinking first). Each holds one random gun from each of SMG, assault rifle, shotgun, LMG, sniper and marksman (keys 1–6). Take any 2, then the crate is gone. Your old gun drops beside the crate; your other old gun is put in your hand as the suggested next swap (take a second gun to replace it, or walk away to keep it). Picking a gun you already hold refills it. Military bots take their best pick too.
2. **Supply drops** fall loose and spinning, in two lanes, each with its own timer and its own cap:

| Lane | Every | Max on map | Gone after | What falls |
|---|---|---|---|---|
| Throwables | 12s (7.5s while you have none) | 2 | 22s | frag 26%, sticky 13%, molotov 13%, axe 9%, smoke 7%, gas 6%, flashbang 7%, concussion 7%, EMP 7%, cryo 5% (2 per drop) |
| Items | 20s | 2 | 30s | health pack 24% (3× while under 40% HP), pistol 22%, Jet Boost 16%, armor vest 14%, riot shield 10%, special 8%, launcher 6% |

   - **Rare guarantee:** if no special or launcher has fallen for 3 minutes, the next items drop is one. In practice: a special about every 3 min, a special or launcher about every 1.5–2 min.
   - **Litter guard:** no supply drop while 6 or more loose items are already on the ground.
3. **Death drops:** when you die, your guns (with their ammo) and both throwable slots pop out where you fell. **Military enemies** drop their guns and frags; every other enemy vanishes with its weapon. Melee and shields never drop. They vanish after **30 seconds** (blink first); at most 6 on the map. Nothing drops in the void. You respawn with the default loadout.

**Pickup panel:**
- Get **near** a landed crate or loose item (no need to touch it): it gets a yellow outline and a panel at the bottom shows its picture, name and keys. Crates come first when both are near.
- The game **does not pause**, so you can get killed while choosing.
- **Guns:** 1 / 2 put it in that slot (your old gun drops with its ammo); a gun you already hold refills instead. Swapping the gun in your hand counts as a weapon switch (lock breaks, words re-roll).
- **Throwables (3):** same kind as a slot tops it up to `maxCarry`; a new kind goes into a free slot and comes to your hand; with both slots full it replaces the one in your hand (the old one is left on the ground).
- **Auto pickup:** walk over a Health Pack (when hurt), a Jet Boost, an Armor Vest (unless yours is full) or more of a throwable you already carry (until that slot is full) and it's yours, no key.
- **Items (3):** Riot Shield is equipped (and Health Pack / Armor Vest from the panel if you prefer).

**Icons:** every item has a placeholder picture, drawn from rectangles in `src/data/icons.js` and turned into textures at boot. Real art replaces them in the art pass under the same names.

**Arsenal I (built in 0.11):**
| Family | Weapons | Words |
|---|---|---|
| Pistols | MW11, Desert Eagle, Renetti (3-round burst) | short |
| SMGs | RUS-79U, Switchblade, QQ9, Fennec, MAC10, PP19 Bizon | short |
| Shotguns | BY15, KRM-262, Striker | short |
| Assault rifles | AK-47, M4, AK117, Type 25, M13, Kilo 141, Oden, AS VAL (short words) | medium |
| LMGs (belt + reload) | RPD, Chopper, Holger 26, M4LMG (medium words), PKM (medium words) | short |
| Marksman | Kilo Bolt-Action, MK2 | long |
| Snipers | DL Q33, Arctic .50 (long words), ZRG 20mm | extraLong |
| Launchers | SMRS, Thumper, War Machine | medium |
| Melee (random at spawn, all 40 damage) | Knife, Machete, Bat, Spade, Hammer, Sword, Axe | short |

**Arsenal II (built in 0.13):**

*Specials* (player-only: no enemy spawns with or loots one):
| Weapon | Words | How it works |
|---|---|---|
| Saw Gun | medium | A blade that weaves (zigzag, wave or diagonal) toward the target, bounces off walls, cuts through enemies in its way, then sticks and grinds until it explodes; retargets if the target dies |
| Nail Gun | short | Every nail pins the target for 4s |
| Laser Gun | long | A beam through every enemy in a line (80% damage per extra enemy); walls stop it |
| Flamethrower | short | 200px red cone that sets everyone in it on fire |

*Throwables* (10; you only; Military enemies throw frags and nothing else):
| Throwable | Flight | What it does |
|---|---|---|
| Frag Grenade | arc, bounces | Explodes on its fuse |
| Sticky Grenade | straight, 120–320px | Explodes on impact with an enemy. On a floor, wall or crate it sticks and becomes a **trip mine**: arms after 1s (red ring shows its 90px zone), then goes off when **anyone** comes close, enemies or you. Beeps for a quarter second first. Max 3 planted, fizzles after 30s |
| Molotov | arc | Breaks into a 150px fire patch for 5s that sets anyone in it burning, you too |
| Combat Axe | straight, spins end over end | 60 damage and a shove to the first enemy, then it **stays stuck in the body** and they bleed (section 4); no blast. Bots' axes do the same to you |
| Smoke Grenade | arc | Hisses out a drifting 9s cloud: enemies inside are blind and show to you as night-vision outlines (section 4) |
| Gas Grenade | arc | Hisses out a green 8s cloud: anyone breathing it chokes and bleeds (20/s, armor doesn't help), you too; machines and cyborgs are immune; enemies run out of it |
| Flashbang | arc | Blinded (see section 4) |
| Concussion | arc | Light blast (15 damage, shove) + dazed |
| EMP Grenade | arc | Shocked; 80 damage to Machines (drones die); sets off stickies |
| Cryo Bomb | arc | Frozen |

*Utility:*
| Item | What it does |
|---|---|
| Jet Boost | 20s of floating: see section 6 |
| Riot Shield | Held on the side you face; blocks gun bullets and pellets only (not melee, specials or throwables). 200 HP, rim turns red when worn. Any explosion knocks it off. One-handed weapons only (pistol, SMG, melee): picking it switches you to one. **Throwing puts it down** where you stand, keeping its wear; press 3 to pick it back up |
| Health Pack | +50 HP at once (not at full HP) |
| Armor Vest | 100 armor points, works from every side. Takes a share of each hit from its points, the rest still hurts you: bullets 70%, melee 50%, explosions 35%, fire and gas 0%. Picked up automatically when you walk over it (unless yours is full). Gone at 0 or when you die |

Stats live in `src/data/weapons.js` (guns, specials, throwables), `src/data/items.js` (utility) and `src/data/status.js` (effects).

**Weapon names:** guns use the real names Victor chose (AK-47, M4, Holger 26…), replacing the earlier "own names" rule (decided in 0.11). Mini Militia's names and art are never used.

**Later ideas:** dual pistols (throwing drops one); fuel tank pickup; trip mines for enemies on a harder difficulty; player voice choice (man / woman / child, `PLAYER_VOICE`) with character select.

---

## 6. Movement
- **Gravity is always on.** Nobody floats in place.
- **Slow fall while typing mid-air:** you drift down slowly, not fast. Upward momentum carries briefly, then you drift. Typing long words in the air is a risk, especially over the void.
- **Jetpack** for players and most enemies, with a **fuel bar** that refills on the ground only (also while typing on the ground).
- **Jetpack feel:** thrust builds speed (acceleration), capped rise speed, release Up and you arc back down. Down in the air falls faster.
- **Escape move:** pressing Up while typing mid-air exits typing and fires the jetpack instantly.
- **Jet Boost** pickup: 20s of floating. Gravity is off and you sink slowly; arrows glide you in any direction (eased, quick enough to dodge bullets), let go and you drift to a stop and keep sinking. Blue flame, gold fuel bar. An EMP, a Cryo Bomb, a nail pin or a blast still wins. On water you **float on the surface**: you can't go under until the boost runs out.
- **Status slowdowns:** dazed and frozen slow your running, flying and floating; shocked and frozen stop the jetpack (section 4).
- **Run out of fuel over the void, and you fall.**
- **Knocked back by a blast:** no control for a short stagger (also while typing), then normal rules again.
- **Tuning** lives in `src/data/player.js` (run speed, air speed, thrust, rise cap, fuel drain and refill, typing fall speed, knockback stagger, respawn delay).

---

## 7. Characters and enemies
**Your character is cosmetic** (same size and stats): soldier, zombie, bot, wizard, archer, ninja, and more over time.

**Enemy characters are not just looks:** an enemy's type sets its looks, behavior, speed and HP, matched realistically (decided in 0.12). More HP means more words to type. Each character is one entry in `BOTS` (`src/data/enemies.js`); placeholder colors until the art pass.

**Roster (starting values, tune in playtests):**
| Family | Character | Moves | Fights with | HP |
|---|---|---|---|---|
| Military | Soldier | jetpack | assault rifle + pistol + frag grenades | 65 |
| Military | Mercenary | jetpack | sniper or marksman + pistol, sharp aim | 65 |
| Military | Commando | jetpack, fast | shotgun or SMG + machete | 65 |
| Military | Armoured Trooper | jetpack, slow, hard to push | LMG + pistol | 130 |
| Undead | Zombie | walks slowly | claws | 70 |
| Undead | Skeleton | walks fast | bone club | 30 |
| Undead | Infected Soldier | jetpack | SMG, sloppy aim | 60 |
| Machines | Drone | always flying | pistol or SMG | 30 |
| Machines | Android | jetpack | assault rifle, sharp aim | 70 |
| Machines | Robot | jetpack, slow, hard to push | LMG | 120 |
| Machines | Scrap Bot | walks | runs up and explodes | 40 |
| Sci-fi | Alien | jetpack, fast | SMG | 50 |
| Sci-fi | Cyborg | jetpack | assault rifle or SMRS launcher | 90 |
| Sci-fi | Mutant | walks, big | fists that throw you back | 110 |
| Animals | Zombie K9 | runs and leaps | bite, then backs off (hit and run) | 40 |

**Movement types** (`movement`):
- **Jetpack:** your physics (gravity, fuel, knockback). Its AI presses a "virtual controller" instead of arrow keys, so it can't cheat.
- **Walker:** no jetpack. Jumps walls it can clear and gaps one leap can cross, never walks into the void. Walkers drop in on the ground you stand on, at its far end, so they can reach you.
- **Leaper (animals):** a walker that jumps high and far and pounces from close range.
- **Flyer (drones):** always airborne, no gravity or fuel; hangs above you and keeps darting about.

**Gear:**
- **Military characters are the smart ones:** they loot crates and drops, swap and switch guns for the distance (close with a shotgun, far with a sniper), throw **frag grenades only** (more when you hide), and run out of ammo like you. They never use specials or any other throwable.
- **Military explosives hurt everyone:** their frags and rockets hurt you, other enemies and themselves; a bot killed by a bot's blast isn't your kill.
- **Everyone else keeps what it spawns with** (an SMG enemy always has an SMG), so you know what to expect from its looks: endless ammo with a reload pause every 5 attacks, no looting, no throwables.
- **Only Military drop their gear** when they die (guns and frags). Every other enemy vanishes with its weapon, so the ground stays clear.
- **Your tacticals work on them:** blinded or smoked enemies can't see you, dazed and frozen ones move and attack slower, shocked ones can't switch guns and drones fall out of the sky.

**How enemies fight:**
- **Think at reaction speed:** a few times a second they decide to approach, back off, hold range (with side-steps), hunt (go where they last saw you, for ~4s) or loot. They keep space from each other and fly around platforms overhead.
- **Void-safe:** they cross gaps only with enough fuel (or one leap) and somewhere to land, turn back before their fuel runs out, and land to refuel. A blast can still knock them in.
- **Shoot like a typist:** only with line of sight, after a reaction delay (`reactionMs`), then once per "typed" attack: the weapon's words at `typingSpeed` letters per second.
- **Real bullets that can miss:** red, fly straight, walls stop them. Aim error grows when you move, when they move, and with distance; they only partly lead a moving target. Standing still to type makes you easier to hit.
- **Softer than you:** bot bullets do `damageScale` (0.5) of the gun's damage, and no enemy deals more than `maxDps` (7) per second: heavy weapons wait longer between attacks.

**Playable under pressure** (you stop to type, so you can't dodge much):
- **Attack turns:** at most 2 enemies shoot at you at the same time; each keeps its turn for 6s, then rests so another can go.
- **Hit flinch:** every hit you land throws that enemy's aim off and delays its next shot. Typing is also your defense.
- **Health regen** (section 4) and soft bot damage. With four enemies out, you take about 3–4 damage per second when fully exposed.

**Spawning:** up to 4 enemies at once: **2 main characters** (humanoids), **1 machine** and **1 animal** (`enemies` in `maps.js`). The main pair comes from one family that rotates every 2 minutes (Military → Undead → Sci-fi); machines and animals are picked at random. A dead enemy is replaced 3s later by a new random type for its slot. A bot that falls into the void after you did half its HP in the last 10s counts as your kill; one that blows itself up doesn't. Dying to an enemy shows "Killed by a …".

**Tuning** lives in `src/data/enemies.js`: `BOTS` per character, `BOT_AI` for everyone (reaction, turns, flinch, reload, grenades and which throwables are allowed, loot, drones), `BOT_RANGES` per weapon family, `BOT_BULLETS`, `NATURAL_WEAPONS`, `SPAWNER`.

---

## 8. Maps
**Shared rules:**
- Most maps float over a **void** (Glacier: an endless icy sea). Fall in and you die. Catacombs and Graveyard have no void: solid ground at the bottom.
- **The void** is drawn as a dark gradient with rising mist (map config: void top, death line, colors). Falling past the death line kills you, clears your half-typed text, and you drop back in from the sky after a short delay. Hell's void is a **lava sea** ("Fell into the lava").
- Maps are either **open sky** (limitless upward) or **enclosed** (dome or roof).
- **Every map has its own layout, rules, hazards, landscape and advantages.** No shared template.
- **Tall maps (0.15):** lots of open air above (islands and platforms to fight on), the main level, **openings** (shafts, gaps, tunnels) to drop through, and open air **under the map** with hanging rock and low islands, so you can fight above, on and under the map and fly back up through the gaps.
- **Map hazards are slow on purpose:** they wear you down, they don't kill you as fast as an enemy does. A bot you hurt badly that then dies to the map (void, lava, drowning, a geyser) still counts as your kill.
- **Hiding:** fully under water or inside a bush you're hidden. No word shows on you, enemies lose sight of you (one that bumps into you finds you anyway) and you turn see-through. Attacking gives you away for 1 second. The same goes for enemies you can't see.
- **Bots** stay out of water, lava and quicksand (they treat them like the void), and a bot that's chasing you but getting no closer tries another way round. Crates never land in water or lava.
- **Typeable hazards:** some hazards show a word, and typing it triggers the trap on enemies.
- Each map is a **config** in `maps.js` (Tiled file, sky, colors, void, enemies); how hazards behave is shared in `src/data/hazards.js`.
- **Maps are built in Tiled:** 32×32 tiles, tile layer `ground` (every painted tile is solid), object layer `spawns` (points `player`, `bot`, optional `dummy`), optional object layers `hazards` (`water`, `lava`, `quicksand`, `sea` and `dustdevil` rectangles, `geyser`, `vent`, `icicle`, `bell`, `boulderR` / `boulderL` points, `hands` rectangles, `waterfall` and `lavafall` rectangles) and `decor` (`tree`, `pine`, `palm`, `cactus`, `rock`, `mushroom`, `spire`, `bones`, `penguin`, `scorpion`, `coffin`, `cobweb`, `candles`, `deadtree`, `cross`, `lantern` points; `fence`, `fog`, `bush`, `igloo`, `bigtree`, `chain`, `cave`, `fireflies` rectangles). Tileset embedded in the map, saved as `.json`. Forest, Hell, Glacier and Desert are made by `tools/make-maps.mjs` (`node tools/make-maps.mjs`), with placeholder tilesets drawn in code (rounded edges, grass, rocks), and can then be edited in Tiled.

**Forest ("Riverbend"), done in 0.15:** sky blue, greens and sand. A cliff with a cave tunnel and a waterfall pouring into a deep lake, a rolling meadow with boulders and a treehouse, a chasm, a rocky highland with a pond, root caverns, islands and a hidden pond under the map, grassy islands in the sky. Birds that chirp, drifting clouds and leaves, fish jumping in the lake, fireflies under the map, trees, bushes, mushrooms, rocks and grass.
- **Water:** partly in it just slows you (no damage). Fully under: hidden, 5s of breath (a bar over your head), then drowning at 8 HP/s until you come up. Water puts out fire.
- **Waterfall:** pushes you down while you're in it.
- **Advantage:** hide under water or in bushes.

**Hell ("Inferno"), done in 0.15:** a red sky with jagged peaks, smoke and embers. A spiked basalt plateau with a lava pit and a shaft, a volcano with a lava crater and a tunnel through its base, floating rock steps with an iron bridge and a hot spring, a lava fall into the sea, rocks hanging on chains in the sky, broken islands over a **lava sea**. Spires, rocks and old bones.
- **Lava:** touching it sets you burning (6/s). Fully in it you have 2.5s (an orange bar) before you start melting (10/s on top of the burn): like drowning, only faster and on fire.
- **Fire geysers:** rumble and smoke, then blast a column of fire that burns you and throws you up (6 per hit plus burning).
- **Advantage:** heat vents (glowing grates) lift you and refill your jetpack fast. Hide in the hot spring like the lake.
- Drifting smoke in the sky is a darkened white.

**Glacier ("Frostbite"), done in 0.16, reworked in 0.17:** **no void: the whole glacier floats on an endless icy sea.** Pale blue sky with northern lights, snowy mountains, falling snow, icebergs on the far sea and whales spouting. A snowy peak with an ice cave full of icicles and a half-flooded sea cave at the waterline, a frozen lake with thin spots, a chasm straight down to the sea with ice floes, a slippery glacier with crevasses down to the sea, a grotto at the waterline (more icicles), an icicle overhang over the path, igloos (one up on a floating ice island), floes and a small berg out on the open sea. Snowy pines, rocks and penguins that waddle (rocking and bobbing with each step), stop to look around, and flop on their bellies to slide away when you come close. A blast kills any caught in it (they come back later).
- **The sea:** freezing water like the lake (you're frozen for a moment when you fall in, you can swim and hide under), but it goes down forever: sink past the death line deep under the surface and you're gone ("Sank into the icy deep"). Bots and crates stay out of it.
- **Ice:** slippery. Your speed only slowly follows what you press, so you skid to a stop and take a moment to get going (`ICE.gripMs`).
- **Thin spots** on the frozen lake are traps for everyone, bots too: stand on one and it cracks (0.5s) then breaks (1.1s) into freezing water, and you have to find the hole to get out. **Explosions smash thin ice** (frags, stickies, rockets, even under the water). It freezes over again after 12s.
- **Advantage: icicles.** They hang from ceilings and show a word. Type it (that takes a shot) and the icicle snaps off and drops on whoever is below: 45 damage and frozen (it counts as your kill). Grows back after 15s. **Igloos:** step inside one and you're hidden (like a bush), and its warmth thaws you out.

**Desert ("Dune Sea"), done in 0.16, more life in 0.17:** a hot sky with a big sun, mesas in the distance, heat shimmer, and a **camel caravan** (with a rider) walking along the far dunes. Rolling dunes with a quicksand pit, a mesa with a natural arch through its base, an oasis with palms, a buried temple (a shaft down into a pillared chamber, a hole out the bottom, ruins on top) and a second quicksand pit, floating sandstone and scaffolds in the sky, islands underneath. Cacti, rocks, bones, scorpions that scuttle in short bursts and raise their tails when you come close (harmless; a blast kills them, they come back later), and tumbleweeds (dry plants rolled by the wind, looks only; a blast bursts them).
- **Quicksand:** you can barely move and it keeps pulling you down while you don't fight it. The jetpack (or a jump) pulls you out, slowly (fixed in 0.17: it used to cancel the jetpack and trap you). Fully under it you suffocate: 3s, then 6 HP/s. No hiding in it.
- **Cacti** prick you (3 damage) and push you off.
- **Dust devils** wander over the open sand: get caught in one and it lifts you and spins you about (no damage), with a howl of wind.
- **Advantage: sandstorms.** Every 35–55s a storm blows through for 14s: sand everywhere, howling wind, and nobody sees far. Words only show within 280px and bots only see you that close, so you can sneak up or get away. Hide in the oasis.

**Catacombs, done in 0.18:** **enclosed, no void.** A roof and floor of rock pieces, every wall and floor made of rough stones in mortar (no sand), on a black background with everything clearly visible (no darkness or torches). Three levels of tunnels joined by shafts: an upper gallery with pillars, a middle hall and a lower crypt hall with stone coffins, ossuaries full of bones, a low tunnel and a flooded crypt at the bottom (hide in it). Cobwebs, candles, chains, rubble heaps for cover, dust drifting in the dark.
- **Hazard: rolling boulders.** Every 14–22s a boulder rumbles (dust falls at the top of the ramp), then rolls down one of the two long ramps and along the hall below, and smashes on the far wall. It hits each character once per roll: 35 damage and thrown out of its way. It doesn't kill a healthy character outright, but it can finish off a hurt one.
- **Advantage: the levers.** A lever at the top of each ramp shows a word: type it to send the boulder down early, onto the enemies in its path (its hits count as yours). Tight tunnels for ambushes.
- Crates and drops come down inside the tunnels (no sky to fall from).

**Graveyard, done in 0.18:** night under a big moon, **solid ground to the bottom (no void).** A hill of tombstones, a stone chapel with an upstairs floor and doors each side, a bell tower, iron fences, dead trees, wooden grave crosses, flickering lanterns, open graves leading down into a pillared crypt, floating rubble and plank platforms, fog creeping along the ground, bats flitting overhead.
- **Hazard: grabbing hands.** On the grave hill (and by the fences) the ground cracks under whoever stands there, then a rotting hand bursts out and grabs them: held in place for 1.4s and 5 damage. Bots too.
- **Advantage:** tombstones are solid stone and block bullets. **The church bell** shows a word: type it to ring it and every enemy within 520px is dazed for 3.5s (rings again after 20s).

**Map list (draft, tune while prototyping):**
| Map | Sky | Hazard | Advantage |
|---|---|---|---|
| Forest ✅ | Open | Water: stay fully under too long and you drown (partly in is safe); waterfall pushes you down | Hide under water or in bushes (no word shows on you) |
| Hell ✅ | Open | Lava (pit, crater, the sea below), fire geysers | Heat vents refill jetpack fuel; hide in the hot spring |
| Glacier ✅ | Open | Slippery ice, thin spots over freezing water, an endless icy sea below | Type a word on an icicle to drop it on enemies; hide in igloos |
| Catacombs ✅ | Enclosed (no void) | Rolling boulders down the ramps | Type a lever's word to send a boulder onto enemies; tight tunnels |
| City | Open | Live power lines | Tall buildings for cover and height |
| Desert ✅ | Open | Quicksand pits, cacti, dust devils | Sandstorms: nobody sees far (words only close up) |
| Factory | Enclosed | Crushers and conveyors | Type a word on a crusher to trigger it |
| Sky Islands | Open | Strong winds push you | Ride the wind for long flights |
| Space Station | Enclosed | Airlocks pull you into the void | Low gravity, big jumps on less fuel |
| Graveyard ✅ | Open (no void) | Hands grab you from the ground | Tombstones block bullets; ring the bell to daze enemies |

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
**Offline** (Phase 8, free to run):
| Mode | Notes |
|---|---|
| You vs Military | You (optionally with AI Soldier teammates) against Military characters. Pick a kill target before the match; first side to it wins, else most kills when time runs out. Time limits from a ~20s kill pace plus slack: 20 kills / 8 min, 30 kills / 12 min, 50 kills / 20 min (check against real play) |
| Zombies | Waves of rushers |
| Endless vs Enemies | Survive until you die, in waves where all enemy types come, getting harder |

**Online** (Phase 11, after launch):
| Mode | Notes |
|---|---|
| Free for All | Timer, respawns, scoring |
| Team Deathmatch | Timer, respawns, scoring |
| Squad vs Military | Players team up (co-op) against Military bots |
| Capture the Flag | Carry the other team's flag to your base |
| Hardpoint | A zone scores for the team holding it (standing or flying over it); the zone moves at intervals; most hardpoint time wins |
| Kill Confirmed (FFA) | A kill counts only when you pick up the victim's dog tag; kills and confirms are tracked separately |
| Last One Standing | Free for All, no respawns |
| Word Duel | 1v1: both see the same words, first to finish fires. Fighting-game style: versus intro, big health bars, rounds |
| Infected | Players who die come back as zombies |
| Gun Game | Every kill moves you to the next weapon: SMG → assault rifle → shotgun → LMG → marksman → sniper → pistol → launcher → special → melee; the first melee kill wins |

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
- **Family-friendly by default:** cartoon-style blood and gibs. Gore toggle (F2 for now): Off / Cartoon (default) / Full.
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
| Sound | Made in code with Web Audio (no files, `sounds.js`); recorded CC0 sounds (Kenney) can replace any of them later |
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
│   ├── scenes/                  # Boot ✅ (loads maps, builds icons), Game ✅, Menu, Lobby, GameOver, Settings
│   ├── entities/                # Player ✅, Dummy ✅, Icicle ✅ (Glacier), Trigger ✅ (levers, bell), Bot ✅, Grenade ✅ (every throwable), Crate ✅, Pickup ✅, Projectile ✅ (launcher rounds), Bullet ✅, EnemyBullet ✅, Saw ✅, FirePatch ✅, Cloud ✅ (smoke and gas)
│   ├── systems/
│   │   ├── VoidSystem.js        ✅ void visuals (Hell: lava sea, Glacier: the deep under the icy sea), fall detection
│   │   ├── TypingSystem.js      ✅ typing state, words, lock-on, typos, word refresh
│   │   ├── wordPicker.js        ✅ unique-first-letter word picks
│   │   ├── LineOfSight.js       ✅ tile raycast: which enemies get words, which blasts land
│   │   ├── WeaponSystem.js      ✅ gun + melee slots, ammo, bullets and bursts, LMG belts, launchers, specials, damage + range falloff, two throwable slots, mouse aim, blasts, chain reactions, tacticals, Jet Boost / shield pickups
│   │   ├── StatusSystem.js      ✅ burning, pinned, bleeding (stuck axes), blinded, dazed, shocked, frozen, gassed (you and bots)
│   │   ├── EffectsSystem.js     ✅ blood, sparks, splats, gibs, wall chips, bubbles, gore toggle
│   │   ├── BlastFx.js           ✅ explosions, tactical bursts, muzzle smoke, shells, night-vision outlines in clouds
│   │   ├── SoundSystem.js       ✅ sounds made in code: reverb, echo, loops, voices
│   │   ├── AirdropSystem.js     ✅ parachute crates, supply-drop lanes, rare guarantee, death drops
│   │   ├── PickupSystem.js      ✅ nearest crate/drop, crate keys 1–6, 1/2/3 swaps, refills and items
│   │   ├── CollisionSystem.js   ✅ object-vs-object collision rules
│   │   ├── Terrain.js           ✅ ground, wall and void checks for bot AI
│   │   ├── BotBrain.js          ✅ bot AI: decide (approach, back off, hold, hunt, loot, retreat) and move safely
│   │   ├── BotCombat.js         ✅ bots attacking: turns, reaction, typing time, aim error, bullets, melee, launchers, grenades, bombers
│   │   ├── BotGear.js           ✅ what a bot carries: loadout, ammo, gun choice, loot, drops
│   │   ├── EnemySpawner.js      ✅ spawn slots, random types, family rotation
│   │   ├── HazardSystem.js      ✅ water, lava, quicksand, geysers, vents, bushes, falls, hiding, breath, splashes, blasts and throwables in liquids, icebergs, slippery and thin ice (blasts smash it), icicles, igloos, cacti, dust devils, sandstorms, boulders and levers, grabbing hands, the church bell
│   │   ├── BackdropSystem.js    ✅ sky, sun, clouds, parallax hills/spires/mountains/mesas, birds, camel caravan, far icebergs and whales, heat shimmer, leaves, snow, northern lights, embers, fireflies, tumbleweeds, penguins, scorpions, moon, bats, fog, coffins, cobwebs, candles, lanterns, fences, dead trees, crosses, trees, pines, palms, cacti, rocks, caves, grass
│   │   └── ScoreSystem.js       # kills, assists, fall credit, MVP
│   ├── ui/
│   │   ├── Hud.js               ✅ HP, fuel and armor bars, weapon panel + icon, throwable slots, state tag
│   │   ├── Icons.js             ✅ builds item icon textures at boot
│   │   ├── color.js             ✅ color blending helper
│   │   ├── PickupPanel.js       ✅ pickup panel (icon, name, keys) at the bottom of the screen
│   │   └── WordLabel.js         ✅ word plates above targets
│   └── data/
│       ├── player.js            ✅ movement, HP, regen, typing and knockback tuning (bots scale it)
│       ├── maps.js              ✅ map configs (Forest, Hell, Glacier, Desert, Catacombs, Graveyard, test), map select (F6), tile palettes, slippery tiles
│       ├── hazards.js           ✅ hiding, water, lava, ice, thin ice, icicles, quicksand, cacti, sandstorms, boulders, hands, bell, falls, icebergs, geysers, vents, decor tuning
│       ├── words.js             ✅ word lists by length, refresh timer
│       ├── weapons.js           ✅ weapon categories, guns, launchers, specials, melee, throwables, aim, loadout
│       ├── items.js             ✅ Jet Boost, Riot Shield, Health Pack, Armor Vest
│       ├── status.js            ✅ status effect durations and strengths
│       ├── effects.js           ✅ gore levels, materials, blast looks, cloud vision, finishing touches (JUICE)
│       ├── sounds.js            ✅ every sound recipe, loops, voices, death cries
│       ├── bullets.js           ✅ bullet speed and look per gun family, damage-number merge
│       ├── icons.js             ✅ placeholder icon shapes
│       ├── enemies.js           ✅ target dummy, enemy roster (BOTS), bot AI, ranges, bullets, spawner
│       ├── airdrops.js          ✅ crate timing and contents, parachute, tipping, pickup radius, supply-drop lanes, death drops
│       └── characters.js
├── public/assets/
│   ├── maps/                    # Tiled maps (.json): test, forest, hell, glacier, desert, catacombs, graveyard ✅
│   └── tilesets/                # tile images: placeholder, forest, hell, glacier, desert, catacombs, graveyard ✅
├── tools/
│   └── make-maps.mjs            ✅ builds the Forest, Hell, Glacier, Desert, Catacombs and Graveyard maps and tilesets (no packages)
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
| 4.5 | Arsenal I | Weapon categories and ammo in data, melee, pistols, SMG, shotgun, rifle variants, LMG, marksman, rocket launcher, thumper, placeholder icons, frag supply drops | ✅ |
| 5 | Enemies | Enemy roster with jetpack, walker, leaper and flyer movement; shooters, rushers and a bomber; smart Military gear; spawn slots; attack turns, flinch, regen | ✅ |
| 5.5 | Arsenal II | Status effects, saw gun, nail gun, laser, flamethrower, sticky grenade (also the trip mine), molotov, combat axe, smoke, flashbang, concussion, EMP, cryo bomb, Jet Boost, riot shield, health pack, armor vest, mouse aiming, two throwable slots, crates and supply lanes | ✅ |
| 6 | Effects | Blood, gibs, gore toggle, explosions, smoke/gas clouds with night vision, sounds made in code (shots, explosions, loops, voices, death cries), finishing touches | ✅ |
| 7 | Maps | All launch maps with hazards and advantages, open and enclosed | 🔄 Forest ✅ Hell ✅ Glacier ✅ Desert ✅ Catacombs ✅ Graveyard ✅, 4 to go |
| 8 | Offline modes | You vs Military, Zombies, Endless vs Enemies, scoring, awards | |
| 9 | Menus and guest | Menu, settings, name and character select, local saves | |
| 9.5 | Art pass | Replace placeholders with final sprites, tiles, backgrounds and effects | |
| 10 | Launch | Published on itch.io, linked from the VAO site | |
| 11 | Online | Sign-in, lobby, online modes (section 10) | |
| 12+ | Upgrades | Coins, more weapons, characters and maps | |

---

## 17. Open decisions
- [ ] Final hazard and advantage behavior per map (Forest and Hell starting values in `hazards.js`)
- [ ] Remaining maps: City, Factory, Sky Islands, Space Station (each its own layout and rules)
- [ ] Map art: code-drawn placeholders for now (rounded edges, rocks, decor); final tiles in the art pass (9.5)
- [ ] Match length and kill targets (starting values in section 10; measure the real kill pace)
- [ ] Exact weapon stats (damage, word length, range falloff)
- [ ] Blast knockback strength and stagger time (starting values 520 px/s, 220 lift, 350ms)
- [ ] Drop tuning (starting values: crates every 20s, 40s life; throwables lane every 12s, items lane every 20s; specials guaranteed every 3 min; death drops 30s, max 6)
- [ ] Status effect strengths and durations, armor shares and flashbang strength (starting values in `status.js`, `items.js`, `weapons.js`)
- [ ] Effects and sound tuning: gore amounts, blast looks, hit-stop length (70ms), shake, volumes, reverb and echo (starting values in `effects.js`, `sounds.js`)
- [ ] Ammo per weapon (starting rule: shots = 600 / damage), burst sizes and bullet speeds, launcher blast and self-damage (starting 0.5)
- [ ] Enemy tuning per character: HP, speed, aim, typing speed, damage share (starting values in `enemies.js`). Difficulty (Phase 9) will scale damage, aim and attack turns
- [ ] Bot routes on the new maps: bots now try another way when they can't get closer; real routing through tunnels and shafts if they still get stuck
- [ ] Mouse movement details
- [ ] Slow-fall speed while typing (starting value 60 px/s in `player.js`)
- [ ] Final movement tuning (starting values in `src/data/player.js`)
- [ ] Respawn delay and spawn points per map (starting value 1.5s; bots drop in at one of the 3 `bot` points farthest from you)

---

## 18. Changelog
- **0.18:** Phase 7 part 3: Catacombs and Graveyard, both with no void. Catacombs: enclosed, everything built of rock pieces on a black background, three levels of tunnels, coffins, ossuaries and a flooded crypt; boulders roll down the ramps (hurt and throw you, no instant kill) and a lever's word sends one early onto enemies. Graveyard: night, a hill of tombstones that block bullets, a chapel and bell tower (type the bell's word to daze enemies), open graves into a crypt, fog, bats, lanterns; hands burst out of the ground and grab whoever stands on the graves. Crates drop inside tunnels on enclosed maps.
- **0.17:** Glacier now floats on an endless icy sea instead of the void (swim in it, sink too deep and you're gone), with a sea cave, a grotto, floes, igloos you can hide in (they thaw you out), penguins, far icebergs and whales. The frozen lake is solid ice with thin spots that trap anyone, bots too, and explosions smash thin ice. Desert: quicksand fixed (the jetpack or a jump gets you out now), a shallower pit, a camel caravan on the far dunes instead of vultures, dust devils that toss you about, scorpions, heat shimmer, tumbleweeds that look like tumbleweeds. Wildlife moves naturally (no jitter: penguins waddle and belly-slide, scorpions scuttle and raise their tails) and dies in blasts.
- **0.16:** Phase 7 part 2: Glacier and Desert, each with its own layout, rules and advantage. Glacier: an icicle cave, a frozen lake of thin ice over freezing water, a slippery glacier with crevasses, northern lights and snow; ice makes you slide, thin ice cracks and breaks under you, and typing the word on an icicle drops it on whoever is below. Desert: dunes with quicksand, a mesa with an arch, an oasis, a buried temple with a pillared chamber, vultures and tumbleweeds; quicksand pulls you under, cacti prick, and sandstorms roll through so nobody sees far. Hell tweaks: cryo no longer affects lava, cryo on water now makes a rough-cut iceberg, darker white smoke. Bots no longer drop in inside ragged rock.
- **0.15:** Phase 7 (Maps) part 1: Forest and Hell. Two tall maps with their own layouts, rules, hazards and advantages: air above, openings to drop through and a whole fight zone under the map. Forest: cave tunnel, waterfall and lake, treehouse, boulders, pond, root caverns, birds, fish, leaves and fireflies; water slows you, hides you fully under and drowns you slowly; bushes hide you. Hell: volcano with a lava crater and tunnel, lava pit, hot spring, lava fall into a lava sea, fire geysers, heat vents that refuel you. Hazards wear you down instead of killing fast (lava now melts you like drowning, a bit faster). Liquids change combat: muffled underwater blasts with water columns, water shielding you from blasts and bullets, grenades sinking or cooking off, molotovs steaming, splashes for everything that falls in, Jet Boost floats you, Cryo freezes water into ice you can stand on (or crusts lava), EMP shocks the water. Bullet chips and blast chunks off walls. Combat Axe now looks like an axe, sticks in the body and makes it bleed. Code-drawn tiles with rounded edges and rocks. Bots try another way when stuck. Map select (F6 or `?map=`). Test dummies removed from the new maps.
- **0.14:** Phase 6 (Effects) done. Blood, splats and body pieces by what each enemy is made of, with a gore toggle (F2). Explosions rebuilt from fire, smoke, sparks, debris and scorch, and each tactical has its own look. New Gas Grenade (choking, bleeding, machines immune). Smoke rework: a drifting cloud only the thrower's side sees through, with enemies shown as night-vision outlines and green words. Blasts now reach behind walls at 55%. Every sound made in code with Web Audio: guns by family, bangs with echo, crackling fire, saw grinding, hissing clouds, gasping, death cries per enemy class, metal scrap for machines, void falls echoing away; sound toggle (F4). Finishing touches: gun in your hand, hit-stop on kills, screen kick, muzzle smoke, brass casings. Auto pickup for health, Jet Boost, armor and your throwables. Spawn loadout reshuffles every spawn (assault + sniper/marksman + melee).
- **0.13:** Phase 5.5 (Arsenal II) done. Four player-only specials: Saw Gun, Nail Gun, Laser Gun, Flamethrower. Nine throwables: frag, sticky grenade (also a trip mine anyone can set off), molotov, combat axe, smoke, flashbang, concussion, EMP and cryo, with chain reactions. A shared status system: burning, pinned, blinded, dazed, shocked, frozen. Two throwable slots (Tab or wheel) and mouse aiming (hold left click, release to throw). Jet Boost (floating), Riot Shield, Health Pack and Armor Vest that soaks hits realistically. Crates now offer 6 guns (take 2); loose supply drops come in two lanes (throwables, items) with a guaranteed special every few minutes and caps against litter. Random melee at every spawn (all 40 damage), LMG belts with reloads, shotgun pellet cones. Military throw frags only and are the only enemies that drop gear.
- **0.12:** Phase 5 (Enemies) done. 15 enemy characters in 5 families (Military, Undead, Machines, Sci-fi, Animals) whose type sets looks, behavior, speed and HP. Bots move with your physics through a virtual controller, with jetpack, walker, leaper and flyer movement, and stay out of the void. They hunt you, keep their range, and shoot back with real bullets that can miss, at a typist's pace and with softer damage. Military characters loot, swap guns and throw grenades; others keep the weapon they spawn with. Scrap Bots explode, the Zombie K9 bites and backs off. Up to 4 enemies at once (2 main, 1 machine, 1 animal) with a rotating family. Playable under pressure: attack turns, hit flinch and health regen. Modes list updated (3 offline, 10 online).
- **0.11:** Phase 4.5 (Arsenal I) done. 29 guns in 7 families plus 3 launchers and 7 melee weapons, using the names Victor chose. Each weapon picks its word list (short, medium, long, extraLong). Ammo per gun with no reloads; an empty gun is thrown away and the same gun refills. Melee slot M with reach and knockback (key 4). LMGs need two words per burst. Launchers: SMRS rocket, Thumper shell, War Machine bombs. Bullets now fly with a muzzle flash and still always hit, with bursts by gun family and one counting damage number. Placeholder icons on crates, drops, the pickup panel and the HUD. Frag grenades fall as supply drops instead of coming in crates.
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