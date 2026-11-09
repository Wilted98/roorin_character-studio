"use client";
import {useEffect, useRef, useImperativeHandle, forwardRef} from "react";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {applyCustomization, type CustomizationData} from "@/lib/customization";
import type {CharacterCatalog, StudioState} from "@/lib/studio-types";

function disposeModel(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose();}}});}
export type ViewportApi = {focus:(mode:"face"|"body")=>void; screenshot:()=>void; rotate:()=>void};
type Props={catalog:CharacterCatalog; data:CustomizationData; state:StudioState; background:string; onStatus:(status:string)=>void; onError:(error:string)=>void};
export default forwardRef<ViewportApi,Props>(function CharacterViewport({catalog,data,state,background,onStatus,onError},ref){
 const host=useRef<HTMLDivElement>(null);
 const runtime=useRef<{renderer:THREE.WebGLRenderer; scene:THREE.Scene; camera:THREE.PerspectiveCamera; orbit:OrbitControls; holder:THREE.Group; roots:THREE.Object3D[]; height:number; focus:string; target:THREE.Vector3; cameraTarget:THREE.Vector3; floor:THREE.Mesh; resize:()=>void}|null>(null);
 const latest=useRef({state,data,onStatus,onError});latest.current={state,data,onStatus,onError};
 const loadId=useRef(0);
 const setFocus=(mode:"face"|"body")=>{const r=runtime.current;if(!r)return;r.focus=mode;const h=r.height; r.target.set(0,h*(mode==="face"?.9:.52),0); r.cameraTarget.set(mode==="face"?0:h*.06,h*(mode==="face"?.91:.57),h*(mode==="face"?.69:1.65));};
 useImperativeHandle(ref,()=>({focus:setFocus,rotate:()=>{if(runtime.current)runtime.current.orbit.autoRotate=!runtime.current.orbit.autoRotate},screenshot:()=>{const r=runtime.current;if(!r)return;r.renderer.render(r.scene,r.camera);const a=document.createElement('a');a.download=`${latest.current.state.name||'Aion-character'}.png`;a.href=r.renderer.domElement.toDataURL('image/png');a.click();}}));
 useEffect(()=>{
  if(!host.current)return; let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}catch{latest.current.onError('Your browser could not start WebGL. Try a browser with hardware acceleration enabled.');return;}
  const el=host.current;renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;el.appendChild(renderer.domElement);
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(32,1,.01,100);camera.position.set(0,1.45,3.4);
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.95,0);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.minDistance=.45;orbit.maxDistance=6;orbit.maxPolarAngle=Math.PI*.53;orbit.autoRotateSpeed=.65;orbit.enablePan=true;
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.45;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xddeeff,0x302c3d,.65));
  const key=new THREE.DirectionalLight(0xffe6c8,2);key.position.set(-2,3,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.bias=-.0005;scene.add(key);
  const fill=new THREE.DirectionalLight(0x9ebde6,.8);fill.position.set(3,2,1);scene.add(fill);const rim=new THREE.DirectionalLight(0xa5d0ed,1.3);rim.position.set(1,3,-3);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.8,96),new THREE.ShadowMaterial({opacity:.22}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.7,.704,120),new THREE.MeshBasicMaterial({color:0x8c785a,transparent:true,opacity:.4,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.008;scene.add(ring);
  const holder=new THREE.Group();scene.add(holder);
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  runtime.current={renderer,scene,camera,orbit,holder,roots:[],height:1.8,focus:'body',target:new THREE.Vector3(0,.95,0),cameraTarget:new THREE.Vector3(0,1.1,3.2),floor,resize};resize();const observer=new ResizeObserver(resize);observer.observe(el);
  let moving=false;const start=()=>{moving=true;};const end=()=>{moving=false;const r=runtime.current;if(r){r.cameraTarget.copy(camera.position);r.target.copy(orbit.target);}};orbit.addEventListener('start',start);orbit.addEventListener('end',end);
  let frame=0;const tick=()=>{frame=requestAnimationFrame(tick);const r=runtime.current;if(!r)return;if(!moving&&!orbit.autoRotate){camera.position.lerp(r.cameraTarget,.09);orbit.target.lerp(r.target,.09);}orbit.update();renderer.render(scene,camera);};tick();
  return()=>{loadId.current++;cancelAnimationFrame(frame);observer.disconnect();orbit.dispose();scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();for(const m of Array.isArray(obj.material)?obj.material:[obj.material])m.dispose();}});env.dispose();renderer.dispose();renderer.domElement.remove();runtime.current=null;};
 },[]);
 const paint=()=>{const r=runtime.current;if(!r)return;const s=latest.current.state;for(const root of r.roots)root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){if(!(m instanceof THREE.MeshStandardMaterial))continue;if(!m.userData.originalColor)m.userData.originalColor=m.color.clone();const role=m.userData.role;if(!m.userData.tintPrepared&&(role==='hair'||role==='eyes')){m.userData.tintPrepared=true;m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
#ifdef USE_MAP
${role==='hair'?'diffuseColor.rgb = diffuse * clamp(dot(sampledDiffuseColor.rgb, vec3(0.2126,0.7152,0.0722))*8.0,0.35,1.4);':'float irisTint = 1.0-smoothstep(0.2,0.65,max(sampledDiffuseColor.r,max(sampledDiffuseColor.g,sampledDiffuseColor.b))); diffuseColor.rgb = sampledDiffuseColor.rgb * mix(vec3(1.0),diffuse,irisTint);'}
#endif`)};m.customProgramCacheKey=()=>role;m.needsUpdate=true;}m.color.copy(m.userData.originalColor);if(role==='hair')m.color.multiply(new THREE.Color(s.hairColor));else if(role==='eyes')m.color.multiply(new THREE.Color(s.eyeColor));else if(role==='skin')m.color.multiply(new THREE.Color(s.skin));}});};
 useEffect(()=>{
  const r=runtime.current;if(!r)return;const id=++loadId.current;const g=catalog.genders[state.gender];if(!g)return;
  const head=g.heads.find(x=>x.id===state.head)||g.heads[0];const hair=g.hair.find(x=>x.id===state.hair)||g.hair[0];const urls=[g.body.url,head?.url,...(state.hair==='none'?[]:[hair?.url])].filter(Boolean);
  latest.current.onStatus('Loading character…');const loader=new GLTFLoader();
  Promise.all(urls.map(url=>loader.loadAsync(url+'?v=2'))).then(models=>{if(id!==loadId.current||!runtime.current){models.forEach(m=>disposeModel(m.scene));return;}for(const root of r.roots){r.holder.remove(root);root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(mat))if(v instanceof THREE.Texture)v.dispose();mat.dispose();}}});}r.roots=models.map(m=>m.scene);for(const root of r.roots){r.holder.add(root);root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});}r.holder.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(r.holder);const size=box.getSize(new THREE.Vector3());if(size.y>.1&&size.y<10)r.height=size.y;applyCustomization(r.roots,latest.current.data,latest.current.state.gender,latest.current.state.values);paint();setFocus(r.focus==='face'?'face':'body');latest.current.onStatus('Ready');}).catch(error=>{if(id===loadId.current)latest.current.onError(`The character could not load. ${error instanceof Error?error.message:'Try reloading the page.'}`);});
 },[catalog,state.gender,state.head,state.hair]);
 useEffect(()=>{const r=runtime.current;if(r?.roots.length){applyCustomization(r.roots,data,state.gender,state.values);paint();}},[data,state.values,state.skin,state.hairColor,state.eyeColor]);
 useEffect(()=>{const r=runtime.current;if(!r)return;r.renderer.toneMappingExposure=background==='warm'?.9:background==='light'?1.1:.95;},[background]);
 return <div ref={host} className="viewport-canvas" aria-label="Interactive 3D character. Drag to orbit, scroll to zoom, right-drag to pan."/>;
});

