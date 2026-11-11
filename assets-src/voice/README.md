# Keys Militia: Training voice lines

Voice lines for the two Training coaches. Each line plays along with its speech bubble (the text in `src/data/training.js`). Put the finished files in this folder (`assets-src/voice/`).

## File format

- **MP3**, mono, 44.1 kHz, 128 kbps (plays in every browser, Safari included).
- **One line per file**, named exactly as in the tables (lowercase, no spaces).
- Trim the silence at the start and end.
- Keep every file about equally loud, with no clipping (peaks around −1 dB).
- If your tool gives WAV, keep it as the master and upload the MP3.
- Later sounds (cries, menu music, the in-game sting) use the same format. Music: a seamless loop for the menu, and a short 5–10 s sting for the start of a match that ends cleanly.

## The coaches

| Coach | Character | Voice |
|---|---|---|
| **Sergeant** | Commando | Firm drill sergeant: gruff, loud and short, but encouraging. |
| **Android R** | Android | Calm and precise, slightly synthetic. Speaks evenly, never rushed. |

## Lines (31 files)

### Lesson 1: Move
| File | Coach | Line |
|---|---|---|
| sarge_move_1.mp3 | Sergeant | Welcome to the camp, recruit. Let's see you move. |
| sarge_move_2.mp3 | Sergeant | Left and Right arrows. Run to the flag. |
| sarge_move_good.mp3 | Sergeant | Good. You can run. Now fly. |

### Lesson 2: Fly
| File | Coach | Line |
|---|---|---|
| sarge_fly_1.mp3 | Sergeant | Hold Up to fire your jetpack. |
| sarge_fly_2.mp3 | Sergeant | Land on top of the watchtower. Fuel only refills on the ground. |
| sarge_fly_3.mp3 | Sergeant | Down drops you faster. |
| sarge_fly_good.mp3 | Sergeant | Nice landing. Come down. Android R takes it from here. |

### Lesson 3: Type to shoot
| File | Coach | Line |
|---|---|---|
| tech_type_1.mp3 | Android R | Your keyboard is your trigger. |
| tech_type_2.mp3 | Android R | Every target you can see gets a word. Type it to shoot. |
| tech_type_3.mp3 | Android R | The first letter locks on. Take down all three. |
| tech_type_good.mp3 | Android R | Clean. Now, about mistakes. |

### Lesson 4: Typos and moving
| File | Coach | Line |
|---|---|---|
| tech_typos_1.mp3 | Android R | A wrong letter jams your gun for a moment. Stay accurate. |
| tech_typos_2.mp3 | Android R | While you type you stand still. Any arrow moves you again. |
| tech_typos_3.mp3 | Android R | Your half-typed word waits for you. Two more targets. |
| tech_typos_good.mp3 | Android R | Good hands. The sergeant wants you up close. |

### Lesson 5: Switch weapons
| File | Coach | Line |
|---|---|---|
| sarge_melee_1.mp3 | Sergeant | Shift switches weapon: gun one, gun two, then melee. |
| sarge_melee_2.mp3 | Sergeant | Melee words only show up close. Get in there. |
| sarge_melee_3.mp3 | Sergeant | Take that target down with your melee weapon. |
| sarge_melee_retry.mp3 | Sergeant | With your melee weapon, recruit. Shift until you hold it. |
| sarge_melee_good.mp3 | Sergeant | That's how it's done. Now throw something. |

`sarge_melee_retry` plays only if the target is taken down with a gun instead of melee.

### Lesson 6: Throw
| File | Coach | Line |
|---|---|---|
| sarge_throw_1.mp3 | Sergeant | That target hides behind the sandbags. Bullets won't reach it. |
| sarge_throw_2.mp3 | Sergeant | Hold the left mouse button, point past the wall, let go. |
| sarge_throw_3.mp3 | Sergeant | Or hold Space, aim with Up and Down, release. Tab switches throwable. |
| sarge_throw_good.mp3 | Sergeant | Boom. Supplies are coming in. |

### Lesson 7: Airdrop
| File | Coach | Line |
|---|---|---|
| tech_airdrop_1.mp3 | Android R | Crates drop from the sky during a fight. One's coming in now. |
| tech_airdrop_2.mp3 | Android R | Walk up to it. Each gun inside has a number: press it to take that gun. |
| tech_airdrop_3.mp3 | Android R | It goes straight to your hand. |
| tech_airdrop_good.mp3 | Android R | Locked and loaded. Last test, recruit. |

### Lesson 8: Live fire
| File | Coach | Line |
|---|---|---|
| sarge_fight_1.mp3 | Sergeant | Two hostiles are dropping into the yard. They shoot back. |
| sarge_fight_2.mp3 | Sergeant | Use everything you learned. Take them down. |
| sarge_fight_good.mp3 | Sergeant | Yard's clear. You're ready, soldier. |

## Notes

- Read "gun one, gun two" as words (the bubble shows "gun 1, gun 2").
- If a line changes in `src/data/training.js`, re-record that file under the same name.
- The coaches will get story names later (story: Earth Respond); the file names stay the same.
