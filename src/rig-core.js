import * as THREE from 'three';

export const FPS = 24;
export const LAST_FRAME = 120;
export const MAX_VERTICES = 300000;
export const radians = x => x * Math.PI / 180;
export const degrees = x => x * 180 / Math.PI;
export const clone = x => structuredClone(x);

export function humanoidJoints() {
  const data = [
    ['hips', 'Becken', null, [0, 1.35, 0]],
    ['spine', 'Wirbelsäule', 'hips', [0, 1.68, 0]],
    ['chest', 'Brust', 'spine', [0, 2.04, 0]],
    ['neck', 'Hals', 'chest', [0, 2.33, 0]],
    ['head', 'Kopf', 'neck', [0, 2.57, 0]],
    ['arm_L', 'Oberarm.L', 'chest', [.39, 2.12, 0]],
    ['forearm_L', 'Unterarm.L', 'arm_L', [.94, 2.12, 0]],
    ['hand_L', 'Hand.L', 'forearm_L', [1.43, 2.12, 0]],
    ['arm_R', 'Oberarm.R', 'chest', [-.39, 2.12, 0]],
    ['forearm_R', 'Unterarm.R', 'arm_R', [-.94, 2.12, 0]],
    ['hand_R', 'Hand.R', 'forearm_R', [-1.43, 2.12, 0]],
    ['thigh_L', 'Oberschenkel.L', 'hips', [.22, 1.32, 0]],
    ['shin_L', 'Unterschenkel.L', 'thigh_L', [.22, .72, 0]],
    ['foot_L', 'Fuß.L', 'shin_L', [.22, .14, .04]],
    ['thigh_R', 'Oberschenkel.R', 'hips', [-.22, 1.32, 0]],
    ['shin_R', 'Unterschenkel.R', 'thigh_R', [-.22, .72, 0]],
    ['foot_R', 'Fuß.R', 'shin_R', [-.22, .14, .04]]
  ];
  return data.map(([id, name, parent, position]) => ({id, name, parent, position}));
}

export function defaultPose(joints) {
  return Object.fromEntries(joints.map(j => [j.id, [0, 0, 0]]));
}

export function demoParts() {
  const parts = [];
  const clay = new THREE.MeshStandardMaterial({color:0x839dae, metalness:.15, roughness:.5});
  const dark = new THREE.MeshStandardMaterial({color:0x33454b, metalness:.1, roughness:.55});
  const accent = new THREE.MeshStandardMaterial({color:0x76edc7, metalness:.1, roughness:.4});
  const sphere = (p, scale, material=clay, name='Körper') => {
    const g = new THREE.SphereGeometry(1, 24, 18);
    g.scale(...scale); g.translate(...p);
    const m = new THREE.Mesh(g, material); m.name=name; parts.push(m);
  };
  const limb = (start, end, radius, material=clay) => {
    const a=new THREE.Vector3(...start), b=new THREE.Vector3(...end);
    const d=a.distanceTo(b);
    const g = new THREE.CapsuleGeometry(radius, Math.max(.001,d-radius*2), 8, 16, 12);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
    g.applyQuaternion(q); g.translate(...a.add(b).multiplyScalar(.5).toArray());
    parts.push(new THREE.Mesh(g,material));
  };
  sphere([0,1.43,0],[.34,.27,.22]);
  sphere([0,1.85,0],[.38,.46,.22]);
  limb([0,2.24,0],[0,2.52,0],.12,dark);
  sphere([0,2.69,0],[.235,.29,.215]);
  sphere([0,2.72,.188],[.17,.072,.048],dark,'Visier');
  sphere([-.07,2.72,.232],[.023,.021,.012],accent,'Auge');
  sphere([.07,2.72,.232],[.023,.021,.012],accent,'Auge');
  for(const sign of [-1,1]) {
    limb([sign*.32,2.12,0],[sign*.91,2.12,0],.125);
    sphere([sign*.94,2.12,0],[.125,.125,.125],dark);
    limb([sign*.97,2.12,0],[sign*1.43,2.12,0],.1);
    sphere([sign*1.5,2.12,0],[.135,.095,.085]);
    limb([sign*.22,1.35,0],[sign*.22,.75,0],.15);
    sphere([sign*.22,.72,0],[.13,.13,.13],dark);
    limb([sign*.22,.69,0],[sign*.22,.15,0],.115);
    sphere([sign*.22,.11,.09],[.135,.11,.24],dark);
  }
  return parts;
}

