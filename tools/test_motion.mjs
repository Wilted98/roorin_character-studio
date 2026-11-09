import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import ts from 'typescript';
async function loadModule(name){const raw=readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8');let code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replaceAll("'three'",JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
const {CharacterMotion,sampleKeys}=await loadModule('character-motion');
const {HairPhysics}=await loadModule('hair-physics');
const read=name=>JSON.parse(readFileSync(new URL('../public/assets/'+name,import.meta.url)));
const physics=read('hair-physics.json');
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

assert.deepEqual(sampleKeys({times:[0,1],values:[0,0,0,2,4,6]},.25,3,[]),[.5,1,1.5]);
for(const gender of ['GF','GM']){
 const g=gender.toLowerCase();const roots=[skeletonFromGLB(`../public/assets/models/${g}-body.glb`),skeletonFromGLB(`../public/assets/models/${g}-head-001.glb`),skeletonFromGLB(`../public/assets/models/${g}-hair-201.glb`)];
 const motion=new CharacterMotion(roots);motion.capture();const rest=state(roots);
 const spring=new HairPhysics(roots[2],physics,gender,'201');
 for(const kind of ['creator-idle','normal-idle']){
  motion.setClip(read(`animations/${g}-${kind}.json`));motion.update(0,false);const start=state(roots);
  let hasSecondaryMotion=false;for(let f=0;f<600;f++){motion.update(1/60,false);const primary=state([roots[2]]);spring.update(1/60,false);hasSecondaryMotion ||= state([roots[2]]).some((v,i)=>Math.abs(v-primary[i])>1e-6);assert(state(roots).every(Number.isFinite),'finite animated and simulated bones');}
  assert(hasSecondaryMotion,'hair springs produce secondary motion');motion.update(0,true);const paused=state(roots);assert(paused.some((v,i)=>Math.abs(v-start[i])>1e-5),'native time-varying animation');
  motion.update(1/60,true);assert.deepEqual(state(roots),paused,'pause freezes pose');
  motion.update(0,true);spring.reset();spring.update(0,true);const stationary=state(roots);assert(stationary.every(Number.isFinite));
 }
 motion.setClip(null);motion.update(0,false);assert.deepEqual(state(roots),rest,'still resets without accumulated drift');
 console.log(gender+': two native animations, pause, still/reset and 1200 frames of spring stability pass.');
}
