import Phaser from 'phaser';
import { PLAYER } from '../data/player.js';

const SMOKE_COLOR = 0x9a9a9a;
const HIT_FLASH_MS = 80;

// Emits 'died' (cause) — 'void', 'self', and later enemy kills.
// Movement reads this.cursors (left, right, up, down with isDown). For you
// that's the keyboard; Bot extends Player and swaps in a "virtual controller"
// its AI presses, so bots move with exactly the same rules as you.
export default class Player extends Phaser.GameObjects.Rectangle {
  // color: body color (bots pass their own)
  // stats: movement and health tuning (default: player.js; bots pass a scaled copy)
  constructor(scene, x, y, color = PLAYER.color, stats = PLAYER) {
    super(scene, x, y, PLAYER.width, PLAYER.height, color);
    this.stats = stats;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.baseColor = color;
    this.spawnPoint = { x, y };
    this.facing = 1;          // 1 = right, -1 = left
    this.hp = this.stats.maxHp;
    this.fuel = this.stats.fuelMax;
    this.thrusting = false;
    this.typing = false;
    this.aiming = false;
    this.alive = true;
    this.staggerUntil = 0;    // scene time when a blast push stops overriding control
    this.lastHurtAt = 0;      // for health regen
    this.boostUntil = 0;      // Jet Boost: fuel stays full until then
    this.boostRise = 1;
    this.shield = null;       // Riot Shield: { config, hp, sprite }

    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(2000, this.stats.maxFallSpeed);

    // White outline shows the typing state (hidden until typing).
    this.setStrokeStyle(3, 0xffffff);
    this.isStroked = false;

    // Placeholder visuals
    this.flame = scene.add.rectangle(x, y, 10, 14, this.stats.flameColor).setVisible(false);
    this.eye = scene.add.rectangle(x, y, 8, 8, this.stats.eyeColor);

    this.cursors = this.createControls(scene);
  }

  // Arrow keys. Bot overrides this with buttons its AI presses.
  createControls(scene) {
    return scene.input.keyboard.createCursorKeys();
  }

  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  // Nailed in place by a Nail Gun (StatusSystem sets pinnedUntil).
  get pinned() {
    return this.scene.time.now < (this.pinnedUntil ?? 0);
  }

  // True right after a blast push: controls are ignored so the push plays out.
  get staggered() {
    return this.scene.time.now < this.staggerUntil;
  }

  update(delta) {
    if (!this.alive) return;

    const dt = delta / 1000;
    const { left, right, up, down } = this.cursors;

    this.regenerate(dt);

    if (this.staggered) {
      this.updateStaggered(dt);        // flying from a blast, no control
    } else if (this.pinned) {
      this.updatePinned(dt);           // nailed in place: no running or jetpack
    } else if (this.typing) {
      this.updateTyping(dt);           // hold still, slow fall
    } else if (this.aiming) {
      this.updateHorizontal(left, right);
      this.updateAimingAir(dt);        // run, but Up/Down aim instead of jetpack
    } else {
      this.updateHorizontal(left, right);
      this.updateJetpack(up, down, dt);
    }

    this.updateFloat(left, right, up, down, delta);
    this.updateVisuals();
  }

  // Jet Boost: floating. Gravity is off and you sink slowly instead. The
  // arrows glide you in any direction (Up rises, Down dives), easing into
  // each new speed so it feels smooth but stays quick enough to dodge.
  // Let go and you drift to a stop sideways and keep sinking slowly.
  // While typing or aiming you just sink slowly. A nail pin or a blast wins.
  updateFloat(left, right, up, down, delta) {
    const floating = this.boosted && !this.pinned && !this.staggered;
    this.body.setAllowGravity(!floating);
    if (!floating) {
      this.floatVel = null;
      return;
    }

    const cfg = this.boostConfig;
    const steering = !this.typing && !this.aiming;
    let tx = 0;
    let ty = cfg.sinkSpeed;
    if (steering) {
      if (left.isDown && !right.isDown) tx = -cfg.glideSpeed;
      else if (right.isDown && !left.isDown) tx = cfg.glideSpeed;
      if (up.isDown) ty = -cfg.riseSpeed;
      else if (down.isDown) ty = cfg.diveSpeed;
    }

    // Ease from the current float speed toward the target (same feel at any frame rate).
    this.floatVel ??= { x: this.body.velocity.x, y: this.body.velocity.y };
    const k = 1 - Math.exp(-delta / cfg.easeMs * 3);
    this.floatVel.x += (tx - this.floatVel.x) * k;
    this.floatVel.y += (ty - this.floatVel.y) * k;

    this.body.setAccelerationY(0);
    this.body.setVelocity(this.floatVel.x, this.floatVel.y);
    if (tx !== 0) this.facing = Math.sign(tx);
    this.thrusting = true; // the jet stays lit while you float
  }

