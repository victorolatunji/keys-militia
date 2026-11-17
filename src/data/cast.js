// The cast (offline version): every character's name and short backstory.
// Shown in the lobby only, behind each character card's (i) button, and on
// your partner's ALLY tag and the end screen. In a match YOU are always
// tagged ROOKIE, whoever you pick. Enemies keep their type name (Soldier,
// Zombie...): they're the many; the cast are the few who kept their minds.
// Story: the Signal (sent by the alien fleet called the Hush) woke the dead
// and turned the machines; Black Static is the rogue militia that follows it;
// Earth Respond is every militia that still fights back.
//
// key: the sprite folder (also the lobby order). bot: its BOTS key (null for
// the hero). partner: can fight beside you as your Duo partner.
// playable: false: can't be picked as YOUR character either (the Drone and
// the Zombie K9 aren't people: they're in the cast and the lobby to read
// about, and they fight as enemies).
export const CAST = [
  { key: 'player', bot: null, type: 'Hero', name: 'Victor', callsign: 'Rookie', weapon: 'm4', partner: false,
    story: 'A 19-year-old courier from Lakeport who ran deliveries on a cracked keyboard. On Day 0 he typed his way through a jammed armoury lock and walked out with a rifle. No training, the fastest fingers in the camp, and he never quits a fight he started.' },
  { key: 'commando', bot: 'commando', type: 'Commando', name: 'Sgt. Itunu', weapon: 'ak117', partner: true,
    story: 'Thirty years in uniform. On Day 0 his own unit went silent and turned their guns on him; he was the only one who didn\'t answer the Signal. Now he runs the Militia Camp, trains every rookie who makes it in, and remembers every name.' },
  { key: 'android', bot: 'android', type: 'Android', name: 'Keseki', weapon: 'laser', partner: true,
    story: 'A field-repair android that felt the Signal in its chip and pulled the chip out with a screwdriver. It wrote the typed lock-codes that keep the militias\' guns their own. Patient, precise and a little too honest, it can fix anything, even your aim.' },
  { key: 'soldier', bot: 'soldier', type: 'Soldier', name: 'Kolawole', callsign: 'Elite', weapon: 'ak47', partner: true,
    story: 'The last of an elite recon squad that went into Lakeport on Day 0 and never came out. He doesn\'t talk about the others. Silent and steady, he never misses twice, and he walks wherever you walk.' },
  { key: 'mercenary', bot: 'mercenary', type: 'Mercenary', name: 'Nadia', callsign: 'Vix', weapon: 'arctic50', partner: true,
    story: 'A sniper-for-hire who sold her rifle to Black Static until they stopped paying in anything but orders. She shot her way out the night she quit. She can lie still on a rooftop for hours, and works for food, ammo and payback, in that order.' },
  { key: 'trooper', bot: 'armouredTrooper', type: 'Armoured Trooper', name: 'Dmitri', callsign: 'Kixon', weapon: 'pkm', partner: true,
    story: 'A riot-squad veteran who held the Lakeport bridge alone for three days, wrapped in salvaged armour. Slow to anger and slower to fall. Where Dmitri stands, the line holds.' },
  { key: 'zombie', bot: 'zombie', type: 'Zombie', name: 'Mort', partner: true,
    story: 'Died on Day 0 and woke up still himself, thanks to the dampener Keseki bolted behind his ear. He\'s forgotten his surname but not how to hit. Hungry, loyal and a little sad, he guards the living like he\'s still one of them.' },
  { key: 'skeleton', bot: 'skeleton', type: 'Skeleton', name: 'Hollow', partner: true,
    story: 'Nobody knows who he was. On day three he walked out of the Catacombs in the rags of an old masquerade, and the Signal slid right off his bones. He never speaks, never tires, and is always the last one standing in a tunnel.' },
  { key: 'infected', bot: 'infectedSoldier', type: 'Infected Soldier', name: 'Lazara', callsign: 'Blight', weapon: 'm13', partner: true,
    story: 'A medic infected on a rescue run, holding the turn back with every dose she can find. The camp named her Lazara, after the one who came back. She fights like she\'s on borrowed time, because she is.' },
  { key: 'robot', bot: 'robot', type: 'Robot', name: 'Ferra', callsign: 'T-9', weapon: 'chopper', partner: true,
    story: 'A construction robot rewired by Keseki, who gave her a name and a voice. Built to lift steel, she now carries a chaingun like a toolbox. Iron to the core, she still beeps "caution" before every shot.' },
  { key: 'alien', bot: 'alien', type: 'Alien', name: 'Selene', weapon: 'laser', partner: true,
    story: 'A scout from the Hush, the fleet behind the Signal. She heard what its song does to Earth and switched her own off. Earth\'s only friend from beyond the Moon, she can feel the Signal\'s next move before it comes.' },
  { key: 'cyborg', bot: 'cyborg', type: 'Cyborg', name: 'Black Cyba', weapon: 'oden', partner: true,
    story: 'Half his nervous system is hardware, and the Signal can\'t touch the half that\'s left. The ex-security engineer cracked the first Signal-proof firing code, and now he hunts the people who wrote the old ones.' },
  { key: 'mutant', bot: 'mutant', type: 'Mutant', name: 'Obaraka', partner: true,
    story: 'A gentle farmhand the Wastelands\' fallout grew to twice his size. He can lift a truck but is scared of thunder. He hates loud noises, and makes a lot of them.' },
  { key: 'drone', bot: 'drone', type: 'Drone', name: 'Talon', weapon: 'mac10', partner: false, playable: false,
    story: 'Black Static\'s lead hunter drone, until Keseki caught him and rewrote his mind. He still marks his prey with a red light before he strikes; now he only hunts the ones who built him.' },
  { key: 'scrapbot', bot: 'scrapBot', type: 'Scrap Bot', name: 'Rusty', partner: false,
    story: 'Black Static welds these walking bombs together from wrecks. This one\'s fuse never lit. It wandered into camp, decided it likes people, and follows anyone holding a wrench.' },
  { key: 'k9', bot: 'zombieK9', type: 'Zombie K9', name: 'Rex', partner: false, playable: false,
    story: 'An army dog turned on Day 0. Packs of them hunt the tunnels. This one still follows Victor home every night, and nobody has the heart to stop him.' },
];

export const castOf = (key) => CAST.find((c) => c.key === key);
export const castOfBot = (botKey) => CAST.find((c) => c.bot === botKey);
// Its display name: Name "Callsign" (or just the name).
export const fullName = (c) => (c.callsign ? `${c.name} "${c.callsign}"` : c.name);

// Can this character be picked for this lobby slot ('you' or 'partner')?
export const canPick = (c, slot) => (slot === 'partner' ? Boolean(c.partner) : c.playable !== false);
