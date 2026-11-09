import * as THREE from 'three';

type V={X?:number;Y?:number;Z?:number};
type Capsule={Radius:number;Length:number;DrivingBone:{BoneName:string};OffsetLocation:V;OffsetRotation:{Pitch?:number;Yaw?:number;Roll?:number};bEnable?:boolean};
type NodeConfig={rootFound:boolean;root:string;bones:{name:string;parent:string}[];settings:{Damping:number;Stiffness:number;Radius:number;WorldDampingLocation:number;LimitAngle:number};gravity:number[];limitSet:string};
export type HairPhysicsData={genders:Record<string,Record<string,{nodes:NodeConfig[]}>>;limitSets:Record<string,{authored:{CapsuleLimits?:Capsule[]}}>};
type Spring={bone:THREE.Object3D;child:THREE.Object3D;tip:THREE.Vector3;previous:THREE.Vector3;goal:THREE.Vector3;config:NodeConfig};

/** Small browser spring solver driven by the exported KawaiiPhysics chains.
 * Preserves the authored rest shape; it does not execute Unreal's solver/curves.
 */
export class HairPhysics {
 private springs:Spring[]=[];
 private bones=new Map<string,THREE.Object3D>();
 private capsules:{bone:THREE.Object3D;offset:THREE.Vector3;axis:THREE.Vector3;half:number;radius:number}[]=[];
 constructor(private root:THREE.Object3D,data:HairPhysicsData,gender:string,hair:string){
  root.updateMatrixWorld(true);
  root.traverse(b=>{if((b as THREE.Bone).isBone)this.bones.set(String(b.userData.sourceBoneName??b.name),b)});
  const sets=new Set<string>();const used=new Set<THREE.Object3D>();
  for(const config of data.genders[gender]?.[hair]?.nodes??[]){
   if(!config.rootFound)continue;sets.add(config.limitSet);
   for(const item of config.bones){
    const bone=this.bones.get(item.name);if(!bone||used.has(bone))continue;
    const childRecord=config.bones.find(b=>b.parent===item.name),child=childRecord&&this.bones.get(childRecord.name);
    if(!child)continue;used.add(bone);const tip=child.getWorldPosition(new THREE.Vector3());
    this.springs.push({bone,child,tip,previous:tip.clone(),goal:tip.clone(),config});
   }
  }
  for(const id of sets)for(const c of data.limitSets[id]?.authored.CapsuleLimits??[]){
   const bone=this.bones.get(c.DrivingBone.BoneName);if(!bone||c.bEnable===false)continue;
   const d=Math.PI/180,p=(c.OffsetRotation.Pitch??0)*d,y=(c.OffsetRotation.Yaw??0)*d,r=(c.OffsetRotation.Roll??0)*d;
   // UE rotator applied to capsule Z; mirror local Y into imported bone space.
   const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-r,-p,y,'ZYX'));
   const axis=new THREE.Vector3(0,0,1).applyQuaternion(rotation);axis.y*=-1;
   const v=c.OffsetLocation;this.capsules.push({bone,offset:new THREE.Vector3(v.X??0,-(v.Y??0),v.Z??0).multiplyScalar(.01),axis,half:c.Length*.005,radius:c.Radius*.01});
  }
 }
 reset(){this.root.updateMatrixWorld(true);for(const s of this.springs){s.child.getWorldPosition(s.tip);s.previous.copy(s.tip);s.goal.copy(s.tip)}}
 update(dt:number,paused:boolean){
  this.root.updateMatrixWorld(true);
  const step=Math.min(dt,.033)*60,origin=new THREE.Vector3(),goal=new THREE.Vector3(),velocity=new THREE.Vector3(),target=new THREE.Vector3(),dir=new THREE.Vector3(),restDir=new THREE.Vector3(),parentQ=new THREE.Quaternion(),delta=new THREE.Quaternion();
  const capsules=this.capsules.map(c=>{const center=c.offset.clone().applyMatrix4(c.bone.matrixWorld),axis=c.axis.clone().transformDirection(c.bone.matrixWorld).multiplyScalar(c.half);return {a:center.clone().sub(axis),b:center.add(axis),radius:c.radius};});
  for(const s of this.springs){
   s.bone.getWorldPosition(origin);s.child.getWorldPosition(goal);const length=origin.distanceTo(goal);if(length<1e-5)continue;
   if(!paused){
    const cfg=s.config.settings;
    velocity.subVectors(s.tip,s.previous).multiplyScalar(Math.pow(1-THREE.MathUtils.clamp(cfg.Damping,.02,.95),step));
    // Inertial follow uses source world-damping; remaining lag drives secondary motion.
    s.tip.add(target.subVectors(goal,s.goal).multiplyScalar(THREE.MathUtils.clamp(cfg.WorldDampingLocation,0,1)));
    s.previous.copy(s.tip);s.tip.addScaledVector(velocity,step).lerp(goal,1-Math.pow(1-THREE.MathUtils.clamp(cfg.Stiffness,.015,.9),step));
    s.goal.copy(goal);
    for(const c of capsules){
     const segment=c.b.clone().sub(c.a),den=segment.lengthSq();
     const closest=(v:THREE.Vector3)=>c.a.clone().addScaledVector(segment,den?THREE.MathUtils.clamp(v.clone().sub(c.a).dot(segment)/den,0,1):0);
     // Do not push authored resting strands out of intentionally intersecting volumes.
     const radius=c.radius+s.config.settings.Radius*.01;
     if(goal.distanceTo(closest(goal))<radius)continue;
     const near=closest(s.tip);dir.subVectors(s.tip,near);if(dir.lengthSq()<radius*radius&&dir.lengthSq()>1e-9)s.tip.copy(near).add(dir.setLength(radius));
    }
   }
   restDir.subVectors(goal,origin).normalize();dir.subVectors(s.tip,origin).normalize();
   const angle=restDir.angleTo(dir),limit=THREE.MathUtils.degToRad(s.config.settings.LimitAngle||25);
   delta.setFromUnitVectors(restDir,dir);if(angle>limit)delta.slerp(new THREE.Quaternion(),1-limit/angle);
   target.copy(restDir).applyQuaternion(delta).multiplyScalar(length).add(origin);s.tip.copy(target);
   s.bone.parent?.getWorldQuaternion(parentQ);delta.premultiply(parentQ.clone().invert()).multiply(parentQ);
   s.bone.quaternion.premultiply(delta).normalize();s.bone.updateMatrixWorld(true);
  }
 }
}
