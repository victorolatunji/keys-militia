import Phaser from 'phaser';
import { buttonRow } from '../ui/Button.js';
import { headIcon } from '../ui/ItemArt.js';
import { BOTS } from '../data/enemies.js';
import { pickForMap, GROUND_BOUND } from './EnemySpawner.js';
import { SCORING, clock } from '../data/scoring.js';

const HUD_DEPTH = 105;

// One match of a mode with a goal (src/data/modes.js):
//   timed (You vs Military): a countdown, first to the kill target, respawns
//     until time is up, a difficulty ramp the player isn't told about.
//   waves (Zombies): waves that grow, a breather between them, and a set
//     number of lives (no respawns in Zombies).
// It tunes the enemies that spawn, keeps the score and shows the result.
export default class MatchSystem {
  constructor(scene, mode) {
    this.scene = scene;
    this.mode = mode;
    this.waves = Boolean(mode.waves);
    const now = scene.time.now;
    this.startAt = now;
    this.endsAt = mode.timeMs ? now + mode.timeMs : Infinity;
    this.stageIndex = 0;
    this.pending = 0;
    this.enemyKills = 0;
    this.lives = (mode.respawns ?? Infinity) + 1;
    this.over = false;
    this.result = null;
    // Waves
    this.wave = 0;          // 0-based, the one in progress
    this.toSpawn = 0;
    this.breakUntil = now + 3000; // a moment before the first wave
    this.nextSpawnAt = 0;
    this.makeHud();
    // (the mode's name and goal: the intro pop-up says them, so the banner only shows without it)
    const lifeLine = !this.waves ? '' : mode.respawns ? `Survive the waves · ${mode.respawns} respawns` : 'Survive the waves · no respawns';
    if (scene.skipIntro) this.banner(mode.name, this.waves ? lifeLine : `First to ${mode.killTarget} kills · ${Math.round(mode.timeMs / 60000)} minutes`);
  }

  // The scene was paused for ms (the intro, Esc): every deadline moves back.
  shiftTime(ms) {
    this.startAt += ms;
    this.endsAt += ms;
    if (this.breakUntil) this.breakUntil += ms;
    if (this.nextSpawnAt) this.nextSpawnAt += ms;
  }

  get stage() {
    return this.mode.ramp?.[this.stageIndex];
  }

  get timeLeft() {
    return Math.max(0, this.endsAt - this.scene.time.now);
  }

  get waveConfig() {
    const list = this.mode.waves;
    return list[Math.min(this.wave, list.length - 1)];
  }

  // A tuned copy of an enemy type for the current stage or wave.
  tune(config) {
    if (!config) return config;
    let s = this.stage;
    if (this.waves) {
      const g = this.mode.grow;
      const k = this.wave;
      s = { hp: 1 + g.hp * k, damage: 1 + g.damage * k, reaction: Math.max(0.6, 1 - 0.04 * k), typing: 1 + g.damage * k, aim: 1, speed: 1 + g.speed * k };
    }
    const aim = config.aim ? { ...config.aim, spreadDeg: config.aim.spreadDeg * s.aim, movingTargetDeg: config.aim.movingTargetDeg * s.aim } : config.aim;
    return {
      ...config,
      hp: Math.round(config.hp * s.hp),
      damageScale: (config.damageScale ?? 1) * s.damage,
      dpsScale: s.damage * s.typing,
      reactionMs: Math.round((config.reactionMs ?? 600) * s.reaction),
      typingSpeed: (config.typingSpeed ?? 1.5) * s.typing,
      speedScale: (config.speedScale ?? 1) * (s.speed ?? 1),
      aim,
    };
  }

  // Your death: a kill for them if an enemy did it. Out of lives: game over.
  onPlayerDeath(cause, attacker) {
    if (this.over) return;
    if (cause === 'bot' || attacker) this.enemyKills += 1;
    this.lives -= 1;
    if (this.lives <= 0) this.scene.time.delayedCall(900, () => this.end('over'));
  }

