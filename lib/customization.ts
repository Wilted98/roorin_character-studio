import * as THREE from 'three';

export type Gender = 'GF' | 'GM';
export type ControlGroup = 'face' | 'eyes' | 'nose' | 'mouth' | 'ears' | 'body';
export interface CustomizationControl {
  id: string;
  label: string;
  group: ControlGroup;
  kind: 'face' | 'body';
  min: number;
  max: number;
  mid: number;
  reversed: boolean;
  bindings?: { pose: string; side: 'positive' | 'negative' }[];
  operation?: 'uniform' | 'length' | 'thickness';
  bones?: string[];
  approximate?: boolean;
}
export interface PoseDelta {
  bone: string;
  t: [number, number, number];
  q: [number, number, number, number];
  s: [number, number, number];
}
export interface CustomizationPreset {
  id: string;
  label: string;
  values: Record<string, number>;
  sourceHead?: unknown;
  note?: string;
}
export interface CustomizationData {
  version: number;
  coordinateSpace?: string;
  genders: Record<Gender, {
    controls: CustomizationControl[];
    poses: Record<string, PoseDelta[]>;
    presets: CustomizationPreset[];
    unsupported?: {id: string; reason: string; poses: string[]}[];
  }>;
}

interface RestState {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  lengthAxis: number;
}
const restStates = new WeakMap<THREE.Object3D, RestState>();

export function getControls(data: CustomizationData, gender: Gender): CustomizationControl[] {
  return data.genders[gender].controls;
}
export function getDefaultValues(data: CustomizationData, gender: Gender): Record<string, number> {
  return Object.fromEntries(getControls(data, gender).map(c => [c.id, c.mid]));
}

function restFor(node: THREE.Object3D): RestState {
  let rest = restStates.get(node);
  if (!rest) {
    // UE bones in this import often point along local X; do not assume Blender Y.
    const child = node.children.find(c => (c as THREE.Bone).isBone && c.position.lengthSq() > 1e-10);
    const p = child?.position ?? new THREE.Vector3(1, 0, 0);
    const components = [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)];
    const lengthAxis = components.indexOf(Math.max(...components));
    rest = {position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), lengthAxis};
    restStates.set(node, rest);
  }
  return rest;
}

/**
 * Apply source face PoseAsset deltas plus explicitly approximate body bone controls.
 * The generated GLB's LOCAL bones retain Blender axes (verified against asset-bone-rest.json).
 * Only Unreal->Blender mirror Y is applied here; Y-up is already on the GLB armature parent.
 * Roots must include each modular body/head/hair model so shared anatomical bones move together.
 */
export function applyCustomization(
  roots: THREE.Object3D[], data: CustomizationData, gender: Gender,
  values: Record<string, number>,
): void {
  const bones = new Map<string, THREE.Object3D[]>();
  const seen = new Set<THREE.Object3D>();
  for (const root of roots) {
    root.traverse(node => {
      if (!(node as THREE.Bone).isBone || seen.has(node)) return;
      seen.add(node);
      const rest = restFor(node);
      node.position.copy(rest.position);
      node.quaternion.copy(rest.quaternion);
      node.scale.copy(rest.scale);
      const name = String(node.userData.sourceBoneName ?? node.name);
      const list = bones.get(name) ?? [];
      list.push(node); bones.set(name, list);
    });
  }
  const config = data.genders[gender];
  const poseWeights = new Map<string, number>();
  for (const control of config.controls) {
    if (control.kind !== 'face') continue;
    const supplied = values[control.id];
    const value = THREE.MathUtils.clamp(Number.isFinite(supplied) ? supplied : control.mid, control.min, control.max);
    // Source ranges and presets are already expressed in curve-weight units.
    // Negative half selects the negative pose with a positive magnitude.
    for (const binding of control.bindings ?? []) {
      const weight = binding.side === 'positive' ? Math.max(0, value) : Math.max(0, -value);
      if (weight) poseWeights.set(binding.pose, (poseWeights.get(binding.pose) ?? 0) + weight);
    }
  }
  const identity = new THREE.Quaternion();
  const deltaQuaternion = new THREE.Quaternion();
  const weightedQuaternion = new THREE.Quaternion();
  for (const [pose, weight] of poseWeights) {
    for (const delta of config.poses[pose] ?? []) {
      // Reflection-conjugated rotation: (x,-y,z,-w) == (-x,y,-z,w).
      deltaQuaternion.set(-delta.q[0], delta.q[1], -delta.q[2], delta.q[3]).normalize();
      weightedQuaternion.copy(identity).slerp(deltaQuaternion, weight);
      for (const node of bones.get(delta.bone) ?? []) {
        node.position.x += delta.t[0] * 0.01 * weight;
        node.position.y -= delta.t[1] * 0.01 * weight;
        node.position.z += delta.t[2] * 0.01 * weight;
        node.quaternion.premultiply(weightedQuaternion).normalize();
        // Unreal additive scales are offsets from zero, NOT absolute scales.
        node.scale.x *= Math.max(0.05, 1 + delta.s[0] * weight);
        node.scale.y *= Math.max(0.05, 1 + delta.s[1] * weight);
        node.scale.z *= Math.max(0.05, 1 + delta.s[2] * weight);
      }
    }
  }
  for (const control of config.controls) {
    if (control.kind !== 'body') continue;
    const supplied = values[control.id];
    const value = THREE.MathUtils.clamp(Number.isFinite(supplied) ? supplied : control.mid, control.min, control.max);
    const ratio = control.mid !== 0 ? value / control.mid : 1 + value;
    for (const name of control.bones ?? []) {
      for (const node of bones.get(name) ?? []) {
        const rest = restFor(node);
        if (control.operation === 'uniform') node.scale.multiplyScalar(ratio);
        else for (let axis=0; axis<3; axis++) {
          const affect = control.operation === 'length' ? axis === rest.lengthAxis : axis !== rest.lengthAxis;
          if (affect) node.scale.setComponent(axis, node.scale.getComponent(axis) * ratio);
        }
      }
    }
  }
  for (const root of roots) root.updateMatrixWorld(true);
}

/** Drop cached rest state only when re-binding or intentionally changing the neutral model. */
export function forgetCustomizationRest(root: THREE.Object3D): void {
  root.traverse(node => restStates.delete(node));
}
