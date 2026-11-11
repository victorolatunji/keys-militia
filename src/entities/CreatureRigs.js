import Phaser from 'phaser';
import CharacterRig from './CharacterRig.js';
import { RIG, DRONE_RIG, K9_RIG } from '../data/rigs.js';

// The two characters that aren't built like a person. Both reuse
// CharacterRig's tints, hit flash, held weapon and death scatter, and swap
// in their own parts and poses.

// Drone: a body with a rotor arm either side (spinning rotors on the
// pods) and a claw under it that holds the gun and turns to aim. It
// hovers with a little bob and tilts the way it flies.
export class DroneRig extends CharacterRig {
  build() {
    const s = this.scene;
    const D = DRONE_RIG;
    const P = this.parts;
    const B = P.body;
    const at = (f) => [B.w * (f[0] - 0.5), B.h * (f[1] - 0.5)]; // from the body's middle
    this.root = s.add.container(0, 0).setDepth(RIG.depth);

    const arm = (key, side) => {
      const A = P[`${side}-rotor-arm`];
      const c = s.add.container(...at(D.armAt[side]));
      const img = this.image(`${side}-rotor-arm`, 0, 0, D.armJoint[side]);
      if (side === 'back') img.baseTint = RIG.backTint;
      const rotor = this.image('rotor', A.w * (D.rotorAt[side][0] - D.armJoint[side][0]), A.h * (D.rotorAt[side][1] - D.armJoint[side][1]), [0.5, 0.5]);
      rotor.baseTint = 0xffffff;
      c.add([img, rotor]);
      return { c, rotor };
    };
    this.backArm = arm('back-rotor-arm', 'back');
    this.mount = s.add.container(...at(D.mountAt));
    const mount = this.image('gun-mount', 0, 0, [0.5, 0.06]);
    this.held = s.add.image(0, P['gun-mount'].h * 0.62, '__DEFAULT').setVisible(false);
    this.mount.add([this.held, mount]); // the claw grips over the gun
    this.body = this.image('body', 0, 0, [0.5, 0.5]);
    this.frontArm = arm('front-rotor-arm', 'front');
    this.root.add([this.backArm.c, this.mount, this.body, this.frontArm.c]);

    this.standHeight = B.h * 1.25; // weapons are sized from this
    this.legLength = 0;
    this.resize();
  }

  resize() {
    const width = this.parts.body.w * DRONE_RIG.widthOverBody;
    this.scale = (this.owner.width * DRONE_RIG.drawWidth) / width;
    this.drawHeight = this.parts.body.h * this.scale * 0.75 + this.owner.height / 2; // the top of its antenna
  }

  update(delta) {
    const o = this.owner;
    this.root.setVisible(o.alive);
    if (!o.alive) return;
    o.isFilled = false;
    o.isStroked = false;
    const now = this.scene.time.now;
    const facing = o.facing ?? 1;
    // Rotors: a fast blur (squashing the flat rotor back and forth reads as spinning).
    const spin = Math.cos(now / 22);
    this.backArm.rotor.scaleX = spin;
    this.frontArm.rotor.scaleX = -spin;
    // The claw turns toward its target; the gun points straight at it.
    const aim = this.aimDeg(facing);
    this.updateHeld();
    const turn = Phaser.Math.Clamp((aim - RIG.aim.restDeg) * 0.6, -50, 50);
    this.mount.angle += (turn - this.mount.angle) * 0.25;
    this.held.angle = aim - this.mount.angle;
    if (this.drawWidth !== o.width) {
      this.drawWidth = o.width;
      this.resize();
    }
    const tilt = Phaser.Math.Clamp(o.body.velocity.x * DRONE_RIG.tilt, -14, 14);
    this.root.angle += (tilt - this.root.angle) * 0.15;
    this.root.setScale(this.scale * facing, this.scale);
    this.root.setPosition(o.x, o.y + Math.sin(now / 260) * 2);
    this.updateTint();
  }

  // A drone holds its gun in the claw (no grip needed): centred.
  updateHeld() {
    const before = this.heldKey;
    const melee = super.updateHeld();
    if (this.heldKey !== before && this.held.visible) this.held.setOrigin(0.4, 0.5);
    return melee;
  }
}

