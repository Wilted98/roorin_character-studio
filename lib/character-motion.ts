import * as THREE from 'three';

export type MotionKind = 'creator-idle' | 'normal-idle' | 'still';
type Keys = {times:number[];values:number[]};
export type NativeClip = {duration:number;tracks:{bone:string;t?:Keys;q?:Keys;s?:Keys}[]};
type BoneBase = {node:THREE.Object3D;t:THREE.Vector3;q:THREE.Quaternion;s:THREE.Vector3};

/** Sample native keys without assuming one key per frame (constant tracks have one). */
export function sampleKeys(keys:Keys,time:number,width:number,out:number[]){
 const times=keys.times;let lo=0,hi=times.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(times[mid]<=time)lo=mid;else hi=mid-1;}
 const next=Math.min(lo+1,times.length-1),f=next===lo?0:THREE.MathUtils.clamp((time-times[lo])/(times[next]-times[lo]),0,1);
 if(width===4){const a=new THREE.Quaternion().fromArray(keys.values,lo*4),b=new THREE.Quaternion().fromArray(keys.values,next*4);a.slerp(b,f).normalize().toArray(out);}
 else for(let k=0;k<width;k++)out[k]=THREE.MathUtils.lerp(keys.values[lo*width+k],keys.values[next*width+k],f);
 return out;
}

export class CharacterMotion {
 private bases:BoneBase[]=[];
 private bindings:{base:BoneBase;track:NativeClip['tracks'][number]}[]=[];
 private clip:NativeClip|null=null;
 time=0;
 constructor(private roots:THREE.Object3D[]){}
 capture(){
  this.bases=[];
  for(const root of this.roots)root.traverse(node=>{if((node as THREE.Bone).isBone)this.bases.push({node,t:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});});
  this.bind();
 }
 setClip(clip:NativeClip|null){this.clip=clip;this.time=0;this.bind();}
 private bind(){const tracks=new Map(this.clip?.tracks.map(t=>[t.bone,t])??[]);this.bindings=this.bases.flatMap(base=>{const track=tracks.get(String(base.node.userData.sourceBoneName??base.node.name));return track?[{base,track}]:[]});}
 restore(){for(const b of this.bases){b.node.position.copy(b.t);b.node.quaternion.copy(b.q);b.node.scale.copy(b.s);}}
 update(dt:number,paused:boolean){
  this.restore();if(!this.clip)return;
  if(!paused)this.time=(this.time+Math.min(dt,.05))%this.clip.duration;
  const v:number[]=[],q=new THREE.Quaternion();
  for(const {base:b,track} of this.bindings){
   if(track.t){sampleKeys(track.t,this.time,3,v);b.node.position.x+=v[0];b.node.position.y+=v[1];b.node.position.z+=v[2];}
   if(track.q){sampleKeys(track.q,this.time,4,v);b.node.quaternion.premultiply(q.fromArray(v)).normalize();}
   if(track.s){sampleKeys(track.s,this.time,3,v);b.node.scale.x*=v[0];b.node.scale.y*=v[1];b.node.scale.z*=v[2];}
  }
 }
}
