import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const read=name=>JSON.parse(readFileSync(path.join(root,'assets',name),'utf8'));
const appearance=read('appearance.json'),custom=read('customization.json'),catalog=read('characters.json');
const checked=new Set();
function checkGLB(url){
 if(checked.has(url))return;checked.add(url);
 const file=path.join(root,url.replace(/^\//,'')),bytes=readFileSync(file);
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength));
 const binary=bytes.subarray(28+jsonLength);
 assert.ok(doc.buffers[0].byteLength<=binary.length);
 for(const view of doc.bufferViews)assert.ok((view.byteOffset??0)+view.byteLength<=doc.buffers[0].byteLength);
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 const sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
 for(const accessor of doc.accessors){
  if(accessor.bufferView===undefined)continue;
  const view=doc.bufferViews[accessor.bufferView],size=sizes[accessor.componentType]*components[accessor.type];
  assert.ok(view);assert.ok((accessor.byteOffset??0)+Math.max(0,accessor.count-1)*(view.byteStride??size)+size<=view.byteLength,`${url}: accessor bounds`);
 }
 for(const image of doc.images??[])if(image.uri)assert.ok(existsSync(path.resolve(path.dirname(file),image.uri)),`${url}: ${image.uri}`);
 if(url.includes('-hair-'))for(const material of doc.materials){
  if(material.extras?.role==='hair')assert.equal(material.extras.hairMaterialVersion,5,`${url}: current native card/cap mapping`);
  if(material.extras?.nativeName==='M_Hide')assert.equal(material.pbrMetallicRoughness.baseColorFactor[3],0);
 }
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
  const a=doc.accessors[primitive.attributes.POSITION];assert.ok(a.count>0);
  if(a.componentType!==5126)continue;
  const view=doc.bufferViews[a.bufferView],offset=(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??12;
  for(let i=0;i<a.count;i++)for(let c=0;c<3;c++)assert.ok(Number.isFinite(binary.readFloatLE(offset+i*stride+c*4)));
 }
}
for(const gender of ['GF','GM']){
 const presets=appearance.genders[gender].presets;
 assert.equal(presets.length,gender==='GF'?46:44);
 for(const p of presets){
  assert.equal(p.thumbnailOrigin,'game');assert.ok(existsSync(path.join(root,p.thumbnail.replace(/^\//,''))));
  assert.ok(custom.genders[gender].presets.some(v=>v.id===p.id));
  for(const [key,id] of [['heads',p.head],['hair',p.hair]]){
   const asset=catalog.genders[gender][key].find(v=>v.id===id);assert.ok(asset,`${gender} preset${p.id} missing ${key}:${id}`);checkGLB(asset.url);
  }
 }
 console.log(`${gender}: ${presets.length} native presets, original icons, resolved mesh references and valid GLB geometry/textures.`);
}
assert.equal(appearance.unsupportedPresets.length,6);
console.log(`${checked.size} unique preset GLBs validated; 6 alternate dataset records preserved separately.`);
