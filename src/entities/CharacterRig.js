import Phaser from 'phaser';
import { SPRITES } from '../data/spriteManifest.js';
import { RIG, RIG_FOLDERS, OVERRIDES, WEAPON_LENGTH, MELEE_LENGTH, GRIPS, MELEE_GRIP, THROWABLE_SIZE, THROWABLE_ART } from '../data/rigs.js';
import { WEAPONS } from '../data/weapons.js';
import { blendColor } from '../ui/color.js';

const LIMBS = ['back-upper-arm', 'back-forearm', 'back-thigh', 'back-shin'];
export const partKey = (folder, part) => `spr-${folder}-${part}`;
export const gunKey = (key) => `spr-gun-${key}`;
export const meleeKey = (key) => `spr-melee-${key}`;
export const throwKey = (key) => `spr-throw-${THROWABLE_ART[key] ?? key}`;

// Draws a character (you or a bot) from its cut body parts instead of a
// square, and poses it every frame from what the character is doing:
// standing, running, flying, falling, aiming at its target, typing.
// The character itself (a Player) keeps its invisible physics box; the
// rig just follows it. Built only for characters that have packed art.
export default class CharacterRig {
  // Which folder a character uses, if its art is packed (else null).
  static folderFor(name) {
    const folder = RIG_FOLDERS[name];
    return folder && SPRITES.characters[folder] ? folder : null;
  }

  constructor(scene, owner, folder) {
    this.scene = scene;
    this.owner = owner;
    this.folder = folder;
    this.parts = SPRITES.characters[folder].parts;
    const o = OVERRIDES[folder] ?? {};
    this.torsoAt = { ...RIG.torso, ...(o.torso ?? {}) };
    this.headAt = { ...RIG.head, ...(o.head ?? {}) };
    this.packAt = { ...RIG.jetpack, ...(o.jetpack ?? {}) };
    this.phase = 0;
    this.images = [];
    this.heldKey = null;
    this.build();
  }

  // ---- Building ----

  image(part, x = 0, y = 0, origin = null) {
    const p = this.parts[part];
    const img = this.scene.add.image(x, y, partKey(this.folder, part));
    img.setOrigin(...(origin ?? [p.top[0] / p.w, p.top[1] / p.h]));
    img.baseTint = LIMBS.includes(part) ? RIG.backTint : 0xffffff;
    this.images.push(img);
    return img;
  }

  // Upper part + lower part, joined at the middle joint (elbow or knee).
  limb(upper, lower, at, hand = false) {
    const U = this.parts[upper];
    const L = this.parts[lower];
    const root = this.scene.add.container(at[0], at[1]);
    const joint = this.scene.add.container(U.bot[0] - U.top[0], U.bot[1] - U.top[1]);
    const end = hand ? this.scene.add.container(L.bot[0] - L.top[0], L.bot[1] - L.top[1]) : null;
    if (end) joint.add(end); // the held weapon sits under the fist
    joint.add(this.image(lower));
    root.add([this.image(upper), joint]);
    return { root, joint, end };
  }

