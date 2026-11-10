import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyCustomization,getDefaultValues} from '../lib/customization.ts';
import {posedBounds,frameCharacter} from '../lib/camera-framing.ts';
globalThis.ProgressEvent=class{};
const read=name=>JSON.parse(readFileSync(new URL('../public/assets/'+name,import.meta.url)));
const data=read('customization.json'),catalog=read('appearance.json');
async function load(file){
 const b=readFileSync(new URL('../public/assets/models/'+file,import.meta.url)),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n));
 j.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(28+n).toString('base64');delete j.images;delete j.textures;
 for(const m of j.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.extensions;delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}
 return(await new GLTFLoader().parseAsync(JSON.stringify(j),'')).scene;
}
function sample(roots,gender,values){applyCustomization(roots,data,gender,values);const result=[],p=new THREE.Vector3();for(const root of roots)root.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i+=7){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);result.push(...p)}});return result;}
for(const gender of ['GF','GM']){
 const sex=gender.toLowerCase(),roots=await Promise.all([load(sex+'-body.glb'),load(sex+'-head-001.glb')]);
 const defaults=getDefaultValues(data,gender),neutral=sample(roots,gender,defaults);let changed=0;
 for(const c of data.genders[gender].controls.filter(c=>c.operation!=='material')){
  let displacement=0;
  for(const endpoint of [c.min,c.max]){const output=sample(roots,gender,{...defaults,[c.id]:endpoint});assert(output.every(Number.isFinite),c.id);for(let i=0;i<output.length;i++)displacement=Math.max(displacement,Math.abs(output[i]-neutral[i]));}
  assert(displacement>1e-7,`${gender} ${c.id}: bones must deform visible weighted vertices`);changed++;
 }
 sample(roots,gender,defaults);const body=posedBounds(roots[0]),head=posedBounds(roots[1]);body.union(head);
 for(const aspect of [.45,.8,1.5,2])for(const mode of ['body','upper','face']){
  const frame=frameCharacter(body,head,mode,aspect,32),camera=new THREE.PerspectiveCamera(32,aspect,.01,100);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
  const bounds=mode==='face'?head:body.clone();if(mode==='upper')bounds.min.y=body.min.y+(body.max.y-body.min.y)*.48;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);assert(Math.abs(p.x)<1&&Math.abs(p.y)<1,`${gender} ${mode} ${aspect} clips`);}
 }
 const source=catalog.genders[gender].presets;
 for(const p of source){for(const [key,value] of Object.entries(p.sourceMaterialValues)){const expected=value?.Hex?'#'+value.Hex.slice(0,6):value;if(typeof expected==='string'||typeof expected==='number')assert.deepEqual(p.appearance[key],expected,`${p.id}: complete material ${key}`);}}
 console.log(`${gender}: ${changed} controls deform actual weighted mesh vertices; camera fits 4 aspect ratios; all preset material fields preserved.`);
}
