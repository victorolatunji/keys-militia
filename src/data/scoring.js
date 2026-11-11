// Scoring, stats, awards and the local leaderboard (README section 9).

export const SCORING = {
  kill: 100,
  assist: 50,
  death: -25,
  assistWindowMs: 10000,   // you hurt it this recently and someone else finished it: an assist
  minWords: 5,             // Sharpshooter and Fastest Fingers need this many words started
  enemyRows: 6,            // the end screen lists at most this many enemy types
};

// Who gets each award: the best value of `stat` (ties go to you, then your
// partner). `ok` says who can win it at all.
export const AWARDS = [
  { key: 'mvp', name: 'MVP ★', stat: 'score', ok: (e) => e.kills > 0 || e.assists > 0, show: (e) => `${e.score} pts` },
  { key: 'kills', name: 'Most Kills', stat: 'kills', ok: (e) => e.kills > 0, show: (e) => `${e.kills} kills` },
  { key: 'kd', name: 'Best K/D', stat: 'kd', ok: (e) => e.kills > 0, show: (e) => e.kd.toFixed(2) },
  { key: 'sharp', name: 'Sharpshooter', stat: 'accuracy', ok: (e) => e.typing && e.typing.started >= SCORING.minWords, show: (e) => `${Math.round(e.accuracy * 100)}% words` },
  { key: 'fingers', name: 'Fastest Fingers', stat: 'wpm', ok: (e) => e.typing && e.typing.finished >= SCORING.minWords, show: (e) => `${Math.round(e.wpm)} WPM` },
  { key: 'survivor', name: 'Survivor', stat: 'longestLifeMs', ok: (e) => e.longestLifeMs > 0, show: (e) => clock(e.longestLifeMs) },
];

export const LEADERBOARD = {
  storageKey: 'keys-militia.best', // saved in this browser only (online comes with sign-in, Phase 11)
  keep: 5,                         // best results kept per mode and map
};

export function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