  build() {
    const s = this.scene;
    const T = this.parts.torso;
    const A = this.torsoAt;
    const hip = [T.w * A.hip[0], T.h * A.hip[1]];
    const at = (f) => [T.w * f[0] - hip[0], T.h * f[1] - hip[1]];

    this.root = s.add.container(0, 0).setDepth(RIG.depth);
    this.backArm = this.limb('back-upper-arm', 'back-forearm', at(A.shoulderBack));
    this.backLeg = this.limb('back-thigh', 'back-shin', at(A.hipBack));
    this.frontLeg = this.limb('front-thigh', 'front-shin', at(A.hipFront));
    this.frontArm = this.limb('front-upper-arm', 'front-forearm', at(A.shoulderFront), true);
    this.torso = this.image('torso', 0, 0, A.hip);

    const H = this.parts.head;
    this.head = this.image('head', ...at(A.neck), this.headAt.neck).setScale(this.headAt.scale);

    // Jetpack (or nothing: machines fly on boot thrusters) with its flame.
    this.pack = null;
    this.flame = null;
    if (this.parts.jetpack) {
      const J = this.parts.jetpack;
      const P = this.packAt;
      this.pack = s.add.container(...at(A.back));
      const img = this.image('jetpack', 0, 0, P.strap);
      img.baseTint = 0xffffff;
      this.pack.add(img);
      if (this.parts['jet-flame']) {
        const F = this.parts['jet-flame'];
        this.flame = this.image('jet-flame', J.w * (P.nozzle[0] - P.strap[0]), J.h * (P.nozzle[1] - P.strap[1]), [0.5, 0.04]);
        this.flame.baseTint = 0xffffff;
        this.pack.addAt(this.flame, 0); // behind the pack
      }
    }

    this.held = s.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.frontArm.end.add(this.held);

    const back = [this.backArm.root, this.backLeg.root];
    this.root.add([...back, ...(this.pack ? [this.pack] : []), this.torso, this.head, this.frontLeg.root, this.frontArm.root]);

    // Size: the drawn height (feet to the top of the head) is heightScale x the hitbox.
    const leg = this.parts['front-thigh'];
    const shin = this.parts['front-shin'];
    this.legLength = leg.bot[1] - leg.top[1] + (shin.h - shin.top[1]) - 4;
    const neckY = at(A.neck)[1];
    const headTop = neckY - H.h * this.headAt.neck[1] * this.headAt.scale;
    this.standHeight = this.legLength - headTop;
    this.resize();
  }

  resize() {
    this.drawHeight = this.owner.height * RIG.heightScale;
    this.scale = this.drawHeight / this.standHeight;
  }

  // ---- Every frame ----

  update(delta) {
    const o = this.owner;
    const visible = o.alive && o.visible !== false && !o.hidden;
    this.root.setVisible(o.alive);
    if (!o.alive) return;
    this.root.setAlpha(o.hidden && o === this.scene.player ? 0.45 : 1); // you, hiding in a bush or under water: faint
    // The physics box stays, but you don't see it.
    o.isFilled = false;
    o.isStroked = false;

    const now = this.scene.time.now;
    const dt = delta / 1000;
    const vx = o.body.velocity.x;
    const ground = o.onGround;
    const R = RIG;
    let pose;
    let lean;
    let bob = 0;
    if (ground && Math.abs(vx) > 20 && !o.typing) {
      this.phase += Math.abs(vx) * dt * R.run.stride;
      const sw = Math.sin(this.phase);
      pose = {
        thighF: R.run.swing * sw, thighB: -R.run.swing * sw,
        shinF: 6 + R.run.knee * Math.max(0, -Math.cos(this.phase)), shinB: 6 + R.run.knee * Math.max(0, Math.cos(this.phase)),
      };
      lean = R.run.lean;
      bob = -R.run.bob * Math.abs(Math.sin(this.phase));
    } else if (!ground && o.thrusting) {
      pose = R.fly;
      lean = R.fly.lean;
    } else if (!ground) {
      pose = R.fall;
      lean = R.fall.lean;
    } else {
      pose = R.stand;
      lean = R.stand.lean;
      bob = Math.sin(now / 600) * 0.8; // breathing
    }
    const facing = o.facing ?? 1;
    const ease = 1 - Math.pow(0.0001, dt); // smooth into new poses
    const turn = (obj, deg) => {
      obj.angle += (deg - obj.angle) * Math.min(1, ease * 2.2);
    };
    turn(this.frontLeg.root, pose.thighF);
    turn(this.frontLeg.joint, pose.shinF);
    turn(this.backLeg.root, pose.thighB);
    turn(this.backLeg.joint, pose.shinB);
    turn(this.torso, lean);

    // Arms: point the held weapon at the target (or a little down).
    const aim = this.aimDeg(facing);
    const melee = this.updateHeld();
    const A = R.aim;
    const a1 = aim - 90 + A.upperF;
    const a2 = A.foreF;
    turn(this.frontArm.root, melee ? -30 : a1);
    turn(this.frontArm.joint, melee ? -40 : a2);
    this.held.angle = melee ? R.melee.holdDeg : aim - this.frontArm.root.angle - this.frontArm.joint.angle;
    turn(this.backArm.root, (melee ? 10 : aim - 90 + A.upperB));
    turn(this.backArm.joint, melee ? -20 : A.foreB);
    turn(this.head, Phaser.Math.Clamp(aim * A.headFollow, -14, 14));

    // Jet flame: on while thrusting, flickering.
    if (this.flame) {
      this.flame.setVisible(o.thrusting);
      if (o.thrusting) this.flame.setScale(Phaser.Math.FloatBetween(0.85, 1.15), Phaser.Math.FloatBetween(0.75, 1.2));
    }

    // Place it: feet on the bottom of the physics box, flipped to face the way it faces.
    if (this.drawHeight !== o.height * R.heightScale) this.resize();
    this.root.setScale(this.scale * facing, this.scale);
    this.root.setPosition(o.x, o.body.bottom - this.legLength * this.scale + bob * this.scale);
    this.updateTint(visible);
  }

