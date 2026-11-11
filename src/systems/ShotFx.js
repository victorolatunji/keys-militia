import Phaser from 'phaser';
import { MUZZLE_FLASH } from '../data/bullets.js';
import { hasLineOfSight } from './LineOfSight.js';

// Shared by your shots (WeaponSystem) and the bots' (BotCombat): where a shot
// leaves the gun, the flash there, and the art shots are drawn with.

export const projKey = (art) => `spr-proj-${art}`;
export const fxKey = (art) => `spr-fx-${art}`;

// The end of the barrel of whatever the shooter holds (its rig), and the way
// it points. No rig or no gun drawn: just in front of them, toward the target.
// A barrel poking through a wall fires from the shooter's middle instead,
// and so does one still on the wrong side (they turned this very frame).
export function muzzleOf(shooter, target, groundLayer) {
  const at = shooter.rig?.muzzle?.();
  const facing = shooter.facing ?? 1;
  const sameSide = at && (at.x - shooter.x) * facing > -4;
  if (sameSide && (!groundLayer || hasLineOfSight(groundLayer, shooter.x, shooter.y, at.x, at.y))) return at;
  const x = shooter.x + (shooter.facing ?? 1) * 16;
  const y = shooter.y - 4;
  const angle = target ? Phaser.Math.Angle.Between(x, y, target.x, target.y) : (shooter.facing ?? 1) < 0 ? Math.PI : 0;
  return { x, y, angle };
}

// An image of a shot or effect, stretched to `length` px along its art.
export function shotImage(scene, key, length, depth = 41) {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(0, 0, key).setDepth(depth);
  img.setScale(length / img.width);
  return img;
}

// The flash at the muzzle, its size by weapon family (MUZZLE_FLASH).
export function muzzleFlash(scene, weapon, at) {
  const look = weapon && weapon.key in MUZZLE_FLASH ? MUZZLE_FLASH[weapon.key] : MUZZLE_FLASH[weapon?.category] ?? MUZZLE_FLASH.fallback;
  if (!look) return;
  const img = shotImage(scene, fxKey(look.art), look.length * Phaser.Math.FloatBetween(0.85, 1.15), 41);
  if (!img) return;
  // Fire bursts forward from the tip; a glow sits on it.
  img.setOrigin(look.glow ? 0.5 : 0.04, 0.5).setPosition(at.x, at.y).setRotation(at.angle);
  if (!look.glow && Math.random() < 0.5) img.setFlipY(true); // a little variety
  if (look.glow) img.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: img,
    alpha: 0,
    scaleX: img.scaleX * (look.glow ? 1.4 : 0.6),
    scaleY: img.scaleY * (look.glow ? 1.4 : 0.8),
    duration: MUZZLE_FLASH.durationMs * (look.glow ? 2 : 1),
    onComplete: () => img.destroy(),
  });
}
