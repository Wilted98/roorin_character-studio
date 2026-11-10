import * as THREE from 'three';

export type AppearanceGender = 'GF' | 'GM';
export interface AppearanceSettings {
  [key:string]: any;
  irisId?: string; pupilId?: string; browId?: string; lashId?: string;
  irisSize?: number; pupilSize?: number;
  irisColor?: string; irisBorderColor?: string; scleraColor?: string;
  browColor?: string; browOpacity?: number; lashColor?: string; lashOpacity?: number;
}
export interface AppearanceOption {
  id: string; label: string; texture: string; thumbnail?: string;
  sourceMaterial: string; scalars: Record<string, number>;
}
export interface AppearancePreset {
  head: string; hair: string; skin: string; hairColor: string; pointedEars: boolean;
  id: string; label: string; faction: null; thumbnail: string | null;
  sourceIcon: string; sourceHead: {HeadType: number}; sourceHair: Record<string, unknown>;
  sourceMaterialValues: Record<string, unknown>; appearance: AppearanceSettings; note: string;
}
export interface AppearanceCatalog {
  version: number;
  genders: Record<AppearanceGender, {
    iris: AppearanceOption[]; pupils: AppearanceOption[]; brows: AppearanceOption[]; lashes: AppearanceOption[];
    skin: {id: string; color: string}[]; presets: AppearancePreset[];
    ranges: Record<string, {min: number; mid: number; max: number;reversed?:boolean}>;
    defaults?: Record<string,any>;
    detailTextures?:Record<string,string>;
    options?: Record<string,{id:string;label:string;thumbnail?:string;texture?:string;channel:number;scalars:Record<string,number>;resource?:string}[]>;
    makeupPresets?: {id:string;thumbnail:string;values:Record<string,any>}[];
    bodyPresets?: {id:string;thumbnail:string;values:Record<string,number>}[];
  }>;
  pads: {id: string; label: string; x: string; y: string; group: string}[];
  notes?: string[];
}
export const DEFAULT_APPEARANCE: Required<AppearanceSettings> = {
  irisId: '1', pupilId: '1', browId: '1', lashId: '1', irisSize: 0, pupilSize: 1.05,
  irisColor: '#547e8e', irisBorderColor: '#233b47', scleraColor: '#e8dfd8',
  browColor: '#392b25', browOpacity: .85, lashColor: '#211b18', lashOpacity: .85,
};
export function getDefaultAppearance(gender: AppearanceGender): Required<AppearanceSettings> {
  return {...DEFAULT_APPEARANCE, browOpacity: gender === 'GM' ? .95 : .85};
}

