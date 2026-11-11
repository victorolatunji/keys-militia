import Phaser from 'phaser';
import Bot from '../entities/Bot.js';
import Dummy from '../entities/Dummy.js';
import SpeechBubble from '../ui/SpeechBubble.js';
import { BOTS, ENEMIES } from '../data/enemies.js';
import { TRAINING } from '../data/training.js';
import { clock } from '../data/scoring.js';

const HUD_DEPTH = 105;
const COACH_COLORS = { sarge: '#2d6a4f', tech: '#3a0ca3' };

// Training: runs the lessons in src/data/training.js on the Militia Camp
// map, one after another. Each lesson: the coaches walk to its station and
// talk (speech bubbles), the hint bar shows the keys, it sets up what the
// lesson needs (targets, a crate, two easy enemies), checks every frame
// whether you've done it, then the coach says so and the next gate opens.
// You can't fail: going down puts you back at the current station.
// Enter skips a lesson, Esc leaves for Free play.
export default class TrainingSystem {
  constructor(scene) {
    this.scene = scene;
    this.startAt = scene.time.now;
    const objects = scene.tilemap.getObjectLayer('training')?.objects ?? [];
    this.points = (name) => objects.filter((o) => o.name === name);
    this.spot = (name) => this.points(name)[0];
    this.groundY = this.spot('move').y;
    this.index = -1;
    this.targets = [];
    this.enemies = [];
    this.crate = null;
    this.queue = [];
    this.waitMs = 0;    // the current line stays up this much longer (counted once it's typed out)
    this.speaker = null;
    this.done = false;
    this.over = false;

    this.makeGates(objects.filter((o) => o.name === 'gate').sort((a, b) => a.x - b.x));
    this.makeCoaches();
    this.makeHud();
    scene.airdrops.paused = true; // no crates on a timer here: lesson 7 brings one
    scene.debugText?.setVisible(false);

    const keys = scene.input.keyboard;
    keys.on('keydown-ENTER', this.skip, this);
    keys.on('keydown-ESC', this.leave, this);
    scene.events.once('shutdown', () => {
      keys.off('keydown-ENTER', this.skip, this);
      keys.off('keydown-ESC', this.leave, this);
    });
    this.start(0);
  }

  get lesson() {
    return TRAINING.lessons[this.index];
  }

  // ---- Lessons ----

  start(i) {
    const scene = this.scene;
    this.index = i;
    this.done = false;
    const lesson = this.lesson;
    const spot = this.spot(lesson.key);
    // Going down puts you back here.
    scene.player.spawnPoint = { x: spot.x - 100, y: this.groundY - 40 };
    // The coaches walk over: the one who talks stands at the spot.
    const speaker = lesson.lines[0][0];
    for (const [who, coach] of Object.entries(this.coaches)) coach.goalX = who === speaker ? spot.x : spot.x + (who === 'sarge' ? 90 : -90);
    this.queue = lesson.lines.slice();
    this.speaker = null;
    this.waitMs = 0;
    this.title.setText(`TRAINING  ·  LESSON ${i + 1}/${TRAINING.lessons.length}  ·  ${lesson.title.toUpperCase()}`);
    this.hint.setText(lesson.keys);
    this.setup(lesson);
  }

  setup(lesson) {
    const scene = this.scene;
    if (lesson.check === 'targets') for (const p of this.points(lesson.points)) this.addTarget(p);
    if (lesson.check === 'melee') this.addTarget(this.spot('meleetarget'), { melee: true });
    if (lesson.check === 'blast') this.addTarget(this.spot('blasttarget'), { blastOnly: true });
    if (lesson.check === 'crate') {
      this.crate = scene.airdrops.dropAt(this.spot('pad').x);
      this.picksAtStart = this.crate.item.picksLeft;
    }
    if (lesson.check === 'fight') for (const p of this.points('enemy')) this.addEnemy(p);
  }

  // Done yet?
  check() {
    const lesson = this.lesson;
    const p = this.scene.player;
    switch (lesson.check) {
      case 'reach':
        return p.alive && p.x >= this.spot('flag').x;
      case 'perch': {
        const t = this.spot('tower');
        return p.alive && p.onGround && p.x > t.x && p.x < t.x + t.width && p.body.bottom <= t.y + t.height + 2;
      }
      case 'targets':
      case 'melee':
      case 'blast':
        return this.targets.length > 0 && this.targets.every((d) => !d.alive);
      case 'crate':
        if (this.crate.item.picksLeft < this.picksAtStart) return true;
        // Left too long (crates expire): another one comes down.
        if (!this.crate.active) {
          this.crate = this.scene.airdrops.dropAt(this.spot('pad').x);
          this.picksAtStart = this.crate.item.picksLeft;
        }
        return false;
      case 'fight':
        return this.enemies.every((b) => !b.alive);
      default:
        return false;
    }
  }

