// Clean, family-friendly word lists. Lowercase letters only.
// Each weapon picks a list by length (wordList in weapons.js):
//   short (3-4 letters): pistols, SMGs, shotguns, LMGs, most melee
//   medium (5-6): assault rifles, heavy melee
//   long (7-8): marksman rifles
//   extraLong (9+): sniper
// Lists cover many first letters, since no two words on screen share one.
export const WORDS = {
  short: [
    'ant', 'arm', 'bag', 'bell', 'bus', 'cake', 'cat', 'cup', 'den', 'dog',
    'duck', 'egg', 'elf', 'fan', 'fish', 'fox', 'gem', 'goat', 'gum', 'hat',
    'hill', 'hook', 'ice', 'ink', 'iron', 'jam', 'jar', 'jet', 'key', 'kit',
    'kite', 'lamp', 'leaf', 'log', 'map', 'milk', 'moon', 'nest', 'net', 'nut',
    'oak', 'oven', 'owl', 'pear', 'pen', 'pig', 'quiz', 'rain', 'ring', 'rug',
    'sock', 'star', 'sun', 'tent', 'top', 'tree', 'unit', 'urn', 'van', 'vase',
    'vest', 'web', 'wind', 'wolf', 'yak', 'yarn', 'zip', 'zoo',
  ],
  medium: [
    'anchor', 'apple', 'basket', 'bread', 'bridge', 'candy', 'castle', 'cloud',
    'dance', 'desert', 'dragon', 'eagle', 'earth', 'engine', 'flame', 'forest',
    'frost', 'garden', 'ghost', 'grape', 'hammer', 'honey', 'horse', 'igloo',
    'island', 'jacket', 'jelly', 'jungle', 'karate', 'kitten', 'koala', 'ladder',
    'laser', 'lemon', 'magnet', 'mango', 'metal', 'needle', 'ninja', 'nurse',
    'ocean', 'orange', 'orbit', 'pencil', 'piano', 'pirate', 'queen', 'quest',
    'rabbit', 'river', 'robot', 'rocket', 'silver', 'snake', 'storm', 'tiger',
    'train', 'turtle', 'uncle', 'unity', 'valley', 'violin', 'viper', 'whale',
    'window', 'wizard', 'yacht', 'yellow', 'yogurt', 'zebra', 'zipper',
  ],
  long: [
    'airplane', 'backpack', 'blizzard', 'calendar', 'campfire', 'compass',
    'diamond', 'dinosaur', 'dolphin', 'elephant', 'emerald', 'feather',
    'fortress', 'giraffe', 'harmony', 'hedgehog', 'iceberg', 'journey',
    'kangaroo', 'keyboard', 'kingdom', 'lantern', 'library', 'magician',
    'mountain', 'necklace', 'notebook', 'octopus', 'orchard', 'panther',
    'penguin', 'pyramid', 'quantum', 'question', 'raccoon', 'rainbow',
    'sandwich', 'sapphire', 'tornado', 'treasure', 'trumpet', 'umbrella',
    'unicorn', 'vanilla', 'volcano', 'warrior', 'whistle', 'zeppelin',
  ],
  extraLong: [
    'adventure', 'astronaut', 'binoculars', 'blueberry', 'butterfly',
    'cathedral', 'chocolate', 'crocodile', 'dandelion', 'detective',
    'dragonfly', 'fireplace', 'fireworks', 'gladiator', 'grasshopper',
    'hamburger', 'hurricane', 'invisible', 'jellyfish', 'lighthouse',
    'lightning', 'marshmallow', 'nightingale', 'orchestra', 'parachute',
    'pineapple', 'quicksand', 'raspberry', 'saxophone', 'skateboard',
    'telescope', 'trampoline', 'underwater', 'volleyball', 'waterfall',
    'watermelon', 'xylophone', 'yesterday', 'zookeeper',
  ],
};

// Unlocked words change after a random time in this range.
// Difficulty will scale it in Phase 9 (shorter on Hard, longer on Easy).
export const WORD_REFRESH = {
  minMs: 8000,
  maxMs: 12000,
};