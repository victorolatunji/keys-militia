// Which site this build is for. `npm run build` makes the normal web build
// (itch.io); `npm run build:crazygames` sets Vite's mode to 'crazygames'.
// Platform rules live behind these flags so the normal game never changes.
//   CrazyGames: no in-game fullscreen buttons (the site has its own),
//   PEGI 12 (gore up to "cartoon", no "full" level), no text selection.
export const PLATFORM = import.meta.env.MODE === 'crazygames' ? 'crazygames' : 'web';
export const CRAZYGAMES = PLATFORM === 'crazygames';
