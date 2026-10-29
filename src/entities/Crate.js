import Phaser from 'phaser';
import { AIRDROPS } from '../data/airdrops.js';
import { iconKey } from '../ui/Icons.js';

// An airdrop crate. States:
//   falling  - under the parachute, slow and swaying
//   tipping  - touched down with its center over empty space: leans and slides off
//   tumbling - falling without a chute (after tipping, or its support vanished)
//   settled  - resting properly; solid to players, grenades and other crates
// Falls into the void if it misses everything.
// The icons of the guns inside take turns on the crate's side.
export default class Crate extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, item, groundLayer, worldHeight) {
    const { width, height, color, strokeColor } = AIRDROPS.crate;
    super(scene, x, y, width, height, color);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.isCrate = true;
    this.icon = scene.add.image(x, y, iconKey(item)).setScale(AIRDROPS.crate.iconScale);
    this.item = item;         // { type: 'crate', options: [keys], picksLeft } (setter: updates the icon)
    this.groundLayer = groundLayer;
    this.worldHeight = worldHeight;
    this.state = 'falling';
    this.tipDir = 0;          // -1 left, 1 right
    this.stateSince = scene.time.now;
    this.expiresAt = Infinity; // set on first touchdown
    this.nextSupportCheck = 0;
    this.spawnedAt = scene.time.now;

    this.setStrokeStyle(2, strokeColor);

    // Cap the fall speed: gravity still pulls, the chute holds it to a slow drift.
    this.body.setMaxVelocity(AIRDROPS.swaySpeed * 2, AIRDROPS.fallSpeed);

