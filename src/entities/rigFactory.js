import CharacterRig from './CharacterRig.js';
import { DroneRig, K9Rig } from './CreatureRigs.js';

// Which rig draws a sprite folder: people share CharacterRig; the drone
// and the dog have their own.
const KINDS = { drone: DroneRig, k9: K9Rig };

export function makeRig(scene, owner, folder) {
  const Kind = KINDS[folder] ?? CharacterRig;
  return new Kind(scene, owner, folder);
}