export function normalizeParts(object) {
  object.updateMatrixWorld(true);
  const parts = [];
  let vertices = 0;
  object.traverse(mesh => {
    if(!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    if(mesh.isInstancedMesh) throw new Error('Instanzierte Meshes bitte vor dem Export in einzelne Meshes umwandeln.');
    vertices += mesh.geometry.attributes.position.count;
    if(vertices > MAX_VERTICES) throw new Error('Das Modell hat zu viele Vertices. Bitte auf höchstens 300.000 reduzieren.');
    const geometry = mesh.geometry.clone();
    // Freeze an imported skin in its currently loaded pose before creating a new rig.
    if(mesh.isSkinnedMesh) {
      const p=geometry.attributes.position, v=new THREE.Vector3();
      mesh.skeleton.update();
      for(let i=0;i<p.count;i++) {
        v.fromBufferAttribute(p,i);
        mesh.applyBoneTransform(i,v);
        p.setXYZ(i,v.x,v.y,v.z);
      }
      geometry.deleteAttribute('skinIndex');
      geometry.deleteAttribute('skinWeight');
      geometry.computeVertexNormals();
    }
    geometry.morphAttributes = {};
    geometry.applyMatrix4(mesh.matrixWorld);
    if(!geometry.attributes.normal) geometry.computeVertexNormals();
    const material = Array.isArray(mesh.material) ? mesh.material.map(m=>m.clone()) : mesh.material.clone();
    const part = new THREE.Mesh(geometry,material);
    part.name = mesh.name || 'Mesh';
    parts.push(part);
  });
  if(!parts.length) throw new Error('Die Datei enthält kein unterstütztes 3D-Mesh.');
  const box = new THREE.Box3();
  parts.forEach(p=> {p.geometry.computeBoundingBox();box.union(p.geometry.boundingBox);});
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(longest) || longest < 1e-6) throw new Error('Das Modell hat keine gültige Größe.');
  const factor = 3 / (size.y > longest*.1 ? size.y : longest);
  const c = box.getCenter(new THREE.Vector3());
  const matrix = new THREE.Matrix4().makeTranslation(-c.x,-box.min.y,-c.z).premultiply(new THREE.Matrix4().makeScale(factor,factor,factor));
  parts.forEach(p=>p.geometry.applyMatrix4(matrix));
  return parts;
}