  complete() {
    this.done = true;
    const lesson = this.lesson;
    this.clearLesson();
    const [who, text] = lesson.good;
    this.queue = [];
    this.speak(who, text);
    this.waitMs += TRAINING.goodMs - TRAINING.readMs; // then on to the next lesson
    this.scene.sfx?.play('pickup');
    if (lesson.gate) this.openGate(this.gateIndex(lesson));
  }

  // Enter: skip this lesson (the gate opens too).
  skip() {
    if (this.over || this.done) return;
    this.complete();
  }

  // Esc: leave Training for Free play.
  leave() {
    this.scene.scene.restart({ modeKey: 'free', mapKey: 'forest' });
  }

  // Which gate a lesson opens: the first one still closed.
  gateIndex() {
    return this.gates.findIndex((g) => !g.open);
  }

  // Take away what's left of a lesson (skipped, or finished early).
  clearLesson() {
    const scene = this.scene;
    for (const d of this.targets) {
      d.alive = false;
      d.setVisible(false);
      d.body.enable = false;
      d.setWord(null);
      d.hpBg.setVisible(false);
      d.hpFill.setVisible(false);
    }
    scene.typing.targets = scene.typing.targets.filter((t) => !this.targets.includes(t));
    this.targets = [];
    for (const b of this.enemies) if (b.alive) b.kill('void');
    this.enemies = [];
    this.crate = null;
  }

  addTarget(point, { melee = false, blastOnly = false } = {}) {
    const scene = this.scene;
    const d = new Dummy(scene, point.x, point.y, { ...ENEMIES.dummy, hp: TRAINING.targetHp, respawnDelay: 1e9, blastOnly });
    scene.typing.addTarget(d);
    scene.collisions.addCharacter(d);
    d.on('died', () => {
      scene.hitStop?.();
      // Melee lesson: only a melee kill counts. A gun kill puts it back.
      if (melee && scene.weapons.current.category !== 'melee') {
        this.speak('sarge', 'With your melee weapon, recruit. Shift until you hold it.');
        scene.time.delayedCall(700, () => d.respawn());
      }
    });
    this.targets.push(d);
  }

  addEnemy(point) {
    const scene = this.scene;
    const e = TRAINING.enemy;
    const base = BOTS[e.bot];
    const config = {
      ...base,
      hp: Math.round(base.hp * e.hp),
      damageScale: (base.damageScale ?? 1) * e.damage,
      dpsScale: e.damage * e.typing,
      reactionMs: Math.round((base.reactionMs ?? 600) * e.reaction),
      typingSpeed: (base.typingSpeed ?? 1.5) * e.typing,
    };
    const bot = scene.spawnBot('main', config);
    bot.body.reset(point.x, 60); // drops into the yard
    scene.bots.push(bot);
    this.enemies.push(bot);
  }

  // ---- Talking ----

  speak(who, text) {
    for (const [name, coach] of Object.entries(this.coaches)) if (name !== who) coach.bubble.hide();
    this.coaches[who].bubble.say(text);
    this.speaker = this.coaches[who];
    this.waitMs = TRAINING.readMs + text.length * 45;
  }

  // ---- Every frame ----

  update(delta) {
    if (this.over) return;
    const now = this.scene.time.now;
    for (const coach of Object.values(this.coaches)) this.moveCoach(coach, delta, now);

    // Lines: the next one once this one is typed out and has been up a while.
    const typed = !this.speaker || this.speaker.bubble.done;
    if (typed) this.waitMs -= delta;
    const free = typed && this.waitMs <= 0;
    if (this.queue.length && free) this.speak(...this.queue.shift());
    if (this.lesson.check === 'blast') this.refillThrowables();
    if (!this.done && this.check()) this.complete();
    if (this.done && free) {
      if (this.index + 1 < TRAINING.lessons.length) this.start(this.index + 1);
      else this.graduate();
    }
  }

  // Never out of grenades in the throwing lesson.
  refillThrowables() {
    const slot = this.scene.weapons.throwSlots[0];
    if (slot.config && slot.count <= 0) slot.count = 3;
  }

  // ---- Coaches ----

