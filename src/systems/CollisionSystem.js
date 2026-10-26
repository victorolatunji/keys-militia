// Object-vs-object collisions in one place. Terrain colliders stay with
// each object (they only need the ground layer).
//
// Rules (README section 4):
// - Characters (player, dummies, later bots) are solid to each other.
// - Landed crates are solid to everything. Falling or tipping crates pass
//   through characters, so a crate can't land on your head.
// - Crates stack on crates.
// - Grenades bounce off crates and characters, but ignore whoever threw
//   them for a moment so they don't hit the thrower on the way out.
//
// Groups are plain Phaser groups: one collider covers every member,
// including ones added later. Destroyed objects leave the group by themselves.
export default class CollisionSystem {
  constructor(scene) {
    this.scene = scene;
    const physics = scene.physics;

    this.characters = scene.add.group();
    this.crates = scene.add.group();
    this.grenades = scene.add.group();

    physics.add.collider(this.characters, this.characters);
    physics.add.collider(this.crates, this.crates);
    physics.add.collider(this.crates, this.characters, null, this.crateIsSolid, this);
    physics.add.collider(this.grenades, this.crates);
    physics.add.collider(this.grenades, this.characters, null, this.grenadeCanHit, this);
  }

  addCharacter(obj) {
    this.characters.add(obj);
  }

  addCrate(crate) {
    this.crates.add(crate);
  }

  addGrenade(grenade) {
    this.grenades.add(grenade);
  }

  // Process callbacks: return false to skip the collision this frame.
  crateIsSolid(crate) {
    return crate.settled;
  }

  grenadeCanHit(grenade, character) {
    return !(character === grenade.owner && this.scene.time.now < grenade.ignoreOwnerUntil);
  }
}