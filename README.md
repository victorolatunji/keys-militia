# Keys Militia
*A VAO game. Living plan book: update it whenever the plan changes.*

**Version:** 0.8
**Owner:** Victor Olatunji / VAO
**Budget:** $0, free tools and free assets only
**Status:** Phase 2 complete. Phase 3 (Weapons) next.
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
- Only a **fresh** arrow press cancels typing. Holding an arrow while you start typing does not.
- Words use **lowercase letters only**, so Shift, Space, digits and arrows never clash with typing.

---

## 4. Combat
- **Line of sight:** words only appear on enemies you can actually hit **and that are on screen**. Behind a wall or off screen, no word. Checked with a tile raycast from your eyes to the target.
- **Leaving sight** hides the word and breaks your lock. Coming back into sight gives a different word.
- **One word = one shot.** A new word spawns after each hit until the enemy dies.
- **Shots are instant (hitscan)** for now: finishing a word hits immediately with a tracer. Weapons in Phase 3 decide damage, and may add travel time.
- After a shot you **stay in typing mode**, so you can chain words. Press an arrow to move.
- You **auto-face** your locked target with every correct letter.
- **Enemy HP** decides how many shots it takes (health bar shown above the enemy).
- **Weapon** decides word length and damage (pistol = short words, low damage; sniper = long words, high damage).
- **No reloads.** Your typing speed is your fire rate.
- **Typo** = a wrong letter on your locked word, or a first letter that matches no word. The gun jams briefly (0.5s, `typoJamMs` in `player.js`) and letters typed during the jam are ignored. The lock breaks and progress resets, but the word stays the same so you can retry it.
- **Word refresh:** words change every ~8 to 12 seconds (shorter on Hard, longer on Easy; range in `WORD_REFRESH` in `words.js`), after every hit, and when an enemy leaves and re-enters line of sight. Each target has its own timer, so words don't all change at once.
- **Word lock:** once you type the first