  // Waves: an enemy down (no respawn; the wave sends the next one).
  onBotDeath() {}

  update() {
    if (this.over) return;
    if (this.waves) this.updateWaves();
    else this.updateTimed();
    this.drawHud();
  }

  updateTimed() {
    const scene = this.scene;
    const now = scene.time.now;
    const next = this.mode.ramp[this.stageIndex + 1];
    if (next && now - this.startAt >= next.atMs) this.startStage(this.stageIndex + 1);

    const target = this.mode.killTarget;
    if (scene.kills >= target) this.end('win');
    else if (this.enemyKills >= target) this.end('lose');
    else if (now >= this.endsAt) this.end(scene.kills > this.enemyKills ? 'win' : scene.kills < this.enemyKills ? 'lose' : 'draw');
  }

  // A new stage (the player isn't told: it just gets harder).
  startStage(index) {
    const scene = this.scene;
    this.stageIndex = index;
    const s = this.stage;
    scene.spawner.allowed = s.types;
    scene.botCombat.maxTurns = s.turns;
    if (scene.airdrops) scene.airdrops.difficulty = s.drops;
    const extra = s.bots - scene.bots.length - this.pending;
    for (let i = 0; i < extra; i++) {
      this.pending += 1;
      scene.time.delayedCall(this.mode.calmMs + i * 1500, () => {
        this.pending -= 1;
        if (!this.over) scene.bots.push(scene.spawnBot('main'));
      });
    }
  }

  updateWaves() {
    const scene = this.scene;
    const now = scene.time.now;
    const alive = scene.bots.filter((b) => b.alive).length;
    if (this.breakUntil) {
      if (now < this.breakUntil) return;
      this.breakUntil = 0;
      this.toSpawn = this.waveConfig.count;
      const level = Math.min(1, this.wave / 6);
      if (scene.airdrops) scene.airdrops.difficulty = level;
      scene.botCombat.maxTurns = Math.min(4, 2 + Math.floor(this.wave / 2));
    }
    if (this.toSpawn > 0 && alive < this.waveConfig.atOnce && now >= this.nextSpawnAt) {
      this.spawnWaveEnemy();
      this.toSpawn -= 1;
      this.nextSpawnAt = now + 900;
    }
    if (this.toSpawn === 0 && alive === 0 && !this.breakUntil) {
      this.wave += 1; // cleared: a breather, then the next one
      this.breakUntil = now + this.mode.breakMs;
    }
  }

  spawnWaveEnemy() {
    const scene = this.scene;
    // The wave's types that fit this map, the map's own families more often.
    const shooterOut = scene.bots.some((b) => b.alive && !GROUND_BOUND(b.config));
    const key = pickForMap(this.waveConfig.types, scene.map, !shooterOut);
    const config = this.tune(BOTS[key]);
    // Reuse a fallen one (cheaper than a new body), else a new enemy.
    const free = scene.bots.find((b) => !b.alive && b.slot === config.role);
    if (free) free.respawn(scene.botSpawnPoint(config), config);
    else scene.bots.push(scene.spawnBot(config.role, config));
  }

  end(result) {
    if (this.over) return;
    const scene = this.scene;
    this.over = true;
    this.result = result;
    scene.matchOver = true;
    scene.physics.world.pause();
    scene.message?.setVisible(false);
    this.drawHud();
    this.showResults(result);
  }