  makeCoaches() {
    const scene = this.scene;
    const spot = this.spot('move');
    this.coaches = {};
    let k = 0;
    for (const [who, c] of Object.entries(TRAINING.coaches)) {
      const bot = new Bot(scene, spot.x + 40 + k * 90, this.groundY - 40, BOTS[c.bot], scene.groundLayer, () => null, 'coach');
      bot.isCoach = true;
      bot.restAim = 62; // weapon lowered: they're teaching, not fighting
      bot.team = 'players';
      bot.hpBg.setVisible(false);
      bot.hpFill.setVisible(false);
      scene.physics.add.collider(bot, scene.groundLayer);
      bot.goalX = bot.x;
      bot.movedAt = scene.time.now;
      bot.tag = scene.add
        .text(0, 0, c.title.toUpperCase(), { fontFamily: 'monospace', fontSize: '11px', color: '#ffd166', backgroundColor: '#000000aa', padding: { x: 4, y: 1 } })
        .setOrigin(0.5)
        .setDepth(44);
      bot.bubble = new SpeechBubble(scene, bot, { name: c.title.toUpperCase(), color: COACH_COLORS[who], lettersPerSec: TRAINING.lettersPerSec });
      this.coaches[who] = bot;
      k += 1;
    }
  }

  // Stay with you, one either side: run beside you on the ground, fly with
  // their jetpacks when you're up in the air (or a ledge is in the way),
  // and never past a gate that's still closed. Close by: face you.
  moveCoach(coach, delta, now) {
    const p = this.scene.player;
    const body = coach.body;
    const who = coach === this.coaches.sarge ? 'sarge' : 'tech';
    let gx = p.x + TRAINING.coachSide[who];
    for (const g of this.gates) {
      if (g.open) continue;
      const wall = g.rect.x;
      if (p.x < wall) gx = Math.min(gx, wall - 30);
      else gx = Math.max(gx, wall + g.rect.width + 30);
    }
    const gy = p.alive ? p.y : this.groundY - 40;
    const dx = gx - coach.x;
    const dy = gy - coach.y;
    const blocked = body.blocked.left || body.blocked.right;
    const fly = !coach.onGround || dy < -40 || (blocked && Math.abs(dx) > 10) || (p.alive && !p.onGround);
    coach.thrusting = false;
    if (Math.abs(dx) < 14 && Math.abs(dy) < 40 && coach.onGround) {
      body.setAllowGravity(true);
      body.setVelocityX(body.velocity.x * 0.6);
      coach.faceToward(p.x);
    } else if (!fly) {
      body.setAllowGravity(true);
      body.setVelocityX(Phaser.Math.Clamp(dx * 6, -TRAINING.coachSpeed, TRAINING.coachSpeed));
      coach.facing = Math.sign(dx) || coach.facing;
    } else {
      // Fly straight there; wedged on a ledge: up and over it.
      const want = Math.min(TRAINING.coachFly, Math.hypot(dx, dy) * 4);
      const d = Math.max(1, Math.hypot(dx, dy));
      const vy = blocked ? -TRAINING.coachFly * 0.8 : (dy / d) * want;
      body.setAllowGravity(dy > 30 && Math.abs(dx) < 40); // right above where it's going: drop down
      body.setVelocity(body.velocity.x + ((dx / d) * want - body.velocity.x) * 0.3, body.velocity.y + (vy - body.velocity.y) * 0.3);
      coach.thrusting = vy < -4;
      if (Math.abs(dx) > 14) coach.facing = Math.sign(dx);
      else coach.faceToward(p.x);
    }
    // Lost (fell far behind, a respawn): back beside you.
    if (p.alive && Phaser.Math.Distance.Between(coach.x, coach.y, gx, gy) > 900) body.reset(gx, gy - 20);
    coach.updateVisuals();
    coach.layout();
    coach.tag.setPosition(coach.x, coach.visualTop - 10);
    coach.bubble.update(delta);
  }

  // ---- Gates ----

