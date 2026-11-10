import Dummy from './Dummy.js';

// A map object you set off by typing its word (a "typeable hazard"): the
// Catacombs boulder levers, the Graveyard church bell. Like a dummy for
// typing and lock-on (it takes one shot), but it doesn't bleed or break:
// it fires onTrigger() and its word comes back once it's ready again.
//   opts: { width, height, draw(g, ready), onTrigger(), rearmMs, labelOffset }
// draw() paints its look into a Graphics at (0, 0) = its center; ready is
// false while it's waiting to re-arm.
export default class Trigger extends Dummy {
  constructor(scene, x, y, opts) {
    const config = { name: opts.name ?? 'Trigger', width: opts.width, height: opts.height, color: 0xffffff, hp: 1, respawnDelay: opts.rearmMs, material: 'machine' };
    super(scene, x, y + opts.height / 2, config); // Dummy places by the bottom
    this.opts = opts;
    this.isTrigger = true;
    this.setFillStyle(0xffffff, 0);
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.body.enable = false; // nothing bumps into it
    this.look = scene.add.graphics().setDepth(3).setPosition(x, y);
    opts.draw(this.look, true);
  }

  // Any hit sets it off.
  takeDamage() {
    if (!this.alive) return;
    this.hp = 0;
    this.die();
  }

  flash() {}
  setEnvTint() {}

  die() {
    this.alive = false;
    this.setWord(null);
    this.emit('died', this);
    this.opts.draw(this.look.clear(), false);
    this.opts.onTrigger();
    this.scene.time.delayedCall(this.config.respawnDelay, () => this.respawn());
  }

  // Ready again: its word can come back.
  respawn() {
    this.hp = this.maxHp;
    this.alive = true;
    this.opts.draw(this.look.clear(), true);
    this.emit('respawn', this);
  }

  layout() {
    this.label.setPosition(this.x, this.y - this.height / 2 - (this.opts?.labelOffset ?? 16));
  }

  update() {
    this.layout();
  }
}