type Pixels = {image: HTMLImageElement; data: Uint8ClampedArray; width: number; height: number};
const images = new Map<string, Promise<Pixels>>();
function loadPixels(url: string): Promise<Pixels> {
  let pending = images.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d', {willReadFrequently: true})!; ctx.drawImage(image, 0, 0);
        resolve({image, width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data});
      };
      image.onerror = () => { images.delete(url); reject(new Error(`Appearance texture could not load: ${url}`)); };
      image.src = url;
    });
    images.set(url, pending);
  }
  return pending;
}
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
function channel(p: Pixels, u: number, v: number, c: number, outside = 0): number {
  if (u < 0 || u > 1 || v < 0 || v > 1) return outside;
  const x = Math.min(p.width - 1, Math.floor(u * p.width));
  const y = Math.min(p.height - 1, Math.floor(v * p.height));
  return p.data[(y * p.width + x) * 4 + c] / 255;
}
function rgb(value: string): number[] {
  const c = new THREE.Color(value).convertLinearToSRGB(); return [c.r * 255, c.g * 255, c.b * 255];
}
function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const result = document.createElement('canvas'); result.width = w; result.height = h;
  return [result, result.getContext('2d')!];
}
function texture(c: HTMLCanvasElement, original: THREE.Texture | null): THREE.CanvasTexture {
  const result = new THREE.CanvasTexture(c); result.flipY = original?.flipY ?? false;
  result.colorSpace = THREE.SRGBColorSpace;
  result.wrapS = original?.wrapS ?? THREE.ClampToEdgeWrapping;
  result.wrapT = original?.wrapT ?? THREE.ClampToEdgeWrapping;
  if (original) { result.offset.copy(original.offset); result.repeat.copy(original.repeat); result.rotation = original.rotation; }
  result.anisotropy = 4; result.needsUpdate = true; return result;
}
/** Approximate the native layered iris in the existing exported eye UV0 layout. */
function eyeCanvas(iris: Pixels, pupil: Pixels, s: Required<AppearanceSettings>,veins?:Pixels): HTMLCanvasElement {
  const [c, ctx] = canvas(512); const image = ctx.createImageData(c.width, c.height);
  const mid = rgb(s.irisColor), edge = rgb(s.irisBorderColor), white = rgb(s.scleraColor), pupilColor=rgb(s.pupilColor??'#151521');
  const radius = .235 * (1 + clamp(s.irisSize, -5, 5) * .045);
  // Native source pupil map is an inverted red mask; its central disk radius is about .12.
  const pupilScale = clamp(s.pupilSize, 0, 1.9) / 1.05;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const u = (x + .5) / c.width - .5, v = (y + .5) / c.height - .5, r = Math.hypot(u, v);
    const i = (y * c.width + x) * 4;
    let color = white;
    if(veins){const amount=clamp((Number(s.veinPower??1)-1)/5)*Math.pow(clamp(1-channel(veins,u+.5,v+.5,1)),2);const tint=rgb(s.veinColor??'#a05d5d');color=white.map((n,k)=>n*(1-amount)+tint[k]*amount);}
    if (r < radius) {
      const iu = u / (radius / .475) + .5, iv = v / (radius / .475) + .5;
      const detail = .25 + .75 * (.5 * channel(iris, iu, iv, 0) + .5 * channel(iris, iu, iv, 1));
      const border = clamp((r / radius - .72) / .25);
      const pupilMask = pupilScale > .001 ? 1 - channel(pupil, u / (.42 * pupilScale) + .5, v / (.42 * pupilScale) + .5, 0, 1) : 0;
      color = mid.map((a, k) => ((a * (1 - border) + edge[k] * border) * detail) * (1 - pupilMask) + pupilColor[k] * pupilMask);
    }
    image.data[i] = color[0]; image.data[i + 1] = color[1]; image.data[i + 2] = color[2]; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0); return c;
}
function maskCanvas(mask: Pixels, color: string, opacity: number, which: 'brow' | 'lash',settings?:AppearanceSettings): HTMLCanvasElement {
  const [c, ctx] = canvas(mask.width, mask.height); const out = ctx.createImageData(c.width, c.height); const col = rgb(color);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = col[0]; out.data[i + 1] = col[1]; out.data[i + 2] = col[2];
    // NNPH packs normals in RG and hair mask in B. EyelashAO green supplies exported lash cards.
    if(which==='brow')out.data[i+3]=mask.data[i+2]*clamp(opacity);
    else {const x=(i/4)%c.width,y=Math.floor(i/4/c.width),u=x/c.width,v=y/c.height,anchor=v<.36?.28:v<.72?.61:.79;
      const scale=.55+Number(settings?.EyelashLength??.5)*.9,angle=(Number(settings?.EyelashUpDown??.5)-.5)*.35;
      const vv=anchor+(v-anchor)/scale,uu=u+(v-anchor)*angle;
      out.data[i+3]=255*clamp(Math.max(channel(mask,uu,vv,1)*opacity,channel(mask,uu,vv,2)*Number(settings?.EyelashThickness_Lower??1.5)/1.5,channel(mask,u,v,0)*.4));
    }
  }
  ctx.putImageData(out, 0, 0); return c;
}
function browCanvas(base: THREE.Texture, mask: Pixels, s: Required<AppearanceSettings>, gender: AppearanceGender): HTMLCanvasElement {
  const [c, ctx] = canvas(1024);
  ctx.drawImage(base.image as CanvasImageSource, 0, 0, c.width, c.height);
  const brow = maskCanvas(mask, s.browColor, s.browOpacity, 'brow');
  // Shared exported head UV0 layout. Placement reconstructed from basecolor and native eyebrow area;
  // stripped native shader graphs do not expose the full UV transform function.
  const w = .155 * c.width*Number(s.EyebrowWidth??1), h = .0775 * c.height*Number(s.EyebrowThickness??1), cy = ((gender === 'GF' ? .318 : .314)-(Number(s.EyebrowUpDown??-.975)+.975)*.3) * c.height;
  for (const [cx, mirror] of [[.377, true], [.623, false]] as const) {
    ctx.save(); ctx.translate((cx+(mirror?-1:1)*Number(s.EyebrowDist??0)*.4) * c.width, cy); ctx.scale(mirror ? -1 : 1, 1);ctx.rotate((Number(s.EyebrowRotate??-.04)+.04)*Math.PI);
    ctx.drawImage(brow, -w / 2, -h / 2, w, h); ctx.restore();
  }
  return c;
}
type RecordState = {base: THREE.Texture | null; baseNormal?:THREE.Texture|null;normal?:THREE.Texture;generated?: THREE.Texture; surface?:THREE.Texture;key?: string; request: number};
type Layer={key:string;prefix:string;option:NonNullable<AppearanceCatalog['genders']['GF']['options']>[string][number];pixels:Pixels};
async function nativeLayers(data:AppearanceCatalog['genders']['GF'],s:AppearanceSettings):Promise<Layer[]>{
 const entries=Object.entries(data.options??{}).filter(([key])=>/^(Shading|Highlighter|Blusher|Eyeshadow2?|Eyeline|Lip2?|Freckle|Mole|Tattoo|Scar|WarPaint|Stubble|BodyTattoo)/.test(key));
 return (await Promise.all(entries.map(async([key,options])=>{const id=String(s[key]??1);if(id==='1')return null;const option=options.find(o=>o.id===id);if(!option?.texture)return null;return {key,prefix:key.replace(/Type.*$/,''),option,pixels:await loadPixels(option.texture)};}))).filter((v):v is Layer=>v!==null);
}
function compositeLayers(c:HTMLCanvasElement,layers:Layer[],s:AppearanceSettings,body:boolean,brow?:Pixels):HTMLCanvasElement{
 const ctx=c.getContext('2d')!,image=ctx.getImageData(0,0,c.width,c.height),[surface,sctx]=canvas(c.width,c.height),rough=sctx.createImageData(c.width,c.height);
 const baseGloss=Number(body?(s.bUseBodyGlossiness?s.BodyGlossiness:s.FaceGlossiness):s.FaceGlossiness)||0;
 for(let i=0;i<rough.data.length;i+=4){rough.data[i]=128;rough.data[i+1]=255*clamp(.53+baseGloss,.05,1);rough.data[i+3]=255;}
 if(brow&&!body){for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const u=x/c.width,v=y/c.height,left=u<.5,cx=(left?.377:.623)+(left?-1:1)*Number(s.EyebrowDist??0)*.4,cy=.318-(Number(s.EyebrowUpDown??-.975)+.975)*.3;
  let bu=(u-cx)/(.155*Number(s.EyebrowWidth??1))+.5,bv=(v-cy)/(.0775*Number(s.EyebrowThickness??1))+.5;if(left)bu=1-bu;
  const a=channel(brow,bu,bv,2)*clamp(Number(s.browOpacity??.5)),i=(y*c.width+x)*4;
  rough.data[i+1]=rough.data[i+1]*(1-a)+255*Number(s.EyebrowRoughness??.5)*a;
 }}
 for(const layer of layers){
  const {key,prefix,option,pixels}=layer;if(body!==key.startsWith('BodyTattoo'))continue;
  const col=rgb(String(s[prefix==='BodyTattoo'?'TattooColor':prefix==='WarPaint'?'WarPaintR_Color':prefix==='Stubble'?'BeardColor':prefix+'Color']??'#332821'));
  const shaderPrefix=({Eyeshadow:'EyeShadowA',Eyeshadow2:'EyeShadowB',Eyeline:'EyeLiner',Lip:'LipA',Lip2:'LipB'} as Record<string,string>)[prefix]??prefix;
  const nativeColorWeight=option.scalars[shaderPrefix+'Use_Color']??1;
  const opacity=(prefix==='Stubble'?clamp(1-(Number(s.StubbleIntensity??1)-.7)/2):clamp(Number(s[prefix+'Alpha']??(prefix==='Scar'?.5:1))))*nativeColorWeight;
  const gloss=clamp(Number(s[prefix+'Roughness']??.55),.05,1),metal=clamp(Number(s[prefix+'Metalic']??0));
  const gx=prefix==='Eyeshadow'?'EyeShadowA':prefix==='Eyeshadow2'?'EyeShadowB':prefix==='Lip'?'Lip':prefix==='Blusher'?'Blusher':'';
  const glitter=gx?rgb(String(s['GlitterColor_'+gx]??'#ffffff')):col;
  const rotation=Number(s[prefix+'Rotate']??0)*Math.PI*2,cs=Math.cos(rotation),sn=Math.sin(rotation);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
   let u=(x+.5)/c.width,v=(y+.5)/c.height;
   if(['Eyeline','Eyeshadow','Eyeshadow2'].includes(prefix)){const left=u<.5;u=(u-(left?.377:.623))/.31+.5;v=(v-.377)/.23+.5;if(left)u=1-u;}
   else if(prefix==='Lip'||prefix==='Lip2'){u=(u-.5)/.285+.5;v=(v-.585)/.235+.34;}
   else if(['Shading','Highlighter','Blusher'].includes(prefix)&&pixels.height===pixels.width*2)u=1-Math.abs(u-.5)*2;
   if(['Tattoo','Mole','Scar'].includes(prefix)){
    u-=.5+Number(s[prefix+'LeftRight']??0)*.25;v-=.5-Number(s[prefix+'UpDown']??0)*.25;
    const xx=u*cs-v*sn,yy=u*sn+v*cs;u=xx/Math.max(.05,Number(s[prefix+'ScaleU']??1))+.5;v=yy/Math.max(.05,Number(s[prefix+'ScaleV']??1))+.5;
    if(prefix==='Tattoo'){if(s.bTattooFlipU)u=1-u;if(s.bTattooFlipV)v=1-v;if(s.bTattooSymmetry)u=Math.abs(u-.5)+.5;}
   }
   let mask=channel(pixels,u,v,option.channel)*opacity;
   if(prefix==='Stubble')mask*=.65;if(mask<.001)continue;
   const i=(y*c.width+x)*4;let tint=col;
   if(prefix==='WarPaint'){const green=channel(pixels,u,v,1);mask=Math.max(mask,green);const secondary=rgb(String(s.WarPaintG_Color??'#ffffff'));tint=col.map((n,k)=>n*(1-green)+secondary[k]*green);}
   if(gx){const size=Math.max(1,Number(s['GlitterSize_'+gx]??10)),noise=((Math.floor(x/size)*73856093)^(Math.floor(y/size)*19349663))>>>0;
    const distribution=Number(s['GlitterArea_'+gx]??0)/4,density=Number(s['GlitterDensity_'+gx]??0);
    if((noise%10000)/10000<density*distribution){const amount=clamp(Number(s['GlitterColorUse_'+gx]??.5));tint=tint.map((n,k)=>n*(1-amount)+glitter[k]*amount);rough.data[i+2]=255*clamp(Number(s['GlitterMetalic_'+gx]??.5));}
   }
   for(let k=0;k<3;k++)image.data[i+k]=image.data[i+k]*(1-mask)+tint[k]*mask;
   rough.data[i+1]=rough.data[i+1]*(1-mask)+255*gloss*mask;rough.data[i+2]=Math.max(rough.data[i+2],255*metal*mask);
   if(prefix==='Scar')rough.data[i]=128+mask*Number(s.ScarDepth??0)*35;
  }
 }
 ctx.putImageData(image,0,0);sctx.putImageData(rough,0,0);return surface;
}
function hairCanvas(base:THREE.Texture,s:AppearanceSettings):HTMLCanvasElement{
 const im=base.image as HTMLImageElement,[c,ctx]=canvas(im.width,im.height);ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height),root=rgb(s.HairColor??'#52372b'),tip=rgb(s.Hair2Color??'#6c5840');
 const range=Number(s.RootTipRange??0),contrast=Math.max(.5,Number(s.RootTipContrast??5));
 for(let y=0;y<c.height;y++){const blend=s.bUseHairColorDetailSettings?clamp(((y/c.height-.5)+range*.5)*contrast+.5):0;for(let x=0;x<c.width;x++){
  const i=(y*c.width+x)*4,shade=pixels.data[i]/255;for(let k=0;k<3;k++)pixels.data[i+k]=(root[k]*(1-blend)+tip[k]*blend)*shade;pixels.data[i+3]=Math.min(255,pixels.data[i+3]*1.3);
 }}ctx.putImageData(pixels,0,0);return c;
}
function nativeSettings(settings:AppearanceSettings,side='L'):Required<AppearanceSettings>{
 const s={...DEFAULT_APPEARANCE,...settings};
 const get=(key:string,fallback:any)=>s[key]??fallback;
 const iris=s.bOddEye_Iris?side:'L',pupil=s.bOddEye_Pupil?side:'L',sclera=s.bOddEye_Sclera?side:'L';
 Object.assign(s,{irisId:String(get('IrisShape_'+iris,s.irisId)),pupilId:String(get('PupilShape_'+pupil,s.pupilId)),browId:String(get('EyebrowType',s.browId)),lashId:String(get('EyelashType',s.lashId)),irisSize:get('IrisSize_'+iris,s.irisSize),pupilSize:get('PupilSize_'+pupil,s.pupilSize),irisColor:get('IrisColorMid_'+iris,s.irisColor),irisBorderColor:get('IrisColorEdge_'+iris,s.irisBorderColor),pupilColor:get('PupilColor_'+pupil,'#151521'),scleraColor:get('ScleraColor_'+sclera,s.scleraColor),veinPower:get('ScleraVeinsPower_'+sclera,1),veinColor:get('ScleraVeinColor_'+sclera,'#a05d5d'),browColor:get('EyebrowColor',s.browColor),browOpacity:get('EyebrowHairIntensity',s.browOpacity),lashColor:get('EyelashColor_Upper',s.lashColor),lashOpacity:clamp(get('EyelashThickness_Upper',1.5)/1.5)});return s;
}
const materials = new WeakMap<THREE.MeshStandardMaterial, RecordState>();
let requestId = 0;
function role(material: THREE.MeshStandardMaterial): string {
  if (material.userData.role) return material.userData.role as string;
  const n = material.name.toLowerCase();
  if (n.includes('eyea') || n.includes('eye_a')) return 'lashes';
  if (n.includes('_eye')) return 'eyes';
  return n.includes('head') && !n.includes('tear') && !n.includes('hide') ? 'skin' : '';
}
/** Call on state/asset changes, not each frame. Original maps/normals remain intact for recomposition. */
export async function applyAppearance(roots: THREE.Object3D[], catalog: AppearanceCatalog, settings: AppearanceSettings, gender: AppearanceGender): Promise<void> {
  const data = catalog.genders[gender],s = nativeSettings({...getDefaultAppearance(gender),...data.defaults,...settings});
  const select = (list: AppearanceOption[], id: string) => list.find(o => o.id === String(id)) ?? list[0];
  const selected = {iris: select(data.iris, s.irisId), pupil: select(data.pupils, s.pupilId), brow: select(data.brows, s.browId), lash: select(data.lashes, s.lashId)};
  const materialKey=(m:THREE.MeshStandardMaterial)=>{const r=role(m),head=/head/i.test(m.name+' '+m.userData.sourceMaterial);const pattern=r==='hair'?/^(Hair|RootTip|bUseHair)/:r==='eyes'?/^(Iris|Pupil|Sclera|bOddEye|bUseEmi|iris|pupil|sclera)/:r==='lashes'?/^(Eyelash|lash)/:head?/^(Shading|Highlighter|Blusher|Eyeshadow|Eyeline|Lip|Freckle|Mole|Tattoo|Scar|WarPaint|Stubble|BeardColor|Glitter|Eyebrow|brow|FaceGloss|bTattoo)/:/^(Body|FaceGloss|TattooColor|bUseBody)/;return JSON.stringify([gender,...Object.entries(s).filter(([k])=>pattern.test(k))]);};const request = ++requestId;
  const targets = new Set<THREE.MeshStandardMaterial>();
  roots.forEach(root => root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      const r = role(m);
      if(r==='eyes'){mesh.geometry.computeBoundingBox();m.userData.eyeSide=(mesh.geometry.boundingBox?.getCenter(new THREE.Vector3()).x??0)>0?'L':'R';}
      const headSkin = r === 'skin' && /head/i.test(m.name + ' ' + (m.userData.sourceMaterial ?? ''));
      if (r !== 'eyes' && r !== 'lashes' && r!=='skin'&&r!=='hair') continue;
      if (r === 'eyes' || r === 'lashes') m.color.set('#ffffff');
      let state = materials.get(m);
      if (!state) { state = {base: m.map,baseNormal:m.normalMap, request}; materials.set(m, state); }
      state.request = request;
      if (state.key !== materialKey(m)) targets.add(m);
    }
  }));
  if (!targets.size) return;
  const [iris, pupil, brow, lash] = await Promise.all([selected.iris, selected.pupil, selected.brow, selected.lash].map(o => loadPixels(o.texture)));
  const layers=await nativeLayers(data,s);
  const details=Object.fromEntries(await Promise.all(Object.entries(data.detailTextures??{}).map(async([k,url])=>[k,await loadPixels(url)])));
  for (const m of targets) {
    const state = materials.get(m); if (!state || state.request !== request) continue;
    const r = role(m); let c: HTMLCanvasElement;
    if (r === 'eyes') {const eye=nativeSettings(s,m.userData.eyeSide);const [i,p]=await Promise.all([loadPixels(select(data.iris,eye.irisId).texture),loadPixels(select(data.pupils,eye.pupilId).texture)]);c = eyeCanvas(i, p, eye,details.sclera); m.color.set('#ffffff');m.emissive.set(s['bUseEmiPupil_'+(s.bOddEye_Pupil?m.userData.eyeSide:'L')]?eye.pupilColor:'#000000');m.emissiveIntensity=.25;}
    else if (r === 'lashes') {
      c = maskCanvas(lash, s.lashColor, s.lashOpacity, 'lash',s); m.color.set('#ffffff');
      m.transparent = true; m.opacity = 1; m.alphaTest = .08; m.depthWrite = false;
    } else if(r==='hair'){if(!state.base?.image)continue;c=hairCanvas(state.base,s);m.color.set('#ffffff');m.roughness=clamp(Number(s.HairGlossiness??.4),.2,1);}
    else { if (!state.base?.image) continue; const headSkin=/head/i.test(m.name+' '+m.userData.sourceMaterial);if(headSkin)c=browCanvas(state.base,brow,s,gender);else {const [copy,ctx]=canvas(1024);ctx.drawImage(state.base.image as CanvasImageSource,0,0,1024,1024);c=copy;}
      const surface=compositeLayers(c,layers,s,!headSkin,brow),map=texture(surface,state.base);map.colorSpace=THREE.NoColorSpace;state.surface?.dispose();state.surface=map;m.roughnessMap=map;m.metalnessMap=map;m.roughness=1;m.metalness=1;
      if(state.baseNormal?.image&&details.veins){
        const [nc,nctx]=canvas(1024);nctx.drawImage(state.baseNormal.image as CanvasImageSource,0,0,1024,1024);const pixels=nctx.getImageData(0,0,1024,1024);
        const heights=surface.getContext('2d')!.getImageData(0,0,1024,1024).data;
        for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const i=(y*1024+x)*4,u=x/1024,v=y/1024,vein=clamp(Number(s.BodyVein??0));const muscle=details.muscle,mask=details.regions;const abdominal=mask?channel(mask,u,v,2):0;const intensity=abdominal*(Number(s.BodyAbdominal??1)-1)+(1-abdominal)*(v>.6?Number(s.BodyLeg??1)-1:Number(s.BodyArm??1)-1);
          let nx=pixels.data[i]/127.5-1,ny=pixels.data[i+1]/127.5-1;
          if(!headSkin){nx+=(channel(details.veins,u,v,0)*2-1)*vein;ny-=(channel(details.veins,u,v,1)*2-1)*vein;if(muscle){nx+=(channel(muscle,u,v,0)*2-1)*intensity*.45;ny-=(channel(muscle,u,v,1)*2-1)*intensity*.45;}}
          else {nx+=(heights[i]-heights[Math.min(i+4,heights.length-4)])*.02;ny+=(heights[i]-heights[Math.min(i+4096,heights.length-4)])*.02;}
          const nz=Math.sqrt(Math.max(.01,1-nx*nx-ny*ny)),length=Math.hypot(nx,ny,nz);pixels.data[i]=(nx/length+1)*127.5;pixels.data[i+1]=(ny/length+1)*127.5;pixels.data[i+2]=(nz/length+1)*127.5;
        }nctx.putImageData(pixels,0,0);state.normal?.dispose();state.normal=texture(nc,state.baseNormal);state.normal.colorSpace=THREE.NoColorSpace;m.normalMap=state.normal;
      }
    }
    if(state.request!==request)continue;
    const next = texture(c, state.base); const old = state.generated;
    m.map = next; state.generated = next; state.key = materialKey(m); m.needsUpdate = true; old?.dispose();
  }
}

/** Release generated GPU textures before discarding an assembly. Shared source maps are retained. */
export function disposeAppearance(roots: THREE.Object3D[]): void {
  roots.forEach(root => root.traverse(obj => {
    const mesh = obj as THREE.Mesh; if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const m = material as THREE.MeshStandardMaterial, state = materials.get(m);
      if (state) { state.request = -1; m.map = state.base;m.normalMap=state.baseNormal??null;state.normal?.dispose(); state.generated?.dispose();state.surface?.dispose(); materials.delete(m); }
    }
  }));
}