  // ---- Health ----

  // HP slowly comes back after a while without taking damage.
  regenerate(dt) {
    const { regenPerSec, regenDelayMs, maxHp } = this.stats;
    if (!regenPerSec || this.hp >= maxHp) return;
    if (this.scene.time.now - this.lastHurtAt < regenDelayMs) return;
    this.hp = Math.min(maxHp, this.hp + regenPerSec * dt);
  }

  takeDamage(amount, cause) {
    if (!this.alive) return;

    this.lastHurtAt = this.scene.time.now;
    this.hp = Math.max(0, this.hp - amount);
    this.flash();

    if (this.hp === 0) this.kill(cause);
  }

  flash() {
    this.setFillStyle(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => this.setFillStyle(this.baseColor));
  }

  // Blast push (WeaponSystem decides direction and strength).
  applyKnockback(vx, vy) {
    if (!this.alive) return;

    this.thrusting = false;
    this.body.setAcceleration(0, 0);
    this.body.setVelocity(vx, vy);
    this.staggerUntil = this.scene.time.now + this.stats.knockbackStaggerMs;
  }

  // Any death goes through here, so the scene hears about it once.
  kill(cause) {
    if (!this.alive) return;
    this.die();
    this.emit('died', cause);
  }

  // ---- States ----

  setTyping(on) {
    this.typing = on;
    this.isStroked = on;

    if (on) {
      this.thrusting = false;
      this.body.setAccelerationY(0);
      if (!this.staggered) this.body.setVelocityX(0); // don't cancel a blast push
    }
  }

  setAiming(on) {
    this.aiming = on;

    if (on) {
      this.thrusting = false;
      this.body.setAccelerationY(0);
    }
  }

  // Auto-face a target (called while typing at it).
  faceToward(x) {
    this.facing = x < this.x ? -1 : 1;
  }

  // Typo feedback: a few grey smoke puffs from the gun.
  jamPuff() {
    const x = this.x + this.facing * 18;
    const y = this.y - 4;

    for (let i = 0; i < 4; i++) {
      const puff = this.scene.add
        .circle(x, y, Phaser.Math.Between(4, 7), SMOKE_COLOR, 0.8)
        .setDepth(41);

      this.scene.tweens.add({
        targets: puff,
        x: x + this.facing * Phaser.Math.Between(4, 16),
        y: y - Phaser.Math.Between(10, 24),
        alpha: 0,
        scale: 1.8,
        duration: 400 + i * 60,
        onComplete: () => puff.destroy(),
      });
    }
  }

  // ---- Movement ----

  updateTyping(dt) {
    // Hold position horizontally, no jetpack.
    this.body.setVelocityX(0);
    this.body.setAccelerationY(0);

    // In the air: gravity still pulls, but the fall is capped to a slow drift.
    if (!this.onGround && this.body.velocity.y > this.stats.typingFallSpeed) {
      this.body.setVelocityY(this.stats.typingFallSpeed);
    }

    this.refillFuel(dt);
  }

  // Pinned: can't run, jump or use the jetpack. In the air it drops
  // straight down (no rising), then stays where it lands.
  updatePinned(dt) {
    this.thrusting = false;
    this.body.setVelocityX(0);
    this.body.setAccelerationY(0);
    if (this.body.velocity.y < 0) this.body.setVelocityY(0);
    this.refillFuel(dt);
  }

  // Knocked back: gravity and the push only. Fuel still refills on the ground.
  updateStaggered(dt) {
    this.thrusting = false;
    this.body.setAccelerationY(0);
    this.refillFuel(dt);
  }

  // Aiming: no jetpack, normal gravity (risky over the void).
  updateAimingAir(dt) {
    this.thrusting = false;
    this.body.setAccelerationY(0);
    this.refillFuel(dt);
  }

  updateHorizontal(left, right) {
    const speed = this.onGround ? this.stats.runSpeed : this.stats.airSpeed;

    if (left.isDown && !right.isDown) {
      this.body.setVelocityX(-speed);
      this.facing = -1;
    } else if (right.isDown && !left.isDown) {
      this.body.setVelocityX(speed);
      this.facing = 1;
    } else {
      this.body.setVelocityX(0);
    }
  }