  // A fence from the sky to the ground with a striped boom and the next
  // station's number. Opening it: it sinks into the ground and the tiles go.
  makeGates(rects) {
    const scene = this.scene;
    this.gates = rects.map((r, i) => {
      const g = scene.add.graphics().setDepth(-4);
      const cx = r.x + r.width / 2;
      const bottom = r.y + r.height;
      g.fillStyle(0x495057, 1).fillRect(cx - 5, r.y, 10, r.height);                  // the post
      g.lineStyle(1, 0xadb5bd, 0.55);
      for (let y = r.y; y < bottom; y += 14) g.lineBetween(cx - 22, y, cx + 22, y + 14).lineBetween(cx + 22, y, cx - 22, y + 14); // chain link
      g.lineStyle(2, 0x6c757d, 0.9).lineBetween(cx - 22, r.y, cx - 22, bottom).lineBetween(cx + 22, r.y, cx + 22, bottom);
      for (let k = 0; k < 6; k++) {                                                    // the striped boom
        g.fillStyle(k % 2 ? 0xffffff : 0xd62828, 1).fillRect(cx - 30 + k * 10, bottom - 70, 10, 10);
      }
      g.fillStyle(0x1b1b1f, 0.9).fillRoundedRect(cx - 34, bottom - 120, 68, 34, 6);    // sign
      const label = scene.add
        .text(cx, bottom - 103, `STATION ${i + 2}\nLOCKED`, { fontFamily: 'monospace', fontSize: '10px', color: '#ffd166', align: 'center' })
        .setOrigin(0.5)
        .setDepth(-3);
      return { rect: r, g, label, open: false };
    });
  }

  openGate(i) {
    const gate = this.gates[i];
    if (!gate || gate.open) return;
    gate.open = true;
    const layer = this.scene.groundLayer;
    const th = layer.tilemap.tileHeight;
    const col = Math.floor(gate.rect.x / layer.tilemap.tileWidth);
    for (let row = 0; row * th < gate.rect.y + gate.rect.height; row++) layer.removeTileAt(col, row);
    this.scene.sfx?.play('boulderCrash', { x: gate.rect.x, y: this.groundY }, { volume: 0.4 });
    this.scene.tweens.add({
      targets: [gate.g, gate.label],
      y: `+=${gate.rect.height}`,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeIn',
      onComplete: () => {
        gate.g.destroy();
        gate.label.destroy();
      },
    });
  }

  // ---- On screen ----

  makeHud() {
    const scene = this.scene;
    const style = { fontFamily: 'monospace', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 12, y: 4 } };
    this.title = scene.add.text(640, 14, '', { ...style, fontSize: '20px', color: '#ffd166' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(HUD_DEPTH);
    this.help = scene.add.text(640, 48, 'Enter: skip lesson    Esc: leave training', { ...style, fontSize: '13px', color: '#c9d1e0' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(HUD_DEPTH);
    this.hint = scene.add.text(640, 680, '', { ...style, fontSize: '17px', padding: { x: 16, y: 8 } }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);
  }

  // All 8 done: a short summary, and what to play next.
  graduate() {
    const scene = this.scene;
    this.over = true;
    scene.matchOver = true;
    scene.physics.world.pause();
    scene.message?.setVisible(false);
    try {
      localStorage.setItem(TRAINING.storageKey, '1');
    } catch {
      // storage blocked: fine
    }
    const { you, timeMs } = scene.stats.summary();
    const t = you.typing;
    const depth = HUD_DEPTH + 5;
    const add = (o) => o.setScrollFactor(0).setDepth(depth + 1);
    add(scene.add.rectangle(640, 360, 760, 420, 0x05070d, 0.95).setStrokeStyle(2, 0x2a3345)).setDepth(depth);
    add(scene.add.text(640, 190, 'TRAINING COMPLETE', { fontFamily: 'monospace', fontSize: '42px', color: '#06d6a0', fontStyle: 'bold' }).setOrigin(0.5));
    const lines = [
      `Time ${clock(timeMs)}`,
      '',
      `Words ${t.finished} of ${t.started}   ·   accuracy ${Math.round(you.accuracy * 100)}%   ·   ${Math.round(you.wpm)} WPM   ·   ${you.typos} typos`,
      `Enemies down ${you.kills}`,
      '',
      'You\'re ready. Next: You vs Military, Zombies or You vs Enemies.',
    ];
    add(scene.add.text(640, 340, lines.join('\n'), { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', align: 'center', lineSpacing: 6 }).setOrigin(0.5));
    add(scene.add.text(640, 520, 'F8: pick a mode    R: train again    Esc: free play', { fontFamily: 'monospace', fontSize: '16px', color: '#7d879c' }).setOrigin(0.5));
    this.title.setVisible(false);
    this.help.setVisible(false);
    this.hint.setVisible(false);
    for (const c of Object.values(this.coaches)) c.bubble.hide();
    scene.input.keyboard.once('keydown-R', () => scene.scene.restart({ mapKey: 'camp', modeKey: 'training' }));
  }
}
