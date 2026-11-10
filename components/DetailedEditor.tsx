'use client';
import {useState} from 'react';
import {NumberSlider,PositionPad} from './EditorControls';
import {bodyMenus,faceMenus,styleMenus,type Field} from '@/lib/editor-menu';
import {toDisplay,fromDisplay} from '@/lib/editor-controls';
import type {CustomizationControl,CustomizationData} from '@/lib/customization';
import type {AppearanceCatalog} from '@/lib/appearance-materials';
import type {StudioState} from '@/lib/studio-types';
type Props={mode:string;state:StudioState;data:CustomizationData;catalog:AppearanceCatalog;change:(patch:Partial<StudioState>,key?:string)=>void};
export default function DetailedEditor({mode,state,data,catalog,change}:Props){
 const [section,setSection]=useState('preset'),[detail,setDetail]=useState('base'),[palette,setPalette]=useState(false),[side,setSide]=useState('L');
 const g=catalog.genders[state.gender],defaults=g.defaults??{},controls=data.genders[state.gender].controls;
 const material=(key:string)=>state.appearance[key]??defaults[key];
 const patch=(values:Record<string,unknown>,key='')=>change({appearance:{...state.appearance,...values},...(values.HairColor?{hairColor:String(values.HairColor)}:{})},key);
 const eye=mode==='iris'||mode==='pupil'||mode==='sclera';const oddKey=mode==='iris'?'bOddEye_Iris':mode==='pupil'?'bOddEye_Pupil':'bOddEye_Sclera';
 const resolve=(key:string)=>eye&&material(oddKey)&&side==='R'?key.replace(/_L$/,'_R'):key;
 const range=(key:string,bone=false):CustomizationControl|undefined=>bone?controls.find(c=>c.id===key):({id:key,label:key,kind:'face',group:'face',reversed:false,...(g.ranges[key]??g.ranges[key.replace(/_[LR]$/,'')]??{min:0,mid:.5,max:1})});
 const value=(key:string,bone=false)=>Number((bone?state.values[key]:material(key))??range(key,bone)?.mid??0);
 const set=(key:string,v:unknown,bone=false)=>bone?change({values:{...state.values,[key]:Number(v)}},key):patch({[key]:v},key);
 const render=(f:Field)=>{
  const k=resolve(f.key),y=resolve(f.y??'');const bone=f.kind==='bone'||f.kind==='pad'&&f.bone;
  if(f.kind==='heading')return <h2 className="section-heading" key={k}>✧ {f.label}</h2>;
  if(f.kind==='toggle') {const active=k==='pointedEars'?state.pointedEars:!!material(k);return <div className="editor-field" key={k}><h3>{f.label}</h3><div className="text-tabs">{(f.choices??['OFF','ON']).map((label,i)=><button key={label} aria-pressed={active===!!i} className={active===!!i?'active':''} onClick={()=>k==='pointedEars'?change({pointedEars:!!i}):set(k,i)}>{label}</button>)}</div></div>}
  if(f.kind==='color'){const color=String(k==='HairColor'?state.hairColor:material(k)??'#000000');return <label className="color-field" key={k}><span>{f.label}</span><input type="color" aria-label={f.label} value={color} onChange={e=>set(k,e.target.value)}/><code>{color.toUpperCase()}</code></label>}
  if(f.kind==='option') {const list=g.options?.[k.replace(/_[LR]$/,'')]??g.options?.[k]??[];return <div key={k} className="editor-field"><h3>{f.label}</h3><div className="texture-tiles native-options" role="group" aria-label={f.label}>{list.map(o=><button key={o.id} aria-label={`${f.label} ${o.id}`} aria-pressed={String(material(k)??'1')===o.id} className={String(material(k)??'1')===o.id?'selected':''} onClick={()=>set(k,Number(o.id))}>{o.thumbnail?<img src={o.thumbnail} alt="" loading="lazy"/>:<span>{o.label}</span>}</button>)}</div></div>}
  const r=range(k,!!bone);if(!r)return <div key={k} className="unavailable-control"><label>{f.label}</label><span>{k==='Vein'?'Native vein mask is not yet mapped.':'Source backward pose is missing; control unavailable.'}</span></div>;
  if(f.kind==='pad'){const ry=range(y,!!bone);if(!ry)return null;return <PositionPad key={k} label={f.label} x={toDisplay(r,value(k,!!bone))} y={toDisplay(ry,value(y,!!bone))} onChange={(x,yv)=>{const values={[k]:fromDisplay(r,x),[y]:fromDisplay(ry,yv)};bone?change({values:{...state.values,...values}},k):patch(values,k)}} onReset={()=>bone?change({values:{...state.values,[k]:r.mid,[y]:ry.mid}}):patch({[k]:r.mid,[y]:ry.mid})}/>}
  return <NumberSlider key={k} min={r.min===r.mid?0:-100} label={f.label} value={toDisplay(r,value(k,!!bone))} onChange={v=>set(k,fromDisplay(r,v),!!bone)} onReset={()=>set(k,r.mid,!!bone)}/>;
 };
 const rail=mode==='style'?[['preset','Preset'],['skin','Skin'],['eyes','Eyes'],['lips','Lips'],['mole','Mole / Freckle'],['art','Face Art / Scar'],['beard','Facial Hair']]:mode==='body'?[['preset','Preset'],['head','Body / Head'],['arms','Arms'],['body','Body'],['lower','Lower Body']]:[];
 const subtabs=mode==='style'?(section==='skin'||section==='lips'?['base','detail']:section==='eyes'?['eyeliner','eyeshadow']:section==='art'?['tattoo','warpaint','scar']:[]):[];
 const activeDetail=subtabs.includes(detail)?detail:subtabs[0];
 const fields=mode==='style'?styleMenus[section==='skin'||section==='lips'?`${section}-${activeDetail}`:activeDetail??section]??[]:mode==='body'?bodyMenus[section]??[]:faceMenus[mode]??[];
 return <div className={rail.length?'detail-layout':''}>{!!rail.length&&<nav className="detail-sidebar" aria-label={`${mode} sections`}>{rail.map(([id,label])=><button className={section===id?'active':''} key={id} onClick={()=>{setSection(id);setDetail('base')}}>{label}</button>)}</nav>}<div className="detail-content">
  {subtabs.length>0&&<div className="text-tabs">{subtabs.map(id=><button key={id} className={activeDetail===id?'active':''} onClick={()=>setDetail(id)}>{id}</button>)}</div>}
  {(mode==='body'||mode==='style')&&section==='preset'&&<div className="preset-grid">{(mode==='body'?g.bodyPresets:g.makeupPresets)?.map(p=><button className="preset-card" aria-label={`Apply ${mode} preset ${p.id}`} key={p.id} onClick={()=>mode==='body'?change({values:{...state.values,...p.values}}):patch(Object.fromEntries(Object.entries(p.values).filter(([k])=>/^(Shading|Highlighter|Blusher|Eyeshadow|Eyeline|Lip|Freckle|Mole|Tattoo|Scar|WarPaint|Glitter|BodyTattoo|bTattoo)/.test(k))))}><img src={p.thumbnail} alt="" loading="lazy"/><span>{mode==='body'?'Body':'Style'} {p.id}</span></button>)}</div>}
  {eye&&!!material(oddKey)&&<div className="text-tabs">{['L','R'].map(s=><button key={s} className={side===s?'active':''} onClick={()=>setSide(s)}>{s==='L'?'Left eye':'Right eye'}</button>)}</div>}
  {mode==='skin'&&<><button className="palette-toggle" aria-expanded={palette} onClick={()=>setPalette(!palette)}><span>Skin Color</span><span className="color-preview" style={{background:state.skin}}/>{palette?'▴':'▾'}</button>{palette&&<><div className="swatches skin-palette">{g.skin.map(o=><button key={o.id} style={{background:o.color}} aria-label={`Skin color ${o.id}`} aria-pressed={state.skin.toLowerCase()===o.color.toLowerCase()} onClick={()=>change({skin:o.color})}/>)}</div><label className="color-field"><span>More colours</span><input type="color" aria-label="Custom skin color" value={state.skin} onChange={e=>change({skin:e.target.value},'skin')}/><code>{state.skin}</code></label></>}</>}
  {fields.map(render)}
  {mode==='skin'&&!!material('bUseBodyGlossiness')&&render({kind:'material',key:'BodyGlossiness',label:'Body Gloss'})}
 </div></div>;
}