  updateJetpack(up, down, dt) {
    if (this.boosted) this.fuel = this.stats.fuelMax; // Jet Boost: tank stays full
    this.thrusting = up.isDown && this.fuel > 0;

    if (this.thrusting) {
      this.body.setAccelerationY(-this.stats.jetThrust);
      if (!this.boosted) this.fuel = Math.max(0, this.fuel - this.stats.fuelDrain * dt);
    } else if (down.isDown && !this.onGround) {
      this.body.setAccelerationY(this.stats.descendBoost);
    } else {
      this.body.setAccelerationY(0);
    }

    // Cap upward speed so the jetpack feels controlled (a bit higher when boosted).
    const maxRise = this.stats.maxRiseSpeed * (this.boosted ? this.boostRise : 1);
    if (this.body.velocity.y < -maxRise) {
      this.body.setVelocityY(-maxRise);
    }

    if (!this.thrusting) this.refillFuel(dt);
  }

  // Fuel refills only on the ground.
  refillFuel(dt) {
    if (this.onGround) {
      this.fuel = Math.min(this.stats.fuelMax, this.fuel + this.stats.fuelRefill * dt);
    }
  }

  updateVisuals() {
    this.eye.setPosition(this.x + this.facing * 8, this.y - 12);

    // Riot Shield: held on the side you face.
    if (this.shield) {
      this.shield.sprite.setPosition(this.x + this.facing * this.shield.config.offsetX, this.y);
    }

    // Flame comes out of the back, flickers while thrusting.
    // Jet Boost: a longer blue flame.
    const boosted = this.boosted && this.boostConfig;
    this.flame.setVisible(this.thrusting);
    if (this.thrusting) {
      const length = boosted ? Phaser.Math.Between(22, 36) : Phaser.Math.Between(10, 18);
      this.flame.setFillStyle(boosted ? this.boostConfig.flameColor : this.stats.flameColor);
      this.flame.height = length;
      this.flame.setPosition(this.x - this.facing * 10, this.y + 24 + length / 2);
    }
  }

  // ---- Jet Boost and Riot Shield ----

  get boosted() {
    return this.scene.time.now < this.boostUntil;
  }

  // Fuel stays full (and you climb faster) for config.durationMs.
  startBoost(config) {
    this.boostUntil = this.scene.time.now + config.durationMs;
    this.boostRise = config.riseScale;
    this.boostConfig = config;
    this.fuel = this.stats.fuelMax;
  }

  equipShield(config) {
    this.dropShield();
    const sprite = this.scene.add
      .rectangle(this.x, this.y, config.width, config.height, config.color)
      .setStrokeStyle(2, config.rimColor)
      .setDepth(5);
    this.shield = { config, hp: config.hp, sprite };
  }

  // Does a hit coming from x land on the shield (it's on the side you face)?
  shieldCovers(fromX) {
    return Boolean(this.shield) && Math.sign(fromX - this.x) === this.facing;
  }

  // The shield takes the hit. It turns red as it wears and breaks at 0.
  absorb(amount) {
    const s = this.shield;
    s.hp -= amount;
    const worn = 1 - Math.max(0, s.hp) / s.config.hp;
    s.sprite.setStrokeStyle(2, worn > 0.6 ? s.config.damagedColor : s.config.rimColor);
    if (s.hp <= 0) {
      this.dropShield();
      this.emit('shieldBroke');
    }
  }

  dropShield() {
    if (!this.shield) return;
    this.shield.sprite.destroy();
    this.shield = null;
  }

  // ---- Death and respawn ----

  die() {
    this.alive = false;
    this.staggerUntil = 0;
    this.thrusting = false;
    this.typing = false;
    this.aiming = false;
    this.isStroked = false;
    this.body.setAcceleration(0, 0);
    this.body.stop();               // zero velocity
    this.body.enable = false;       // no physics while dead
    this.setVisible(false);
    this.eye.setVisible(false);
    this.flame.setVisible(false);
    this.dropShield();
    this.boostUntil = 0;
  }

  // point: where to drop in (default: your spawn point)
  respawn(point = this.spawnPoint) {
    this.body.enable = true;
    this.body.reset(point.x, point.y); // move + zero velocity
    this.body.setAcceleration(0, 0);
    this.hp = this.stats.maxHp;
    this.fuel = this.stats.fuelMax;
    this.alive = true;
    this.staggerUntil = 0;
    this.body.setAllowGravity(true);
    this.setFillStyle(this.baseColor);
    this.setVisible(true);
    this.eye.setVisible(true);
  }
}