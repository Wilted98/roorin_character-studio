import * as THREE from 'three';
export function posedBounds(root:THREE.Object3D):THREE.Box3{
 root.updateMatrixWorld(true);const bounds=new THREE.Box3(),p=new THREE.Vector3();
 root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.every(m=>m.userData.role==='hidden'||m.userData.role==='tear'))return;
  if(o instanceof THREE.SkinnedMesh)o.skeleton.update();
  const positions=o.geometry.getAttribute('position');if(!positions)return;
  for(let i=0;i<positions.count;i+=3){o.getVertexPosition(i,p);bounds.expandByPoint(p.applyMatrix4(o.matrixWorld));}
 });return bounds;
}
export function frameCharacter(body:THREE.Box3,head:THREE.Box3,mode:'body'|'upper'|'face',aspect:number,fov:number){
 const frame=body.clone();if(mode==='face')frame.copy(head);else if(mode==='upper')frame.min.y=body.min.y+(body.max.y-body.min.y)*.48;
 const size=frame.getSize(new THREE.Vector3()),target=frame.getCenter(new THREE.Vector3());
 const vertical=Math.tan(THREE.MathUtils.degToRad(fov)*.5),horizontal=vertical*Math.max(.2,aspect);
 const distance=Math.max(size.y*.5/vertical,size.x*.5/horizontal)*1.18+size.z*.5;
 return {target,position:target.clone().add(new THREE.Vector3(0,0,distance)),distance};
}