export function validateJoints(joints) {
  if(!Array.isArray(joints) || joints.length < 1 || joints.length > 100) throw new Error('Ein Projekt benötigt 1 bis 100 Knochen.');
  const ids = new Set(joints.map(j=>j.id));
  if(ids.size !== joints.length || joints.some(j => typeof j.id!=='string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(j.id))) throw new Error('Ungültige Knochen-IDs.');
  for(const j of joints) {
    if(typeof j.name!=='string' || j.name.length>80 || !Array.isArray(j.position) || j.position.length!==3 || j.position.some(x=>!Number.isFinite(x)||Math.abs(x)>100)) throw new Error('Ungültiger Knochen.');
    if(j.parent!==null && !ids.has(j.parent)) throw new Error('Ein Elternknochen fehlt.');
    const visited = new Set([j.id]); let current=j;
    while(current.parent!==null) {
      if(visited.has(current.parent)) throw new Error('Die Knochenhierarchie enthält einen Kreis.');
      visited.add(current.parent); current=joints.find(x=>x.id===current.parent);
    }
  }
}

export function isDescendant(joints, id, ancestor) {
  let j=joints.find(x=>x.id===id);
  while(j?.parent) {if(j.parent===ancestor)return true;j=joints.find(x=>x.id===j.parent);}
  return false;
}

export function buildRig(parts, joints, falloff=3) {
  validateJoints(joints);
  const group = new THREE.Group(); group.name='Dewald_Rig';
  const boneMap=new Map(), index=new Map();
  joints.forEach((j,i)=>{
    const b=new THREE.Bone();b.name=j.id; boneMap.set(j.id,b);index.set(j.id,i);
  });
  for(const j of joints) {
    const b=boneMap.get(j.id), p=joints.find(x=>x.id===j.parent);
    b.position.fromArray(j.position);
    if(p) {b.position.sub(new THREE.Vector3(...p.position));boneMap.get(p.id).add(b);}
    else group.add(b);
  }
  const bones = joints.map(j=>boneMap.get(j.id));
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  const segments = joints.map(j=>{
    const a=new THREE.Vector3(...j.position);
    const children=joints.filter(x=>x.parent===j.id);
    return children.length ? children.map(c=>new THREE.Line3(a,new THREE.Vector3(...c.position))) : [new THREE.Line3(a,a.clone().add(new THREE.Vector3(0,.09,0)))];
  });
  const vertex=new THREE.Vector3(), nearest=new THREE.Vector3();
  const meshes=parts.map((part,partIndex)=>{
    const geometry=part.geometry.clone(), pos=geometry.attributes.position;
    const skinIndices=new Uint16Array(pos.count*4), skinWeights=new Float32Array(pos.count*4);
    for(let v=0;v<pos.count;v++) {
      vertex.fromBufferAttribute(pos,v);
      const candidates=segments.map((segs,i)=>{
        let distance=Infinity;
        for(const segment of segs) {segment.closestPointToPoint(vertex,true,nearest);distance=Math.min(distance,nearest.distanceToSquared(vertex));}
        return {i,w:1/Math.pow(Math.max(.0025,distance),falloff/2)};
      }).sort((a,b)=>b.w-a.w).slice(0,4);
      const total=candidates.reduce((s,c)=>s+c.w,0);
      candidates.forEach((c,k)=>{skinIndices[v*4+k]=c.i;skinWeights[v*4+k]=c.w/total;});
    }
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));
    const m=new THREE.SkinnedMesh(geometry,part.material);
    m.name='Mesh_'+partIndex; m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;
    group.add(m); m.bind(skeleton,new THREE.Matrix4()); return m;
  });
  return {group, skeleton, boneMap, meshes, index};
}

export function applyPose(rig, pose) {
  for(const [id,bone] of rig.boneMap) {
    const angles=pose[id] || [0,0,0]; bone.rotation.set(...angles);
  }
  rig.group.updateMatrixWorld(true); rig.skeleton.update();
}

export function samplePose(keys, frame, joints, fallback) {
  if(!keys.length) return clone(fallback || defaultPose(joints));
  const sorted=[...keys].sort((a,b)=>a.frame-b.frame);
  const a=[...sorted].reverse().find(k=>k.frame<=frame)||sorted[0];
  const b=sorted.find(k=>k.frame>=frame)||sorted.at(-1);
  if(a.frame===b.frame)return clone(a.pose);
  const t=(frame-a.frame)/(b.frame-a.frame);
  const result={}, qa=new THREE.Quaternion(),qb=new THREE.Quaternion(),e=new THREE.Euler();
  for(const j of joints) {
    qa.setFromEuler(e.fromArray([...(a.pose[j.id]||[0,0,0]),'XYZ']));
    qb.setFromEuler(e.fromArray([...(b.pose[j.id]||[0,0,0]),'XYZ']));
    qa.slerp(qb,t);e.setFromQuaternion(qa,'XYZ'); result[j.id]=[e.x,e.y,e.z];
  }
  return result;
}

export function animationClip(keys, joints, rig) {
  if(!keys.length)return null;
  const sorted=[...keys].sort((a,b)=>a.frame-b.frame), times=sorted.map(k=>k.frame/FPS);
  const tracks=joints.map(j=>{
    const values=[],e=new THREE.Euler(),q=new THREE.Quaternion();
    for(const k of sorted) {q.setFromEuler(e.set(...(k.pose[j.id]||[0,0,0])));values.push(...q.toArray());}
    return new THREE.QuaternionKeyframeTrack(rig.boneMap.get(j.id).uuid+'.quaternion',times,values);
  });
  return new THREE.AnimationClip('Dewald_Animation',-1,tracks);
}