// Zombie K9: a body, a head with a separate jaw that snaps open to bite,
// a wagging tail and four legs (two parts each; the far side drawn
// darker). It trots, sprints, leaps with its legs stretched out, and
// snarls with its jaw half open.
export class K9Rig extends CharacterRig {
  build() {
    const s = this.scene;
    const K = K9_RIG;
    const P = this.parts;
    const B = P.body;
    const at = (f) => [B.w * (f[0] - 0.5), B.h * (f[1] - 0.5)];
    this.root = s.add.container(0, 0).setDepth(RIG.depth);

    const leg = (upper, lower, f, far) => {
      const l = this.limb(upper, lower, at(f));
      if (far) for (const img of l.root.list.concat(l.joint.list)) if (img.baseTint !== undefined) img.baseTint = RIG.backTint;
      return l;
    };
    this.tail = this.image('tail', ...at(K.tailAt), K.tailBase);
    this.backFar = leg('back-far-thigh', 'back-far-lower', K.hipFar, true);
    this.frontFar = leg('front-far-upper', 'front-far-lower', K.shoulderFar, true);
    this.body = this.image('body', 0, 0, [0.5, 0.5]);
    this.backNear = leg('back-near-thigh', 'back-near-lower', K.hipNear, false);
    this.frontNear = leg('front-near-upper', 'front-near-lower', K.shoulderNear, false);
    const H = P.head;
    this.headC = s.add.container(...at(K.neckAt));
    this.jaw = this.image('lower-jaw', H.w * (K.jawAt[0] - K.headNeck[0]), H.h * (K.jawAt[1] - K.headNeck[1]), K.jawHinge);
    this.head = this.image('head', 0, 0, K.headNeck);
    this.headC.add([this.jaw, this.head]);
    for (const img of this.images) img.baseTint ??= 0xffffff;
    this.held = s.add.image(0, 0, '__DEFAULT').setVisible(false); // dogs carry nothing

    this.root.add([this.tail, this.backFar.root, this.frontFar.root, this.body, this.backNear.root, this.frontNear.root, this.headC]);

    const U = P['front-near-upper'];
    const L = P['front-near-lower'];
    this.legLength = U.bot[1] - U.top[1] + (L.h - L.top[1]);
    this.shoulderY = at(K.shoulderNear)[1];
    this.standHeight = this.legLength + this.shoulderY - (at(K.neckAt)[1] - H.h * K.headNeck[1]);
    this.resize();
  }

  resize() {
    this.scale = (this.owner.width * K9_RIG.drawWidth) / this.parts.body.w;
    this.drawHeight = this.standHeight * this.scale;
  }

  update(delta) {
    const o = this.owner;
    this.root.setVisible(o.alive);
    if (!o.alive) return;
    o.isFilled = false;
    o.isStroked = false;
    const K = K9_RIG;
    const now = this.scene.time.now;
    const dt = delta / 1000;
    const facing = o.facing ?? 1;
    const vx = Math.abs(o.body.velocity.x);
    const ground = o.onGround;
    let legs;
    let lean = 0;
    if (!ground) {
      legs = K.leap; // stretched out mid-leap
      lean = Phaser.Math.Clamp(o.body.velocity.y * 0.03, -12, 12);
    } else if (vx > 15) {
      this.phase += vx * dt * K.stride;
      const a = Math.sin(this.phase);
      const b = Math.sin(this.phase + Math.PI);
      const sw = K.swing * Math.min(1, vx / 120);
      legs = {
        fn: [-sw * a, K.knee * Math.max(0, a)], ff: [-sw * b, K.knee * Math.max(0, b)],
        bn: [sw * b, -K.knee * 0.6 * Math.max(0, -b)], bf: [sw * a, -K.knee * 0.6 * Math.max(0, -a)],
      };
    } else {
      legs = K.stand;
    }
    const ease = Math.min(1, (1 - Math.pow(0.0001, dt)) * 2.2);
    const turn = (obj, deg) => (obj.angle += (deg - obj.angle) * ease);
    for (const [name, l] of [['fn', this.frontNear], ['ff', this.frontFar], ['bn', this.backNear], ['bf', this.backFar]]) {
      turn(l.root, legs[name][0]);
      turn(l.joint, legs[name][1]);
    }
    turn(this.body, lean);
    // Jaw: half open (snarling), wide open for a moment when it bites.
    const biting = now - (o.lastSwingAt ?? -1e9) < K.biteMs;
    turn(this.jaw, biting ? K.jawBite : K.jawSnarl + Math.sin(now / 180) * 3);
    turn(this.headC, Phaser.Math.Clamp(this.aimDeg(facing) * 0.25, -14, 14));
    this.tail.angle = Math.sin(now / (vx > 15 ? 90 : 220)) * K.tailWag;
    if (this.drawWidth !== o.width) {
      this.drawWidth = o.width;
      this.resize();
    }
    this.root.setScale(this.scale * facing, this.scale);
    this.root.setPosition(o.x, o.body.bottom - (this.legLength + this.shoulderY) * this.scale);
    this.updateTint();
  }
}
