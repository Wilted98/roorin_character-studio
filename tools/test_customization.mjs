import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {applyCustomization, getControls, getDefaultValues} from '../lib/customization.ts';

const data=JSON.parse(readFileSync(new URL('../public/assets/customization.json',import.meta.url)));
function skeletonFromGLB(relative){
  const bytes=readFileSync(new URL(relative,import.meta.url));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const joints=new Set(json.skins.flatMap(s=>s.joints));
  const nodes=json.nodes.map((n,i)=>{
    const o=joints.has(i)?new THREE.Bone():new THREE.Object3D();o.name=n.name??'';
    if(n.translation)o.position.fromArray(n.translation);
    if(n.rotation)o.quaternion.fromArray(n.rotation);
    if(n.scale)o.scale.fromArray(n.scale);
    if(n.matrix)new THREE.Matrix4().fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);
    o.userData=n.extras??{};return o;
  });
  json.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>nodes[i].add(nodes[c])));
  const scene=new THREE.Group();json.scenes[json.scene??0].nodes.forEach(i=>scene.add(nodes[i]));
  return scene;
}
function state(roots){
  const values=[];for(const root of roots)root.traverse(n=>{if(n.isBone)values.push(...n.position,...n.quaternion,...n.scale)});return values;
}
for(const gender of ['GF','GM']){
  const g=gender.toLowerCase();
  const roots=[skeletonFromGLB(`../public/assets/models/${g}-body.glb`),skeletonFromGLB(`../public/assets/models/${g}-head-001.glb`),skeletonFromGLB(`../public/assets/models/${g}-hair-001.glb`)];
  const defaults=getDefaultValues(data,gender);applyCustomization(roots,data,gender,defaults);
  const neutral=state(roots);assert(neutral.every(Number.isFinite));
  let verified=0;
  for(const control of getControls(data,gender)){
    let changed=false;
    for(const value of [control.min,control.max]){
      const values={...defaults,[control.id]:value};
      applyCustomization(roots,data,gender,values);
      const end=state(roots);assert(end.every(Number.isFinite),`${gender} ${control.id} finite`);
      changed ||= end.some((v,i)=>Math.abs(v-neutral[i])>1e-8);
      applyCustomization(roots,data,gender,values);
      assert.deepEqual(state(roots),end,`${gender} ${control.id} idempotent`);
      applyCustomization(roots,data,gender,defaults);
      assert.deepEqual(state(roots),neutral,`${gender} ${control.id} reset`);
    }
    assert(changed,`${gender} ${control.id} must affect an actual imported bone`);verified++;
  }
  for(const p of data.genders[gender].presets){
    applyCustomization(roots,data,gender,{...defaults,...p.values});assert(state(roots).every(Number.isFinite));
  }
  console.log(`${gender}: ${verified} controls affect actual GLB skeletons; finite endpoints, stable reapplication, exact reset; ${data.genders[gender].presets.length} presets finite.`);
}
