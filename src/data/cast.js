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
export const CAST = [
  { key: 'player', bot: null, type: 'Hero', name: 'Victor', callsign: 'Rookie', weapon: 'm4', partner: false,
    story: 'A 19-year-old courier who fought his way out of Lakeport with a borrowed rifle and a cracked keyboard. Fast fingers, no training, zero quit.' },
  { key: 'commando', bot: 'commando', type: 'Commando', name: 'Sgt. Itunu', weapon: 'ak117', partner: true,
    story: 'Thirty years in uniform; he was there the day his own unit went silent. He runs the Militia Camp and trains every rookie who makes it in.' },
  { key: 'android', bot: 'android', type: 'Android', name: 'Android R', weapon: 'laser', partner: true,
    story: 'A field-repair android that pulled its own Signal chip out with a screwdriver. It wrote the typed lock-codes that keep the militias\' guns their own.' },
  { key: 'soldier', bot: 'soldier', type: 'Soldier', name: 'Kolawole', callsign: 'Elite', weapon: 'ak47', partner: true,
    story: 'The last of an elite recon squad. He doesn\'t talk about the others. He walks wherever you walk and never misses twice.' },
  { key: 'mercenary', bot: 'mercenary', type: 'Mercenary', name: 'Mirembe', callsign: 'Vix', weapon: 'arctic50', partner: true,
    story: 'A sniper-for-hire who switched sides when Black Static stopped paying in anything but orders. Works for food, ammo and payback.' },
  { key: 'trooper', bot: 'armouredTrooper', type: 'Armoured Trooper', name: 'Keseki', callsign: 'Bulwark', weapon: 'pkm', partner: true,
    story: 'A riot-squad veteran in salvaged heavy armour. Slow to anger and slower to fall.' },
  { key: 'zombie', bot: 'zombie', type: 'Zombie', name: 'Rufiu', partner: true,
    story: 'Turned on Day 0 but woke up still himself, thanks to Android R\'s dampener. He doesn\'t remember his surname, just how to hit hard.' },
  { key: 'skeleton', bot: 'skeleton', type: 'Skeleton', name: 'Arije', partner: true,
    story: 'Nobody knows who he was. He walked out of the Catacombs on day three and has followed the militia ever since.' },
  { key: 'infected', bot: 'infectedSoldier', type: 'Infected Soldier', name: 'Igedunola', callsign: 'Blight', weapon: 'm13', partner: true,
    story: 'Infected on a rescue run, holding on with every dose she can find. She fights like she\'s on borrowed time, because she is.' },
  { key: 'robot', bot: 'robot', type: 'Robot', name: 'Bopoto', callsign: 'T-9', weapon: 'chopper', partner: true,
    story: 'A construction robot rewired by Android R, who gave her a name and a voice. She still beeps "caution" before every shot.' },
  { key: 'alien', bot: 'alien', type: 'Alien', name: 'Mtumbe', weapon: 'laser', partner: true,
    story: 'A scout from the Hush, the fleet behind the Signal. She heard what it was doing and refused. Earth\'s only friend from beyond the Moon.' },
  { key: 'cyborg', bot: 'cyborg', type: 'Cyborg', name: 'Black Cyba', weapon: 'oden', partner: true,
    story: 'Half his nervous system is hardware, and the Signal can\'t touch the half that\'s left. The ex-security engineer who cracked the first Signal-proof firing code.' },
  { key: 'mutant', bot: 'mutant', type: 'Mutant', name: 'Obonachocho', partner: true,
    story: 'A gentle farmhand the Wastelands\' fallout grew to twice his size. Hates loud noises, and makes a lot of them.' },
  { key: 'drone', bot: 'drone', type: 'Drone', name: 'Kixon', weapon: 'mac10', partner: false,
    story: 'Black Static\'s lead hunter drone, until Android R reprogrammed him. He still marks his prey with a red light before he strikes.' },
  { key: 'scrapbot', bot: 'scrapBot', type: 'Scrap Bot', name: 'Junker', partner: false,
    story: 'Black Static welds these walking bombs together from wrecks. This one forgot how to explode and decided it likes people.' },
  { key: 'k9', bot: 'zombieK9', type: 'Zombie K9', name: 'Rex', partner: false,
    story: 'An army dog turned on Day 0. Packs of them hunt the tunnels; this one follows Victor home every night anyway.' },
];

export const castOf = (key) => CAST.find((c) => c.key === key);
export const castOfBot = (botKey) => CAST.find((c) => c.bot === botKey);
// Its display name: Name "Callsign" (or just the name).
export const fullName = (c) => (c.callsign ? `${c.name} "${c.callsign}"` : c.name);
