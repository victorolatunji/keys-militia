// The menus' colours, from the ChatGPT UI style sheet
// (assets-src/chatgpt-pack, ui-style-sheet.png), so text matches the scenes.
//   headings: bone · normal text: ash · dim: dusk slate · highlight: ember · danger: rust
// Fonts: monospace for now. The style sheet recommends Black Ops One
// (headings) and IBM Plex Mono (body), both free (SIL Open Font License);
// they go in FONT once they're added to the project.
export const THEME = {
  ink: 0x0d1114, gunmetal: 0x30353b, slate: 0x4d5967, ash: 0xa49d95, bone: 0xdcd1bf, olive: 0x5d633f, ember: 0xd2a35f, rust: 0xa05d4c,
  css: {
    ink: '#0d1114', gunmetal: '#30353b', slate: '#4d5967', ash: '#a49d95', bone: '#dcd1bf', olive: '#5d633f', ember: '#d2a35f', rust: '#a05d4c',
  },
  font: { heading: 'monospace', body: 'monospace' },
};