    this.chute = this.drawChute(scene);
    this.collider = scene.physics.add.collider(this, groundLayer);
  }

  // Swapping an item in (PickupSystem) also swaps the picture.
  get item() {
    return this._item;
  }

  set item(item) {
    this._item = item;
    this.iconIndex = 0;
    this.nextIconAt = 0;
    this.icon.setTexture(iconKey(item));
  }

  // Show the next gun that's still in the crate.
  cycleIcon(now) {
    const options = this._item.options;
    if (!options || now < this.nextIconAt) return;
    this.nextIconAt = now + AIRDROPS.crate.iconCycleMs;
    for (let i = 1; i <= options.length; i++) {
      const next = (this.iconIndex + i) % options.length;
      if (options[next]) {
        this.iconIndex = next;
        this.icon.setTexture(iconKey({ type: 'gun', key: options[next] }));
        return;
      }
    }
  }

  get settled() {
    return this.state === 'settled';
  }

  // Standing on a tile or on a settled crate this frame.
  get onSomething() {
    return this.body.blocked.down || this.body.touching.down;
  }

  // Canopy and strings, drawn once around (0, 0) and moved with the crate.
  drawChute(scene) {
    const { radius, height, color, stripeColor, lineColor } = AIRDROPS.chute;
    const halfW = AIRDROPS.crate.width / 2;
    const top = -AIRDROPS.crate.height / 2;
    const g = scene.add.graphics();

    // Strings from the canopy edge to the crate's top corners.
    g.lineStyle(1, lineColor, 0.9);
    g.lineBetween(-radius, -height, -halfW, top);
    g.lineBetween(radius, -height, halfW, top);
    g.lineBetween(0, -height, 0, top);

    // Canopy: a half circle with a stripe down the middle.
    g.fillStyle(color, 1);
    g.slice(0, -height, radius, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(stripeColor, 1);
    g.slice(0, -height, radius, Math.PI * 1.4, Math.PI * 1.6, false);
    g.fillPath();

    g.setPosition(this.x, this.y);
    return g;
  }

  update(delta) {
    if (!this.active) return;
    const now = this.scene.time.now;

    // Fell into the void, or its time is up.
    if (this.y > this.worldHeight || now >= this.expiresAt) {
      this.remove();
      return;
    }

    if (this.state === 'falling') this.updateFalling(now);
    else if (this.state === 'tipping') this.updateTipping(now);
    else if (this.state === 'tumbling') this.updateTumbling(delta);
    else this.updateSettled(now);

    if (this.active) {
      this.cycleIcon(now);
      this.syncIcon();
    }
  }

  syncIcon() {
    this.icon.setPosition(this.x, this.y);
    this.icon.setRotation(this.rotation);
    this.icon.setAlpha(this.alpha);
  }

  // ---- States ----

  updateFalling(now) {
    if (this.onSomething) {
      this.touchDown(now);
      return;
    }

    // Sway left and right; the canopy tilts with the drift.
    const phase = ((now - this.spawnedAt) / AIRDROPS.swayMs) * Math.PI * 2;
    const vx = Math.sin(phase) * AIRDROPS.swaySpeed;
    this.body.setVelocityX(vx);

    this.chute.setPosition(this.x, this.y);
    this.chute.rotation = (vx / AIRDROPS.swaySpeed) * 0.12;
  }

  updateTipping(now) {
    this.body.setVelocityX(this.tipDir * AIRDROPS.tipSpeed);

    if (!this.onSomething) {
      this.changeState('tumbling');
      return;
    }

    // Wedged against a wall and can't slide off: give up and rest.
    if (now - this.stateSince > 1500) this.settle(now);
  }

  updateTumbling(delta) {
    this.rotation += this.tipDir * AIRDROPS.tumbleSpin * (delta / 1000);

    if (this.onSomething) this.touchDown(this.scene.time.now);
  }

  updateSettled(now) {
    // Check now and then that the ground is still there (a crate below can vanish).
    if (now >= this.nextSupportCheck) {
      this.nextSupportCheck = now + AIRDROPS.supportCheckMs;
      if (!this.supportedAt(this.x)) {
        this.unsettle();
        this.touchDown(now); // decides: tip off an edge, or tumble straight down
        return;
      }
    }

    // Blink near the end so players know it's about to go.
    const timeLeft = this.expiresAt - now;
    if (timeLeft < AIRDROPS.blinkBeforeMs) {
      this.setAlpha(Math.floor(now / 150) % 2 ? 0.35 : 1);
    }
  }

  // ---- Transitions ----

  // Just touched something (or lost support): rest if the center is supported,
  // tip toward the open side if only one edge is, otherwise fall.
  touchDown(now) {
    this.collapseChute();
    if (this.expiresAt === Infinity) this.expiresAt = now + AIRDROPS.lifetimeMs;

    if (this.supportedAt(this.x)) {
      this.settle(now);
      return;
    }

    const leftFoot = this.supportedAt(this.body.left + 3);
    const rightFoot = this.supportedAt(this.body.right - 3);

    if (leftFoot || rightFoot) {
      this.tipDir = leftFoot ? 1 : -1; // supported on the left, so tip right
      this.changeState('tipping');
      this.leanTo(this.tipDir * AIRDROPS.tipAngle);
    } else {
      this.changeState('tumbling');
    }
  }

  settle(now) {
    this.changeState('settled');
    this.body.stop();
    this.body.setAllowGravity(false); // rests in place; support is checked by hand
    this.body.setImmovable(true);     // players can stand on it without pushing it
    this.nextSupportCheck = now + AIRDROPS.supportCheckMs;
    this.leanTo(0);
  }

  unsettle() {
    this.body.setAllowGravity(true);
    this.body.setImmovable(false);
  }

  changeState(state) {
    this.state = state;
    this.stateSince = this.scene.time.now;

    if (state === 'tipping' || state === 'tumbling') {
      this.body.setMaxVelocity(AIRDROPS.tipSpeed, AIRDROPS.maxFallSpeed);
    }
  }

  // ---- Helpers ----

  // Is there a solid tile or a settled crate just below this x?
  supportedAt(x) {
    const below = this.body.bottom + 2;

    const tile = this.groundLayer.getTileAtWorldXY(x, below);
    if (tile && tile.collides) return true;

    const bodies = this.scene.physics.overlapRect(x - 1, below - 1, 2, 3);
    return bodies.some((b) => b !== this.body && b.gameObject?.isCrate && b.gameObject.settled);
  }

  leanTo(angle) {
    this.scene.tweens.add({ targets: this, rotation: angle, duration: 200 });
  }

  collapseChute() {
    if (!this.chute) return;

    const chute = this.chute;
    this.chute = null;
    this.scene.tweens.add({
      targets: chute,
      alpha: 0,
      scaleY: 0.3,
      y: chute.y + 12,
      duration: 350,
      onComplete: () => chute.destroy(),
    });
  }

  remove() {
    if (this.chute) this.chute.destroy();
    this.icon.destroy();
    this.collider.destroy();
    this.destroy();
  }
}