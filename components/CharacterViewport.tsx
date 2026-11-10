'use client';
import {useEffect,useRef,useImperativeHandle,forwardRef} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {CharacterMotion,type NativeClip} from '@/lib/character-motion';
import {HairPhysics,type HairPhysicsData} from '@/lib/hair-physics';
import {posedBounds,frameCharacter} from '@/lib/camera-framing';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {applyCustomization,type CustomizationData} from '@/lib/customization';
import {applyAppearance,disposeAppearance,type AppearanceCatalog,type AppearanceSettings} from '@/lib/appearance-materials';
import type {CharacterCatalog,StudioState} from '@/lib/studio-types';
type Lighting={presets:Record<string,{environment:string;environmentIntensity:number;exposure:number;lights:Record<string,{color:string;intensity:number;offset:[number,number,number]}>}>};
const cachedJSON=new Map<string,Promise<any>>();
function jsonAsset<T>(url:string):Promise<T>{if(!cachedJSON.has(url))cachedJSON.set(url,fetch(url).then(r=>{if(!r.ok)throw Error(`Could not load ${url}`);return r.json()}).catch(e=>{cachedJSON.delete(url);throw e}));return cachedJSON.get(url)!;}
const idleClip=(s:StudioState)=>s.motion==='still'?Promise.resolve(null):jsonAsset<NativeClip>(`/assets/animations/${s.gender.toLowerCase()}-${s.motion}.json`);
type Focus='face'|'upper'|'body';
type Poses={genders:Record<string,Record<string,{rotation:[number,number,number,number]}>>};
function disposeModel(root:THREE.Object3D){disposeAppearance([root]);root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose();}}});}
export type ViewportApi={focus:(mode:Focus)=>void;screenshot:()=>void;rotate:()=>void};
type Props={catalog:CharacterCatalog;data:CustomizationData;appearance:AppearanceCatalog;state:StudioState;background:string;lighting:{type:string;x:number;y:number;color:string};onStatus:(s:string)=>void;onError:(s:string)=>void};
export default forwardRef<ViewportApi,Props>(function CharacterViewport({catalog,data,appearance,state,background,lighting,onStatus,onError},ref){
 const host=useRef<HTMLDivElement>(null);
 const runtime=useRef<{renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;orbit:OrbitControls;holder:THREE.Group;roots:THREE.Object3D[];hairRoot?:THREE.Object3D;beardRoot?:THREE.Object3D;height:number;focus:Focus;target:THREE.Vector3;cameraTarget:THREE.Vector3;poses:Poses|null;motion:CharacterMotion|null;physics:HairPhysics|null;lights:Record<string,THREE.DirectionalLight>}|null>(null);
 const latest=useRef({state,data,appearance,lighting,onStatus,onError});latest.current={state,data,appearance,lighting,onStatus,onError};const loadId=useRef(0);
 const setFocus=(mode:Focus)=>{
  const r=runtime.current;if(!r)return;r.focus=mode;r.holder.updateMatrixWorld(true);
  if(!r.roots[0]||!r.roots[1])return;
  const body=posedBounds(r.roots[0]),head=posedBounds(r.roots[1]);
  if(body.isEmpty()||head.isEmpty())return;body.union(head);
  if(r.hairRoot){const hair=posedBounds(r.hairRoot);head.max.y=Math.max(head.max.y,hair.max.y);body.union(hair);}
  const framed=frameCharacter(body,head,mode,r.camera.aspect,r.camera.fov);
  r.height=body.max.y-body.min.y;r.target.copy(framed.target);r.cameraTarget.copy(framed.position);
  r.orbit.minDistance=Math.max(.2,framed.distance*.35);r.orbit.maxDistance=Math.max(5,framed.distance*3);
  r.camera.position.copy(r.cameraTarget);r.orbit.target.copy(r.target);r.orbit.update();

 };
 useImperativeHandle(ref,()=>({focus:setFocus,rotate:()=>{if(runtime.current)runtime.current.orbit.autoRotate=!runtime.current.orbit.autoRotate},screenshot:()=>{const r=runtime.current;if(!r)return;r.renderer.render(r.scene,r.camera);const a=document.createElement('a');a.download=`${latest.current.state.name||'roorin-character'}.png`;a.href=r.renderer.domElement.toDataURL('image/png');a.click()}}));
 const customize=()=>{const r=runtime.current;if(!r)return;const {state:s,data:d}=latest.current;applyCustomization(r.roots,d,s.gender,s.values);const q=new THREE.Quaternion();for(const root of r.roots)root.traverse(o=>{const delta=r.poses?.genders[s.gender]?.[String(o.userData.sourceBoneName??o.name)];if(s.motion==='still'&&s.pose==='relaxed'&&delta) {q.fromArray(delta.rotation);o.quaternion.premultiply(q).normalize();}if(o instanceof THREE.Mesh&&o.morphTargetDictionary&&o.morphTargetInfluences){const key=Object.keys(o.morphTargetDictionary).find(k=>k.includes('EarShapeChange'));if(key)o.morphTargetInfluences[o.morphTargetDictionary[key]]=s.pointedEars?1:0;}});r.holder.updateMatrixWorld(true);r.motion?.capture();r.motion?.update(0,true);r.physics?.reset();};
 const paint=()=>{const r=runtime.current;if(!r)return;const s=latest.current.state;r.roots.forEach(root=>root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!(m instanceof THREE.MeshStandardMaterial))continue;if(!m.userData.originalColor)m.userData.originalColor=m.color.clone();const role=m.userData.role;if(role==='hair'){m.alphaToCoverage=true;m.alphaTest=.08;m.roughness=Number(s.appearance.HairGlossiness??.4);if(m instanceof THREE.MeshPhysicalMaterial){m.specularIntensity=.35;m.anisotropy=.7;m.anisotropyRotation=Math.PI/2;}if(m.map){m.map.anisotropy=Math.min(8,r.renderer.capabilities.getMaxAnisotropy());m.map.channel=0;m.needsUpdate=true;}}m.color.copy(m.userData.originalColor);if(role==='hair')m.color.set('#ffffff');if(role==='skin')m.color.multiply(new THREE.Color(s.skin));if(role==='beard'){m.color.set(String(s.appearance.BeardColor??s.hairColor));m.alphaToCoverage=true;m.alphaTest=.1;m.roughness=.55;}if(role==='clothing')m.color.multiply(new THREE.Color(s.dyeColor));}}));};
 useEffect(()=>{if(!host.current)return;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true})}catch{latest.current.onError('WebGL could not start. Enable hardware acceleration and reload.');return}
 const el=host.current;renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;el.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.01,100);camera.position.set(0,1.1,3.4);const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.95,0);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.minDistance=.35;orbit.maxDistance=6;orbit.maxPolarAngle=Math.PI*.57;orbit.autoRotateSpeed=.6;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.4;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xffe9d1,2);key.position.set(-2,3,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.bias=-.0005;scene.add(key);
 const fill=new THREE.DirectionalLight(0xa9c5e6,.85);fill.position.set(3,2,1);scene.add(fill);const rim=new THREE.DirectionalLight(0xb7d5eb,1.3);rim.position.set(1,3,-3);scene.add(rim);const spot=new THREE.DirectionalLight(0xffffff,.6);scene.add(spot);const lights={KeyLight:key,FillLight:fill,BackLight:rim,SpotLight:spot};for(const light of Object.values(lights)){light.target.position.set(0,1.4,0);scene.add(light.target);}
 const floor=new THREE.Mesh(new THREE.CircleGeometry(2.8,96),new THREE.ShadowMaterial({opacity:.2}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);const holder=new THREE.Group();scene.add(holder);
 runtime.current={renderer,scene,camera,orbit,holder,roots:[],height:1.8,focus:'body',target:new THREE.Vector3(0,.95,0),cameraTarget:new THREE.Vector3(0,1.1,3.2),poses:null,motion:null,physics:null,lights};
 const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(runtime.current?.roots.length)setFocus(runtime.current.focus)};resize();const observer=new ResizeObserver(resize);observer.observe(el);
 let moving=false;orbit.addEventListener('start',()=>{moving=true});orbit.addEventListener('end',()=>{moving=false;const r=runtime.current;if(r){r.cameraTarget.copy(camera.position);r.target.copy(orbit.target)}});
 let frame=0,lastTime=performance.now();const tick=()=>{frame=requestAnimationFrame(tick);const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;const r=runtime.current;if(!r)return;const active=latest.current.state;r.motion?.update(dt,active.animationPaused);if(active.physics)r.physics?.update(dt,active.animationPaused);if(!moving&&!orbit.autoRotate){camera.position.lerp(r.cameraTarget,.09);orbit.target.lerp(r.target,.09)}orbit.update();if(orbit.autoRotate){r.cameraTarget.copy(camera.position);r.target.copy(orbit.target)}renderer.render(scene,camera)};tick();
 return()=>{loadId.current++;cancelAnimationFrame(frame);observer.disconnect();orbit.dispose();runtime.current?.roots.forEach(disposeModel);floor.geometry.dispose();(floor.material as THREE.Material).dispose();env.dispose();renderer.dispose();renderer.domElement.remove();runtime.current=null}
 },[]);
 useEffect(()=>{const r=runtime.current;if(!r)return;const id=++loadId.current;const g=catalog.genders[state.gender],head=g.heads.find(x=>x.id===state.head)||g.heads[0],hair=g.hair.find(x=>x.id===state.hair)||g.hair[0];const body=g.outfits?.find(x=>x.id===state.outfit)?.url||g.body.url;const beard=g.beards?.find(x=>x.id===String(state.appearance.BeardType??'1'));const urls=[body,head.url,...(state.hair==='none'?[]:[hair.url]),...(beard?[beard.url]:[])];latest.current.onError('');latest.current.onStatus('Loading character…');const loader=new GLTFLoader();
 Promise.all([Promise.all(urls.map(url=>loader.loadAsync(url+'?v=roorin-6'))),jsonAsset<Poses>('/assets/relaxed-pose.json'),idleClip(state),jsonAsset<HairPhysicsData>('/assets/hair-physics.json')]).then(async([models,poses,clip,physics])=>{
  if(id!==loadId.current||!runtime.current){models.forEach(m=>disposeModel(m.scene));return}
  for(const root of r.roots){r.holder.remove(root);disposeModel(root)}
  r.roots=models.map(m=>m.scene);r.poses=poses;r.hairRoot=state.hair==='none'?undefined:r.roots[2];r.beardRoot=beard?r.roots.at(-1):undefined;if(r.beardRoot)r.beardRoot.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.role='beard'});
  for(const root of r.roots){r.holder.add(root);root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}})}
  r.holder.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(r.holder).getSize(new THREE.Vector3());if(size.y>.1&&size.y<10)r.height=size.y;
  r.motion=new CharacterMotion(r.roots);r.motion.setClip(clip);r.physics=null;
  customize();if(r.hairRoot)r.physics=new HairPhysics(r.hairRoot,physics,state.gender,state.hair);
  paint();setFocus(r.focus);
  await applyAppearance(r.roots,latest.current.appearance,{...latest.current.state.appearance,HairColor:latest.current.state.hairColor,BodyVein:latest.current.state.values.Vein,BodyArm:latest.current.state.values.Arm_Intensity,BodyLeg:latest.current.state.values.Leg_Intensity,BodyAbdominal:latest.current.state.values.Velly_Intensity} as AppearanceSettings,latest.current.state.gender);
  if(id===loadId.current)latest.current.onStatus('Ready');
 }).catch(e=>{if(id===loadId.current)latest.current.onError(`The character could not load. ${e instanceof Error?e.message:'Please reload.'}`)});
 },[catalog,state.gender,state.head,state.hair,state.outfit,state.appearance.BeardType]);
 useEffect(()=>{if(runtime.current?.roots.length)customize()},[data,state.values,state.pose,state.pointedEars,state.motion]);
 useEffect(()=>{const r=runtime.current;if(r?.roots.length)setFocus(r.focus)},[state.values.Height,state.values.Size_Head]);
 useEffect(()=>{if(runtime.current?.roots.length)paint()},[state.skin,state.hairColor,state.dyeColor,state.appearance]);
 useEffect(()=>{const r=runtime.current;if(r?.roots.length)applyAppearance(r.roots,appearance,{...state.appearance,HairColor:state.hairColor,BodyVein:state.values.Vein,BodyArm:state.values.Arm_Intensity,BodyLeg:state.values.Leg_Intensity,BodyAbdominal:state.values.Velly_Intensity} as AppearanceSettings,state.gender).catch(e=>latest.current.onError(e.message))},[appearance,state.appearance,state.hairColor,state.values.Vein,state.values.Arm_Intensity,state.values.Leg_Intensity,state.values.Velly_Intensity]);
 useEffect(()=>{let cancelled=false;idleClip(state).then(clip=>{if(!cancelled){runtime.current?.motion?.setClip(clip);customize();}}).catch(e=>latest.current.onError(e.message));return()=>{cancelled=true}},[state.gender,state.motion]);
 useEffect(()=>{const r=runtime.current;if(r){r.motion?.update(0,true);r.physics?.reset()}},[state.physics]);
 useEffect(()=>{
  const r=runtime.current;if(!r)return;let cancelled=false,environment:THREE.WebGLRenderTarget|null=null;
  jsonAsset<Lighting>('/assets/lighting.json').then(async data=>{
   const preset=data.presets[lighting.type==='natural'?'outdoor':'studio'];
   const hdr=await new HDRLoader().loadAsync(preset.environment);if(cancelled){hdr.dispose();return}
   hdr.mapping=THREE.EquirectangularReflectionMapping;const generator=new THREE.PMREMGenerator(r.renderer);environment=generator.fromEquirectangular(hdr);generator.dispose();hdr.dispose();
   r.scene.environment=environment.texture;r.scene.environmentIntensity=Math.max(.55,preset.environmentIntensity);r.renderer.toneMappingExposure=preset.exposure*1.12;
   for(const [name,config] of Object.entries(preset.lights)){const light=r.lights[name];if(!light)continue;light.color.set(config.color);light.intensity=config.intensity;light.position.fromArray(config.offset).add(new THREE.Vector3(0,1.35,0));light.target.position.set(0,1.35,0);}
   const active=latest.current.lighting,azimuth=active.x*Math.PI/150,elevation=(active.y+100)*Math.PI/400;r.lights.KeyLight.position.set(Math.sin(azimuth)*3,1.4+Math.sin(elevation)*3,Math.cos(azimuth)*3);r.lights.KeyLight.color.set(active.type==='colored'?active.color:'#f3f3f3');
  }).catch(e=>{if(!cancelled)latest.current.onError(`Lighting could not load. ${e.message}`)});
  return()=>{cancelled=true;if(environment){if(r.scene.environment===environment.texture)r.scene.environment=null;environment.dispose()}};
 },[lighting.type]);
 useEffect(()=>{const r=runtime.current;if(!r)return;const light=r.lights.KeyLight;const azimuth=lighting.x*Math.PI/150,elevation=(lighting.y+100)*Math.PI/400;light.position.set(Math.sin(azimuth)*3,1.4+Math.sin(elevation)*3,Math.cos(azimuth)*3);light.color.set(lighting.type==='colored'?lighting.color:'#f3f3f3');},[lighting]);
 return <div ref={host} className="viewport-canvas" aria-label="Interactive 3D character. Drag to orbit, scroll to zoom, right-drag to pan."/>;
});
