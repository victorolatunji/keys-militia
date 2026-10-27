import Phaser from 'phaser';

const MAX_LIFE_MS = 2000; // safety: never fly forever

// A gun bullet: a short streak that flies to its target and does its damage
// on arrival (onArrive). It follows the target, so a finished word always hits.
// If the target dies first, it flies to where the target was and does nothing.
// Only a picture: no physics body, walls were checked when the word was typed.
export default class Bullet extends Phaser.GameObjects.Rectangle {
  // offset: { x, y } aim point around the target's center (shotgun spread)
  constructor(scene, x, y, target, offset, style, color, width, onArrive) {
    super(scene, x, y, style.length, width, color);
    scene.add.existing(this);
    this.setDepth(40);

    this.target = target;
    this.offset = offset;
    this.speed = style.speed;
    this.trail = style.trail ?? false;
    this.startX = x;
    this.startY = y;
    this.onArrive = onArrive;
    this.diesAt = scene.time.now + MAX_LIFE_MS;

    this.goalX = target.x + offset.x;
    this.goalY = target.y + offset.y;
    this.rotation = Phaser.Math.Angle.Between(x, y, this.goalX, this.goalY);
  }

  update(delta) {
    if (!this.active) return;

    // Keep chasing a living target; a dead one keeps its last spot.
    if (this.target.alive) {
      this.goalX = this.target.x + this.offset.x;
      this.goalY = this.target.y + this.offset.y;
    }

    const step = this.speed * (delta / 1000);
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.goalX, this.goalY);

    if (dist <= step || this.scene.time.now >= this.diesAt) {
      this.arrive();
      return;
    }

    this.rotation = Phaser.Math.Angle.Between(this.x, this.y, this.goalX, this.goalY);
    this.x += Math.cos(this.rotation) * step;
    this.y += Math.sin(this.rotation) * step;
  }

  arrive() {
    if (this.trail) this.drawTrail();
    if (this.target.alive) this.onArrive(this.target);
    this.destroy();
  }

  // Thin line from the muzzle to the hit, fading out (snipers, marksman).
  drawTrail() {
    const g = this.scene.add.graphics().setDepth(39);
    g.lineStyle(1, this.fillColor, 0.6);
    g.lineBetween(this.startX, this.startY, this.goalX, this.goalY);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 250,
      onComplete: () => g.destroy(),
    });
  }
}
