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

  // True right after a blast push: controls are ignored so the push plays out.
  get staggered() {
    return this.scene.time.now < this.staggerUntil;
  }

  update(delta) {
    if (!this.alive) return;

    const dt = delta / 1000;
    const { left, right, up, down } = this.cursors;

    if (this.staggered) {
      this.updateStaggered(dt);        // flying from a blast, no control
    } else if (this.typing) {
      this.updateTyping(dt);           // hold still, slow fall
    } else if (this.aiming) {
      this.updateHorizontal(left, right);
      this.updateAimingAir(dt);        // run, but Up/Down aim instead of jetpack
    } else {
      this.updateHorizontal(left, right);
      this.updateJetpack(up, down, dt);
    }

    this.updateVisuals();
  }

  // ---- Health ----

  takeDamage(amount, cause) {
    if (!this.alive) return;

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
    this.thrusting = up.isDown && this.fuel > 0;

    if (this.thrusting) {
      this.body.setAccelerationY(-this.stats.jetThrust);
      this.fuel = Math.max(0, this.fuel - this.stats.fuelDrain * dt);
    } else if (down.isDown && !this.onGround) {
      this.body.setAccelerationY(this.stats.descendBoost);
    } else {
      this.body.setAccelerationY(0);
    }

    // Cap upward speed so the jetpack feels controlled.
    if (this.body.velocity.y < -this.stats.maxRiseSpeed) {
      this.body.setVelocityY(-this.stats.maxRiseSpeed);
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

    // Flame comes out of the back, flickers while thrusting.
    this.flame.setVisible(this.thrusting);
    if (this.thrusting) {
      this.flame.setPosition(this.x - this.facing * 10, this.y + 30);
      this.flame.height = Phaser.Math.Between(10, 18);
    }
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
    this.setFillStyle(this.baseColor);
    this.setVisible(true);
    this.eye.setVisible(true);
  }
}