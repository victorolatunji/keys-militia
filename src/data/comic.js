// Earth Respond #0, the comic (COMIC on the main menu). The panels are
// ChatGPT art (public/assets/comic); all lettering is drawn by the game, so
// it stays editable. Each page has three panels: two side by side, one wide
// below. A line is a caption (yellow box) unless it has a speaker (a bubble).
//   at: where the box sits in the panel ('tl' top left, 'tr' top right, 'bl' bottom left)
export const COMIC = {
  title: 'EARTH RESPOND #0',
  cover: 'cover',
  backdrop: 'backdrop',
  pages: [
    {
      title: 'THE SIGNAL',
      panels: [
        { art: 'p1-1', text: 'Day 0. Something beyond the Moon starts to sing.', at: 'tl' },
        { art: 'p1-2', text: 'The dead heard it first.', at: 'tl' },
        { art: 'p1-3', text: 'Then every machine with a chip in it.', at: 'tl' },
      ],
    },
    {
      title: 'THE FALL',
      panels: [
        { art: 'p2-1', text: 'Some soldiers stopped taking orders from anyone but the Signal. They call themselves Black Static.', at: 'tl' },
        { art: 'p2-2', text: 'Radio died. Voice-aim died. Auto-targeting turned on its owners.', at: 'tl' },
        { art: 'p2-3', text: 'By week two, nowhere underground was safe either.', at: 'tl' },
      ],
    },
    {
      title: 'EARTH RESPONDS',
      panels: [
        { art: 'p3-1', speaker: 'SGT. ITUNU', text: 'You made it out of Lakeport, Rookie. Now you learn to fight.', at: 'tr' },
        { art: 'p3-2', speaker: 'ANDROID R', text: "The Signal can't read a typed code. Your keyboard is your trigger.", at: 'tl' },
        { art: 'p3-3', text: 'Earth Respond: every militia that still answers to us.', at: 'tl' },
      ],
    },
    {
      title: 'FIRST CONTACT',
      panels: [
        { art: 'p4-1', speaker: 'KOLAWOLE', text: "Keep typing, Rookie. I've got your six.", at: 'tl' },
        { art: 'p4-2', speaker: 'VICTOR', text: "T-H-U-N-D-E-R... got 'em!", at: 'tr' },
        { art: 'p4-3', text: 'The Signal is getting louder. And somewhere above it, the Hush is listening. Story mode: coming soon.', at: 'bl' },
      ],
    },
  ],
};
