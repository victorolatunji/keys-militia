import Phaser from 'phaser';
import { hasLineOfSight } from '../systems/LineOfSight.js';

const SPARK_COLOR = 0xffd166;

// A bot's bullet: flies in a straight line and can miss. Each frame it
// checks the stretch it just covered, so a fast bullet can't skip through
// a wall or past you between frames. Walls stop it with a small spark.
// onHit(target) runs once if it touches the target.
export default class EnemyBullet extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, angle, speed, look, groundLayer, target, maxRangePx, onHit) {
    super(scene, x, y, look.length, look.width, look.color);
    scene.add.existing(this);
    this.setDepth(40);
    this.rotation = angle;

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.groundLayer = groundLayer;
    this.target = target;
    this.onHit = onHit;
    this.startX = x;
    this.startY = y;
    this.maxRangePx = maxRangePx;
    this.line = new Phaser.Geom.Line();
  }

  update(delta) {
    if (!this.active) return;

    const dt = delta / 1000;
    const fromX = this.x;
    const fromY = this.y;
    const toX = fromX + this.vx * dt;
    const toY = fromY + this.vy * dt;

    // Hit the target on the way?
    if (this.target.alive) {
      this.line.setTo(fromX, fromY, toX, toY);
      if (Phaser.Geom.Intersects.LineToRectangle(this.line, this.target.getBounds())) {
        this.onHit(this.target, Phaser.Math.Distance.Between(this.startX, this.startY, fromX, fromY));
        this.destroy();
        return;
      }
    }

    // Hit a wall?
    if (!hasLineOfSight(this.groundLayer, fromX, fromY, toX, toY)) {
      this.spark();
      this.destroy();
      return;
    }

    this.setPosition(toX, toY);

    // Out of range: fades out of existence.
    if (Phaser.Math.Distance.Between(this.startX, this.startY, toX, toY) > this.maxRangePx) {
      this.destroy();
    }
  }

  spark() {
    const s = this.scene.add.circle(this.x, this.y, 3, SPARK_COLOR).setDepth(41);
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      scale: 2,
      duration: 120,
      onComplete: () => s.destroy(),
    });
  }
}