  // The end-of-match screen: result, scoreboard, your typing, awards and
  // your best results on this mode and map (README section 9).
  showResults(result) {
    const scene = this.scene;
    const { rows, awards, you, timeMs } = scene.stats.summary();
    const waves = this.waves ? this.wave : null;
    const { list, rank } = scene.stats.save(this.mode.key, scene.map.key, {
      score: you.score, kills: you.kills, deaths: you.deaths, kd: Number(you.kd.toFixed(2)),
      wpm: Math.round(you.wpm), accuracy: Math.round(you.accuracy * 100), waves, result,
      ally: scene.partner?.config.name ?? null, at: new Date().toISOString().slice(0, 10),
    });

    scene.debugText?.setVisible(false); // the testing readout
    const depth = HUD_DEPTH + 5;
    const objects = [];
    const font = (size, color, extra = {}) => ({ fontFamily: 'monospace', fontSize: `${size}px`, color, ...extra });
    const text = (x, y, str, style, originX = 0) => {
      const t = scene.add.text(x, y, str, style).setOrigin(originX, 0).setScrollFactor(0).setDepth(depth + 1);
      objects.push(t);
      return t;
    };
    objects.push(scene.add.rectangle(640, 360, 1180, 690, 0x05070d, 0.96).setStrokeStyle(2, 0x2a3345).setScrollFactor(0).setDepth(depth));

    // Result
    const title = { win: 'VICTORY', lose: 'DEFEAT', draw: 'DRAW', over: 'GAME OVER' }[result];
    const color = { win: '#06d6a0', lose: '#ff4d6d', draw: '#ffd166', over: '#ff4d6d' }[result];
    text(640, 26, title, font(46, color, { fontStyle: 'bold' }), 0.5);
    const score = this.waves ? `Waves survived ${waves}` : `You ${scene.kills}  :  ${this.enemyKills} Military`;
    const team = scene.partner ? `Duo with ${scene.partner.castName ?? scene.partner.config.name}` : 'Solo';
    text(640, 82, `${this.mode.name} · ${scene.map.name} · ${team} · ${clock(timeMs)}   ·   ${score}`, font(17, '#c9d1e0'), 0.5);

    // Scoreboard
    const cols = [['', 24], ['SCORE', 7], ['K', 5], ['D', 5], ['A', 5], ['K/D', 7], ['STREAK', 8], ['DAMAGE', 8], ['LIFE', 6]];
    const line = (cells) => cells.map((c, i) => (i === 0 ? String(c).padEnd(cols[i][1]) : String(c).padStart(cols[i][1]))).join('');
    const left = 640 - 37 * 10.2;
    let y = 122;
    text(left, y, line(cols.map((c) => c[0])), font(17, '#7d879c'));
    y += 26;
    const enemies = rows.filter((r) => r.team === 'enemy').slice(0, SCORING.enemyRows);
    const shown = rows.filter((r) => r.team !== 'enemy' || enemies.includes(r));
    for (const r of shown) {
      const name = r.team === 'enemy' ? `${r.name} ×${r.count}` : r.name;
      const rowColor = { you: '#ffd166', ally: '#06d6a0', enemy: '#ff8fa3' }[r.team];
      const icon = headIcon(scene, r.folder, left - 18, y + 10, 26);
      if (icon) objects.push(icon.setScrollFactor(0).setDepth(depth + 1));
      text(left, y, line([name, r.score, r.kills, r.deaths, r.assists, r.kd.toFixed(2), r.bestStreak, Math.round(r.damageDealt), clock(r.longestLifeMs)]), font(17, rowColor));
      y += 28;
    }

    // Your typing
    y += 10;
    const t = you.typing;
    text(640, y, `Your typing   accuracy ${Math.round(you.accuracy * 100)}% (${t.finished} of ${t.started} words)   ·   ${Math.round(you.wpm)} WPM   ·   ${you.typos} typos   ·   ${Math.round(you.damageTaken)} damage taken`, font(16, '#ffffff'), 0.5);

    // Awards (left) and your best results here (right)
    y += 40;
    const colA = 110;
    const colB = 660;
    text(colA, y, 'AWARDS', font(18, '#ffd166', { fontStyle: 'bold' }));
    text(colB, y, `YOUR BEST · ${this.mode.name} on ${scene.map.name}`, font(18, '#ffd166', { fontStyle: 'bold' }));
    let ay = y + 30;
    for (const a of awards) {
      const who = a.winner.name;
      const c = { you: '#ffd166', ally: '#06d6a0', enemy: '#ff8fa3' }[a.winner.team];
      text(colA, ay, a.name.padEnd(17), font(16, '#c9d1e0'));
      const icon = headIcon(scene, a.winner.folder, colA + 186, ay + 9, 22);
      if (icon) objects.push(icon.setScrollFactor(0).setDepth(depth + 1));
      text(colA + (icon ? 202 : 175), ay, `${who}  (${a.text})`, font(16, c));
      ay += 24;
    }
    if (!awards.length) text(colA, ay, 'none this time', font(16, '#7d879c'));
    let by = y + 30;
    list.forEach((e, i) => {
      const mine = i === rank;
      const what = e.waves != null ? `wave ${e.waves}` : `${e.kills}K ${e.deaths}D`;
      const day = new Date(`${e.at}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const str = `${i + 1}. ${String(e.score).padStart(5)} pts  ${what.padEnd(9)} ${String(e.wpm).padStart(3)} WPM  ${day.padEnd(6)}${mine ? ' ◀ now' : ''}`;
      text(colB, by, str, font(16, mine ? '#ffffff' : '#9aa3b5', mine ? { fontStyle: 'bold' } : {}));
      by += 24;
    });
    if (rank === 0 && list.length > 1) text(colB, by + 4, 'NEW BEST!', font(18, '#06d6a0', { fontStyle: 'bold' }));
    else if (rank === -1) text(colB, by + 4, `This match: ${you.score} pts (not in your top ${list.length})`, font(15, '#7d879c'));

    // What next: click, or press the key.
    objects.push(...buttonRow(scene, 640, 672, [
      ['PLAY AGAIN', () => scene.scene.restart({ mapKey: scene.map.key, modeKey: this.mode.key, replay: true }), 'R'],
      ['LOBBY', () => scene.toLobby(), 'L'],
      ['MAIN MENU', () => scene.toMenu(), 'M'],
    ], { fixed: true, depth: depth + 2, size: 17 }));
    this.endObjects = objects;
  }

  // ---- On screen ----

  makeHud() {
    const scene = this.scene;
    const style = { fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 12, y: 4 } };
    this.timerText = scene.add.text(640, 14, '', { ...style, fontSize: '26px' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(HUD_DEPTH);
    this.scoreText = scene.add.text(640, 54, '', { ...style, fontSize: '18px' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(HUD_DEPTH);
  }

  drawHud() {
    const scene = this.scene;
    if (this.waves) {
      const alive = scene.bots.filter((b) => b.alive).length;
      this.timerText.setText(`WAVE ${this.wave + 1}`);
      this.timerText.setColor('#ffffff');
      const breakLeft = this.breakUntil ? Math.ceil((this.breakUntil - scene.time.now) / 1000) : 0;
      const lives = this.mode.respawns ? `   ·   respawns ${Math.max(0, this.lives - 1)}` : '';
      this.scoreText.setText((breakLeft > 0 ? `Next wave in ${breakLeft}` : `${alive + this.toSpawn} left`) + `   ·   kills ${scene.kills}${lives}`);
      return;
    }
    const left = this.timeLeft;
    this.timerText.setText(this.clock(left));
    this.timerText.setColor(left < 60000 && !this.over ? '#ff4d6d' : '#ffffff');
    this.scoreText.setText(`YOU ${scene.kills}  :  ${this.enemyKills} MILITARY   ·   first to ${this.mode.killTarget}`);
  }

  clock(ms) {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // A big title with a line under it (only when the match starts).
  banner(title, line) {
    const scene = this.scene;
    const t = scene.add.text(640, 200, title, { fontFamily: 'monospace', fontSize: '40px', color: '#ffd166', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);
    const l = scene.add.text(640, 248, line, { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);
    scene.tweens.add({ targets: [t, l], alpha: 0, delay: 2600, duration: 700, onComplete: () => { t.destroy(); l.destroy(); } });
  }
}