  // The direction the weapon points (degrees, 0 = straight ahead, + = down),
  // in the rig's own frame (so it works the same facing left or right).
  aimDeg(facing) {
    const o = this.owner;
    const t = o.aimTarget?.();
    let deg = RIG.aim.restDeg;
    if (t) {
      const dx = (t.x - o.x) * facing;
      const dy = t.y - (o.y - o.height * 0.15);
      if (dx > -10) deg = Phaser.Math.RadToDeg(Math.atan2(dy, Math.max(1, dx)));
    }
    return Phaser.Math.Clamp(deg, ...RIG.aim.clamp);
  }

  // The weapon in hand: its sprite, size and grip. True if it's melee.
  updateHeld() {
    // Aiming a throw: the throwable is in the hand instead.
    const thrown = this.owner.heldThrowable?.();
    if (thrown) {
      if (this.heldKey !== `throw:${thrown}`) {
        this.heldKey = `throw:${thrown}`;
        const tex = throwKey(thrown);
        this.held.setVisible(this.scene.textures.exists(tex));
        if (this.held.visible) {
          this.held.setTexture(tex).setOrigin(0.5, 0.5);
          this.held.setScale((THROWABLE_SIZE * this.standHeight) / Math.max(this.held.width, this.held.height));
        }
      }
      return false;
    }
    const key = this.owner.heldWeapon?.();
    const w = key && WEAPONS[key];
    if (key !== this.heldKey) {
      this.heldKey = key;
      const melee = w?.category === 'melee';
      const tex = w && (melee ? meleeKey(key) : gunKey(key));
      if (!w || w.natural || !this.scene.textures.exists(tex)) {
        this.held.setVisible(false);
      } else {
        this.held.setTexture(tex).setVisible(true);
        const length = (melee ? MELEE_LENGTH[key] ?? 0.45 : WEAPON_LENGTH[w.category] ?? 0.5) * this.standHeight;
        // The rig is scaled as a whole, so a weapon is sized in the rig's own units.
        this.held.setScale(length / this.held.width);
        this.held.setOrigin(...(melee ? MELEE_GRIP : GRIPS[key] ?? [0.3, 0.6]));
        // Undo the forearm's own scale (none) and keep it upright in the hand.
      }
    }
    return w?.category === 'melee';
  }

  // Hit flash (white), clouds (smoke and gas tint you), otherwise normal.
  updateTint() {
    const o = this.owner;
    const flash = o.flashing;
    const env = o.envTint;
    if (flash === this.lastFlash && env === this.lastEnv) return;
    this.lastFlash = flash;
    this.lastEnv = env;
    for (const img of this.images) {
      if (flash) img.setTintFill(0xffffff);
      else if (env) img.setTint(blendColor(img.baseTint, env.color, env.strength));
      else img.setTint(img.baseTint);
    }
    this.held.clearTint();
  }

  destroy() {
    this.root.destroy();
  }
}
