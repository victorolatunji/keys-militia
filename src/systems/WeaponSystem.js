import { WEAPONS, DEFAULT_LOADOUT, GUN_SWITCH_MS } from '../data/weapons.js';

const TRACER_FADE_MS = 150;

// Gun slots, Shift switching, and firing (damage + tracer).
// Throwables are added in the next steps.
export default class WeaponSystem {
  constructor(scene, player, typing) {
    this.scene = scene;
    this.player = player;
    this.typing = typing;

    this.guns = DEFAULT_LOADOUT.guns.map((key) => (key ? WEAPONS[key] : null));
    this.active = 0;
    this.shots = 0;

    scene.input.keyboard.on('keydown-SHIFT', this.handleShift, this);
    scene.events.once('shutdown', () => {
      scene.input.keyboard.off('keydown-SHIFT', this.handleShift, this);
    });
  }

  get current() {
    return this.guns[this.active];
  }

  handleShift(event) {
    if (event.repeat || !this.player.alive) return;
    this.switchGun();
  }

  switchGun() {
    const next = (this.active + 1) % this.guns.length;
    if (next === this.active || !this.guns[next]) return; // empty slot

    this.active = next;
    this.typing.onWeaponChanged(GUN_SWITCH_MS);
  }

  // Called by TypingSystem when a word is finished.
  fire(target) {
    const gun = this.current;
    this.shots += 1;
    this.drawTracer(target, gun);
    target.takeDamage(gun.damage);
  }

  drawTracer(target, gun) {
    const p = this.player;
    const g = this.scene.add.graphics().setDepth(40);
    g.lineStyle(gun.tracerWidth, gun.tracerColor, 1);
    g.lineBetween(p.x + p.facing * 16, p.y - 4, target.x, target.y);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: TRACER_FADE_MS,
      onComplete: () => g.destroy(),
    });
  }
}