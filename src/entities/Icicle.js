import Phaser from 'phaser';
import Dummy from './Dummy.js';
import { ICICLE } from '../data/hazards.js';
import { isSolid } from '../systems/Terrain.js';

const DAMAGE_COLOR = '#a8dadc';

// An icicle hanging from a ceiling (Glacier). No typing: it snaps off by
// itself now and then (sooner when someone walks under it), drops on
// whoever is below and shatters. It grows back later. A creak and a shake
// warn you just before it goes. Built on Dummy (a blast can knock it off).
const SNAP_EVERY_MS = [9000, 18000];
const SNAP_WARN_MS = 500;
export default class Icicle extends Dummy {
  constructor(scene, x, ceilingY) {
    const config = {
      name: 'Icicle', width: ICICLE.width, height: ICICLE.length, color: ICICLE.color,
      hp: 1, respawnDelay: ICICLE.regrowMs, material: 'ice',
    };
    super(scene, x, ceilingY + ICICLE.length, config); // placed by its tip
    this.ceilingY = ceilingY;
    this.isIcicle = true;
    this.setFillStyle(ICICLE.color, 0); // the body is invisible; the spike below is the look
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.look = scene.add.graphics().setDepth(4);
    this.drawSpike(this.look, 0, 0);
    this.look.setPosition(x, ceilingY);
    this.falling = null;
    this.setWord?.(null);
    this.label?.setVisible(false);
    this.snapAt = scene.time.now + Phaser.Math.Between(...SNAP_EVERY_MS);
  }

  // A long spike, wide at the ceiling, pointed at the bottom, with a shine.
  drawSpike(g, x, y) {
    const w = ICICLE.width;
    const h = ICICLE.length;
    g.clear();
    g.fillStyle(ICICLE.color, 0.95);
    g.fillTriangle(x - w / 2, y, x + w / 2, y, x, y + h);
    g.fillStyle(0xffffff, 0.8);
    g.fillTriangle(x - w / 4, y + 2, x - w / 8, y + 2, x - 1, y + h * 0.7);
    g.lineStyle(1, 0x90e0ef, 1);
    g.strokeTriangle(x - w / 2, y, x + w / 2, y, x, y + h);
  }

  // Any hit snaps it off (no blood, no gibs).
  takeDamage() {
    if (!this.alive) return;
    this.hp = 0;
    this.die();
  }

  flash() {}
  setEnvTint() {}

  die() {
    this.alive = false;
    this.body.enable = false;
    this.setWord(null);
    this.emit('died', this);
    this.scene.sfx?.play('iceCrack', this);
    this.falling = { x: this.x, y: this.ceilingY, hit: new Set() };
    this.scene.time.delayedCall(this.config.respawnDelay, () => this.respawn());
  }

  // Grows back from the ceiling.
  respawn() {
    super.respawn();
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.falling = null;
    this.setWord?.(null);
    this.label?.setVisible(false);
    this.snapAt = this.scene.time.now + Phaser.Math.Between(...SNAP_EVERY_MS);
    this.drawSpike(this.look, 0, 0);
    this.look.setPosition(this.x, this.ceilingY).setScale(1, 0.1).setAlpha(1);
    this.scene.tweens.add({ targets: this.look, scaleY: 1, duration: 1200 });
  }

  // Its word shows just under the tip.
  layout() {
    this.label.setPosition(this.x, this.y + this.height / 2 + 16);
  }

  // Falls, hurts whoever it lands on (your hit: it counts as your kill), shatters.
  update(dt) {
    this.layout();
    this.autoSnap();
    const f = this.falling;
    if (!f || f.done) return;
    const prevY = f.y; // swept: a slow frame can't skip it past someone
    f.y += ICICLE.fallSpeed * Math.sqrt(this.scene.physics.world.gravity.y / 800) * Math.min(dt, 0.05);
    this.look.setPosition(f.x, f.y);
    const tipY = f.y + ICICLE.length;
    const scene = this.scene;
    for (const c of [scene.player, ...(scene.bots ?? [])]) {
      if (!c?.alive || f.hit.has(c)) continue;
      const b = c.body;
      if (Math.abs(c.x - f.x) > ICICLE.hitWidth / 2 + b.width / 2 || tipY < b.top || prevY > b.bottom) continue;
      f.hit.add(c);
      c.takeDamage(c === scene.player ? Math.round(ICICLE.damage * 0.6) : ICICLE.damage, 'icicle', 'melee');
      scene.weapons?.status.apply(c, 'frozen', 'env', 1500);
    }
    if (isSolid(scene.groundLayer, f.x, tipY) || tipY > scene.physics.world.bounds.height) this.shatter(f.x, Math.min(tipY, scene.physics.world.bounds.height));
  }

  // Its timer is up: it goes once someone is under it (or a bit later anyway).
  autoSnap() {
    if (!this.alive) return;
    const scene = this.scene;
    const now = scene.time.now;
    if (now < this.snapAt) return;
    if (this.warnAt) {
      if (now >= this.warnAt) {
        this.warnAt = 0;
        this.look.setAngle(0);
        this.die();
      }
      return;
    }
    const below = [scene.player, ...(scene.bots ?? [])].some((c) => c?.alive && Math.abs(c.x - this.x) < 50 && c.y > this.ceilingY && c.y - this.ceilingY < 500);
    if (!below && now < this.snapAt + 4000) return;
    this.warnAt = now + SNAP_WARN_MS;
    scene.sfx?.play('iceCrack', this, { volume: 0.6 });
    scene.tweens.add({ targets: this.look, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 3 });
  }

  shatter(x, y) {
    this.falling.done = true;
    this.look.setAlpha(0);
    this.scene.sfx?.play('iceBreak', { x, y });
    for (let i = 0; i < 7; i++) {
      const size = Phaser.Math.Between(3, 6);
      this.scene.effects?.piece(x, y - 6, { w: size, h: size, color: i % 2 ? ICICLE.color : 0xffffff }, false);
    }
  }
}
