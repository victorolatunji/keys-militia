import Phaser from 'phaser';
import { BOTS } from '../data/enemies.js';

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
    const lifeLine = !this.waves ? '' : mode.respawns ? `Survive the waves · ${mode.respawns} respawns` : 'Survive the waves · no respawns';
    this.banner(mode.name, this.waves ? lifeLine : `First to ${mode.killTarget} kills · ${Math.round(mode.timeMs / 60000)} minutes`);
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
    const key = Phaser.Utils.Array.GetRandom(this.waveConfig.types);
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
    const kd = scene.kills / Math.max(1, scene.deaths);
    const time = this.clock(scene.time.now - this.startAt);
    const title = { win: 'VICTORY', lose: 'DEFEAT', draw: 'DRAW', over: 'GAME OVER' }[result];
    const color = { win: '#06d6a0', lose: '#ff4d6d', draw: '#ffd166', over: '#ff4d6d' }[result];
    const lines = this.waves
      ? [`Waves survived ${this.wave}`, '', `Kills ${scene.kills}   Deaths ${scene.deaths}   K/D ${kd.toFixed(2)}`, `Time ${time}`]
      : [`You ${scene.kills}  :  ${this.enemyKills} Military`, '', `Kills ${scene.kills}   Deaths ${scene.deaths}   K/D ${kd.toFixed(2)}`, `Time ${time}`];
    if (scene.partner) lines.push(`Ally ${scene.partner.config.name}: ${scene.partner.kills} kills (its own)`);
    lines.push('', 'R: play again    F8: mode    F6: map    `: partner');
    const cx = 640;
    this.endBg = scene.add.rectangle(cx, 330, 640, 300, 0x000000, 0.78).setScrollFactor(0).setDepth(HUD_DEPTH + 5);
    this.endTitle = scene.add.text(cx, 220, title, { fontFamily: 'monospace', fontSize: '54px', color, fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 6);
    this.endText = scene.add.text(cx, 360, lines.join('\n'), { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 6);
    this.drawHud();
    scene.input.keyboard.once('keydown-R', () => scene.scene.restart({ mapKey: scene.map.key, modeKey: this.mode.key }));
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
