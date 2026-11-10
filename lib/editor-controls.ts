import {getControls,getDefaultValues,type CustomizationControl,type CustomizationData} from './customization';
import {INITIAL,type CharacterCatalog,type StudioState} from './studio-types';
export const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export function toDisplay(c:CustomizationControl,value:number){const v=clamp(value,Math.min(c.min,c.max),Math.max(c.min,c.max));const upper=c.max>=c.min?v>=c.mid:v<=c.mid;const n=upper?(v-c.mid)/(c.max-c.mid||1)*100:(v-c.mid)/(c.mid-c.min||1)*100;return Math.round(n*(c.reversed?-1:1))||0;}
export function fromDisplay(c:CustomizationControl,n:number){const v=clamp(n,-100,100)*(c.reversed?-1:1);return c.mid+(v>=0?v*(c.max-c.mid):v*(c.mid-c.min))/100;}
export function validState(raw:unknown,data:CustomizationData,catalog:CharacterCatalog):StudioState {
 if(!raw||typeof raw!=='object')throw Error('Choose a character preset JSON file.');
 const v=raw as StudioState;if(![1,2].includes(v.version)||!['GF','GM'].includes(v.gender))throw Error('Unsupported character preset.');
 const g=catalog.genders[v.gender],values=getDefaultValues(data,v.gender);
 for(const c of getControls(data,v.gender)){const n=v.values?.[c.id];if(typeof n==='number'&&Number.isFinite(n))values[c.id]=clamp(n,Math.min(c.min,c.max),Math.max(c.min,c.max));}
 const color=(x:unknown,f:string)=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x)?x:f;
 const appearance:Record<string,unknown>={};
 const input=(v.appearance&&typeof v.appearance==='object'?v.appearance:{}) as Record<string,unknown>;
 for(const key of ['irisId','pupilId','browId','lashId'])if(typeof input[key]==='string'&&/^[0-9]{1,4}$/.test(input[key] as string))appearance[key]=input[key];
 for(const key of ['irisColor','irisBorderColor','scleraColor','browColor','lashColor'])if(typeof input[key]==='string'&&/^#[0-9a-f]{6}$/i.test(input[key] as string))appearance[key]=input[key];
 for(const [key,min,max] of [['irisSize',-5,5],['pupilSize',0,1.9],['browOpacity',0,1],['lashOpacity',0,1]] as const)if(typeof input[key]==='number'&&Number.isFinite(input[key]))appearance[key]=clamp(input[key],min,max);
 for(const [key,val] of Object.entries(input)){if(Object.hasOwn(appearance,key))continue;if(!/^[A-Zb]/.test(key))continue;if(!/^[A-Za-z][A-Za-z0-9_]{0,80}$/.test(key))continue;if(typeof val==='number'&&Number.isFinite(val))appearance[key]=clamp(val,-100,100);else if(typeof val==='boolean')appearance[key]=val;else if(typeof val==='string'&&(/^#[0-9a-f]{6}$/i.test(val)||/^[0-9]{1,4}$/.test(val)))appearance[key]=val;}
 if(!appearance.irisColor)appearance.irisColor=color(v.eyeColor,INITIAL.eyeColor);
 return {...INITIAL,name:typeof v.name==='string'?v.name.slice(0,40):INITIAL.name,gender:v.gender,head:g.heads.some(x=>x.id===v.head)?v.head:g.heads[0].id,hair:v.hair==='none'||g.hair.some(x=>x.id===v.hair)?v.hair:INITIAL.hair,outfit:g.outfits?.some(x=>x.id===v.outfit)?v.outfit:'base',skin:color(v.skin,INITIAL.skin),hairColor:color(v.hairColor,INITIAL.hairColor),eyeColor:color(v.eyeColor,INITIAL.eyeColor),dyeColor:color(v.dyeColor,INITIAL.dyeColor),motion:['creator-idle','normal-idle','still'].includes(v.motion)?v.motion:INITIAL.motion,animationPaused:v.animationPaused===true,physics:v.physics!==false,pointedEars:v.pointedEars===true,pose:v.pose==='neutral'?'neutral':'relaxed',values,appearance};
}
export const POSITION_PAIRS:Record<string,{label:string;x:string;y:string}[]>={
 face:[{label:'Face proportions',x:'Shape_InOut',y:'Shape_UpDown'},{label:'Jaw position',x:'Plastima_Width',y:'Plastima_UpDown'},{label:'Chin proportions',x:'Chin_Width',y:'Chin_Length'}],
 eyes:[{label:'Eye position',x:'Eye_Dist',y:'Eye_UpDown'},{label:'Outer eye position',x:'EyeTail_InOut',y:'EyeTail_UpDown'},{label:'Inner eye position',x:'EyeHead_InOut',y:'EyeHead_UpDown'}],
 mouth:[{label:'Mouth proportions',x:'Lip_Width',y:'Lip_Thickness'}],
 ears:[{label:'Ear position',x:'Ear_FwdBwd',y:'Ear_UpDown'}],
};

