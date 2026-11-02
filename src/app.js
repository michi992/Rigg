import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {SoftwareRenderer} from './software-renderer.js';
import {FPS,LAST_FRAME,clone,radians,degrees,humanoidJoints,defaultPose,demoParts,normalizeParts,validateJoints,isDescendant,buildRig,applyPose,samplePose,animationClip} from './rig-core.js';

const $=id=>document.getElementById(id);
const paths={
  rig:'<path d="m12 3-5 5 5 5 5-5-5-5Zm0 10-5 5 5 3 5-3-5-5ZM7 8l-4 4 4 6m10-10 4 4-4 6"/>',
  joint:'<path d="m7 17 10-10M7 7l10 10"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/>',
  cube:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9v9M4 7.5l8 4.5 8-4.5M8 5.3l8 4.5"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  export:'<path d="M13 3h8v8m0-8L10 14M9 5H4v16h16v-5"/>',
  folder:'<path d="M3 7V4h6l2 3h10v13H3V7Zm0 3h18"/>',
  save:'<path d="M4 3h13l4 4v14H3V3h1Zm3 0v7h9V3M7 21v-7h10v7"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.6 2.6 0 0 1 5 .8c0 2-2.5 2-2.5 4.2m0 3h.01"/>',
  undo:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  redo:'<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"/>',
  pose:'<circle cx="12" cy="4" r="2"/><path d="M12 6v8m-7-5 7 2 7-4m-7 7-5 7m5-7 5 7"/>',
  weights:'<path d="M4 17c0-4 4-11 8-14 4 3 8 10 8 14a8 8 0 0 1-16 0Z"/><path d="M8 16a4 4 0 0 0 4 4"/>',
  grid:'<path d="m12 4 10 14H2L12 4Zm-4 6h8M5 14h14M12 4v14m0-14L7 18m5-14 5 14"/>',
  wire:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 0v20M3 7l18 10M21 7 3 17m0-10 9 5 9-5M3 17l9-5 9 5"/>',
  focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
  timeline:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11m6-11v11"/>',
  play:'<path d="m8 4 12 8-12 8V4Z"/>',
  pause:'<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  start:'<path d="M5 5v14m13-14L7 12l11 7V5Z"/>',
  diamond:'<path d="m12 3 9 9-9 9-9-9 9-9Z"/>',
  sliders:'<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  move:'<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',
  rotate:'<path d="M4 9a8 8 0 1 1 0 6M4 3v6h6"/>',
  sparkles:'<path d="m13 3 2.4 6.6L22 12l-6.6 2.4L13 21l-2.4-6.6L4 12l6.6-2.4L13 3ZM4 2v5M1.5 4.5h5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  bulb:'<path d="M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7H8Zm0 3h8m-6 3h4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  arrow:'<path d="M3 12h18m-7-7 7 7-7 7"/>'
};
function icon(name) {return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.joint)+'</svg>';}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
function toast(message,error=false) {
  const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=message;
  $('toasts').append(el);setTimeout(()=>el.remove(),error?9000:4300);
}
function status(text){$('status-text').textContent=text;}
function busy(on,message='Einen Moment …') {$('loading-overlay').hidden=!on;$('loading-text').textContent=message;}
const nextPaint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
function confirmAction(title,body) {
  $('confirm-title').textContent=title;$('confirm-body').textContent=body;$('confirm-dialog').showModal();
  return new Promise(resolve=>{
    $('confirm-ok').onclick=()=>{$('confirm-dialog').close();resolve(true);};
    $('confirm-cancel').onclick=()=>{$('confirm-dialog').close();resolve(false);};
    $('confirm-dialog').oncancel=()=>resolve(false);
  });
}

function freshState() {
  const joints=humanoidJoints();
  return {format:'dewald-rig-studio',version:1,name:'Mein Charakter',source:{kind:'demo',name:'Studio-Bot'},joints,pose:defaultPose(joints),keys:[],falloff:3,frame:0,selected:'chest',mode:'rig'};
}
let state=freshState(),parts=[],rig=null,renderer,scene,camera,perspective,ortho,orbit,gizmo,gizmoHelper;
let selectedProxy=new THREE.Object3D(),bonesGroup=new THREE.Group(),boneVisuals=[],jointVisuals=[],floor,grid,axes;
let playing=false,lastTime=0,frameClock=0,busyImport=false,wireframe=false,showBones=true,showGrid=true,dragging=false,software=false;
let undoStack=[],redoStack=[],saveTimer=null,db=null,storageFailed=false,dirty=false,dragged=false;
const baseMaterial=new THREE.MeshStandardMaterial({color:0x99b5a4,roughness:.55,metalness:.12});
const weightMaterial=new THREE.MeshBasicMaterial({vertexColors:true});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

function snapshot() {const {source,...rest}=state;return {...clone(rest),source};}
function remember() {undoStack.push(snapshot());if(undoStack.length>30)undoStack.shift();redoStack=[];refreshUndo();}
function refreshUndo() {$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;}
function mutation() {dirty=true;scheduleSave();refreshUndo();}
function storageLabel(text,success=true) {
  const el=$('save-state');el.replaceChildren();
  const dot=document.createElement('i');dot.style.background=success?'#72bba0':'#cfaa76';el.append(dot,document.createTextNode(text));
}
async function openDatabase() {
  try {
    db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('dewald-rig-studio',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('projects');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    return await new Promise((resolve,reject)=>{
      const req=db.transaction('projects').objectStore('projects').get('current');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }catch {storageFailed=true;storageLabel('Bitte Projektdatei speichern',false);return null;}
}
function scheduleSave() {
  clearTimeout(saveTimer);storageLabel('Änderungen werden gesichert …');
  saveTimer=setTimeout(()=>{
    if(!db || storageFailed){storageLabel('Bitte Projektdatei speichern',false);return;}
    try {
      const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(snapshot(),'current');
      tx.oncomplete=()=>storageLabel('Lokal gespeichert');
      tx.onerror=()=>{storageLabel('Sicherung per „Speichern“ nötig',false);toast('Automatisches Speichern nicht möglich. Lade deine Projektdatei über „Speichern“ herunter.',true);};
    }catch {storageLabel('Bitte Projektdatei speichern',false);}
  },650);
}

function setupScene() {
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:false});
  }catch(error) {
    renderer=new SoftwareRenderer();software=true;
    $('status-right').textContent='Software-3D · Werte rechts bearbeiten';
    $('viewport-guide').innerHTML=icon('mouse')+'<span><b>Ziehen</b> drehen <em>·</em> <b>Scrollen</b> zoomen <em>·</em> <b>Knochen</b> rechts bearbeiten</span>';
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  $('viewport').prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interaktive 3D-Ansicht des Charakters und seines Skeletts');
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x202a28);scene.fog=new THREE.Fog(0x202a28,11,26);
  perspective=new THREE.PerspectiveCamera(36,1,.01,100);
  ortho=new THREE.OrthographicCamera(-3,3,3,-3,.01,100);
  camera=perspective;camera.position.set(4,3.1,7.5);
  orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.target.set(0,1.45,0);orbit.minDistance=1;orbit.maxDistance=18;orbit.maxPolarAngle=Math.PI*.97;
  scene.add(new THREE.HemisphereLight(0xd7f0e2,0x455b51,2.1));
  const key=new THREE.DirectionalLight(0xe2f6ef,3.5);key.position.set(3,7,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-4;key.shadow.bias=-.0007;scene.add(key);
  const rim=new THREE.DirectionalLight(0x9acef0,2);rim.position.set(-4,3,-3);scene.add(rim);
  const fill=new THREE.DirectionalLight(0x9ed9b3,1);fill.position.set(-4,2,3);scene.add(fill);
  floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x202c27,roughness:.95,metalness:.05}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.receiveShadow=true;scene.add(floor);
  grid=new THREE.GridHelper(30,60,0x5d7366,0x34493c);grid.position.y=-.022;grid.material.transparent=true;grid.material.opacity=.42;scene.add(grid);
  axes=new THREE.Group();
  const axisLines=[[[0,0,-15],[0,0,15],0x4b6685],[[-15,0,0],[15,0,0],0x825b58]];
  axisLines.forEach(([a,b,color])=>{const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.4}));line.position.y=-.019;axes.add(line);});scene.add(axes);
  scene.add(bonesGroup,selectedProxy);
  gizmo=new TransformControls(camera,renderer.domElement);gizmo.setSize(.65);gizmoHelper=gizmo.getHelper();scene.add(gizmoHelper);
  gizmo.addEventListener('dragging-changed',e=>{
    dragging=e.value;orbit.enabled=!e.value;
    if(e.value){remember();stopPlaying();}
    else if(dragged){dragged=false;if(state.mode==='rig'){invalidateAnimation();rebuildRig();}mutation();updateInspector();}
  });
  gizmo.addEventListener('objectChange',()=>{
    const joint=state.joints.find(j=>j.id===state.selected);if(!joint||!rig)return;
    dragged=true;
    if(state.mode==='rig') {
      joint.position=selectedProxy.position.toArray();
      syncRestBones();updateInspector();
    } else if(state.mode==='pose') {
      const e=rig.boneMap.get(joint.id).rotation;state.pose[joint.id]=[e.x,e.y,e.z];rig.group.updateMatrixWorld(true);rig.skeleton.update();updateInspector();
    }
  });
  renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5||dragging||gizmo.axis)return;
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects([...jointVisuals,...boneVisuals],false);
    if(hits.length)selectBone(hits[0].object.userData.boneId);
  });
  if(!software)renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stopPlaying();toast('Der 3D-Kontext wurde unterbrochen. Speichere dein Projekt und lade die Seite neu.',true);});
  new ResizeObserver(resize).observe($('viewport'));resize();requestAnimationFrame(tick);
}
let pointerDown=null;
function resize() {
  if(!renderer)return;const w=$('viewport').clientWidth,h=$('viewport').clientHeight;
  renderer.setSize(w,h,false);perspective.aspect=w/h;perspective.updateProjectionMatrix();
  const half=2.05;ortho.left=-half*w/h;ortho.right=half*w/h;ortho.top=half;ortho.bottom=-half;ortho.updateProjectionMatrix();
}
function switchCamera(view='perspective') {
  camera=view==='perspective'?perspective:ortho;
  const positions={perspective:[4,3.1,7.5],front:[0,1.5,8],side:[8,1.5,0],top:[0,8,0]};
  camera.position.fromArray(positions[view]||positions.perspective);camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);
  if(view==='perspective'){perspective.fov=36;perspective.updateProjectionMatrix();}else{ortho.zoom=1;ortho.updateProjectionMatrix();}
  orbit.object=camera;orbit.target.set(0,1.5,0);orbit.enableRotate=view==='perspective';orbit.update();gizmo.camera=camera;resize();
}
function focusModel(){switchCamera($('camera-view').value);status('Ansicht zentriert');}
function clearRig() {
  gizmo?.detach();
  if(rig){scene.remove(rig.group);rig.meshes.forEach(m=>m.geometry.dispose());rig.skeleton.dispose();}
  rig=null;
}
function rebuildRig() {
  clearRig();rig=buildRig(parts,state.joints,state.falloff);scene.add(rig.group);
  applyPose(rig,state.mode==='rig'?defaultPose(state.joints):state.pose);
  rebuildBoneVisuals();updateDisplayMaterials();attachGizmo();updateMetrics();
}
function syncRestBones() {
  for(const j of state.joints) {
    const p=state.joints.find(x=>x.id===j.parent),bone=rig.boneMap.get(j.id);
    bone.position.fromArray(j.position);if(p)bone.position.sub(new THREE.Vector3(...p.position));bone.rotation.set(0,0,0);
  }
  rig.group.updateMatrixWorld(true);rig.skeleton.calculateInverses();rig.skeleton.update();
}
function rebuildBoneVisuals() {
  bonesGroup.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});bonesGroup.clear();boneVisuals=[];jointVisuals=[];
  for(const j of state.joints) {
    const joint=new THREE.Mesh(new THREE.SphereGeometry(.035,12,10),new THREE.MeshBasicMaterial({color:0xa8efd0,depthTest:false,transparent:true,opacity:.95}));
    joint.userData.boneId=j.id;joint.renderOrder=10;bonesGroup.add(joint);jointVisuals.push(joint);
    if(j.parent) {
      const vertices=new Float32Array([0,0,0,-.032,.18,0,0,.18,.032,.032,.18,0,0,.18,-.032,0,1,0]);
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
      geometry.setIndex([0,1,2,0,2,3,0,3,4,0,4,1,5,2,1,5,3,2,5,4,3,5,1,4]);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xa4eacb,depthTest:false,transparent:true,opacity:.68,side:THREE.DoubleSide}));
      mesh.userData.boneId=j.id;mesh.userData.parentId=j.parent;mesh.renderOrder=9;bonesGroup.add(mesh);boneVisuals.push(mesh);
    }
  }
}
const segmentStart=new THREE.Vector3(),segmentEnd=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
function updateBoneVisuals() {
  if(!rig)return;bonesGroup.visible=showBones;
  for(const m of jointVisuals) {
    rig.boneMap.get(m.userData.boneId).getWorldPosition(m.position);
    const selected=m.userData.boneId===state.selected;m.scale.setScalar(selected?1.6:1);m.material.color.set(selected?0xf2ffe6:0x9ce9c2);
  }
  for(const m of boneVisuals) {
    rig.boneMap.get(m.userData.parentId).getWorldPosition(segmentStart);rig.boneMap.get(m.userData.boneId).getWorldPosition(segmentEnd);
    direction.copy(segmentEnd).sub(segmentStart);const length=direction.length();m.position.copy(segmentStart);m.scale.set(1,length,1);
    if(length>1e-5)m.quaternion.setFromUnitVectors(up,direction.normalize());
    const selected=m.userData.boneId===state.selected;m.material.color.set(selected?0xe6ffbe:0x82dbae);m.material.opacity=selected?.95:.62;
  }
}
function attachGizmo() {
  if(!rig||!gizmo)return;const j=state.joints.find(x=>x.id===state.selected);
  if(!j||state.mode==='weights'||playing||software){gizmo.detach();return;}
  if(state.mode==='rig'){selectedProxy.position.fromArray(j.position);selectedProxy.rotation.set(0,0,0);gizmo.setMode('translate');gizmo.setSpace('world');gizmo.attach(selectedProxy);}
  else{gizmo.setMode('rotate');gizmo.setSpace('local');gizmo.attach(rig.boneMap.get(j.id));}
}
function updateDisplayMaterials() {
  if(!rig)return;const selectedIndex=rig.index.get(state.selected)||0;
  rig.meshes.forEach((mesh,i)=>{
    if(state.mode==='weights') {
      const geometry=mesh.geometry,weights=geometry.attributes.skinWeight,indices=geometry.attributes.skinIndex;
      const colors=new Float32Array(weights.count*3),color=new THREE.Color();
      for(let v=0;v<weights.count;v++) {
        let value=0;
        for(let k=0;k<4;k++)if(indices.array[v*4+k]===selectedIndex)value+=weights.array[v*4+k];
        color.setHSL(.65*(1-value),.75,.35+value*.15);
        colors.set([color.r,color.g,color.b],v*3);
      }
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));mesh.material=weightMaterial;
    }else {
      mesh.material=parts[i].material||baseMaterial;
      const originalColor=parts[i].geometry.getAttribute('color');
      if(originalColor)mesh.geometry.setAttribute('color',originalColor);
      else mesh.geometry.deleteAttribute('color');
    }
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(m=>m.wireframe=wireframe);
  });
}
function tick(time) {
  requestAnimationFrame(tick);
  if(!renderer||!rig)return;
  const delta=Math.min((time-lastTime)/1000,.1);lastTime=time;
  if(playing) {
    frameClock+=delta*FPS;if(frameClock>LAST_FRAME)frameClock=0;
    state.frame=Math.floor(frameClock);state.pose=samplePose(state.keys,frameClock,state.joints,state.pose);applyPose(rig,state.pose);refreshTimeline(false);updateRotationInputs();
  }
  orbit.update();updateBoneVisuals();
  if(software)renderer.render(scene,camera,rig,{selected:state.selected,mode:state.mode,showBones,showGrid,wireframe,joints:state.joints});
  else renderer.render(scene,camera);
}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderTree() {
  const rows=[];
  function visit(j,depth) {
    rows.push('<button class="bone-row'+(j.id===state.selected?' selected':'')+'" data-bone="'+esc(j.id)+'" style="padding-left:'+(9+depth*11)+'px" title="'+esc(j.name)+'" aria-pressed="'+(j.id===state.selected)+'">'+(depth?'<span class="tree-indent"></span>':'')+icon('joint')+'<span class="bone-name">'+esc(j.name)+'</span>'+(j.id===state.selected?'<span class="bone-dot"></span>':'')+'</button>');
    state.joints.filter(x=>x.parent===j.id).forEach(c=>visit(c,depth+1));
  }
  state.joints.filter(j=>!j.parent).forEach(j=>visit(j,0));$('bone-tree').innerHTML=rows.join('');
  $('bone-tree').querySelectorAll('[data-bone]').forEach(el=>el.onclick=()=>selectBone(el.dataset.bone));
  $('bone-count').textContent=state.joints.length;
}
function selectBone(id) {
  if(!state.joints.some(j=>j.id===id))return;state.selected=id;renderTree();updateInspector();attachGizmo();updateDisplayMaterials();scheduleSave();
}
function updateInspector() {
  const j=state.joints.find(x=>x.id===state.selected);if(!j)return;
  $('bone-name').value=j.name;$('inspector-name').textContent=j.name;$('selected-pill').textContent=j.name;
  const parent=$('bone-parent');parent.innerHTML='<option value="">Kein Elternknochen</option>'+state.joints.filter(x=>x.id!==j.id&&!isDescendant(state.joints,x.id,j.id)).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');parent.value=j.parent||'';
  parent.disabled=state.mode!=='rig';
  ['x','y','z'].forEach((axis,i)=>{$('pos-'+axis).value=j.position[i].toFixed(3);$('pos-'+axis).disabled=state.mode!=='rig';});
  updateRotationInputs();
  $('delete-bone').disabled=state.joints.length===1;
  $('reset-bone').disabled=state.mode==='rig';
}
function updateRotationInputs() {
  const pose=state.pose[state.selected]||[0,0,0];
  ['x','y','z'].forEach((axis,i)=>{
    const value=Math.round(degrees(pose[i])*10)/10;
    $('rot-'+axis).value=value;$('rot-'+axis+'-slider').value=value;
    $('rot-'+axis).disabled=state.mode==='rig';$('rot-'+axis+'-slider').disabled=state.mode==='rig';
  });
}
function updateMetrics() {
  const vertices=parts.reduce((sum,p)=>sum+p.geometry.attributes.position.count,0);
  $('vertex-count').textContent=vertices.toLocaleString('de-DE')+' Vertices';$('mesh-count').textContent=parts.length+' Meshes';
  $('model-name').textContent=state.source.name;
  $('model-subtitle').textContent=state.source.kind==='demo'?'Beispielmodell · bereit zum Riggen':state.source.kind.toUpperCase()+' · neues Rig';
  $('falloff-value').textContent=state.falloff.toFixed(1).replace('.',',');$('falloff').value=state.falloff;
  $('rig-status-subtitle').textContent='Automatisch · '+Math.min(4,state.joints.length)+' Einflüsse pro Vertex';
}
function setMode(mode,save=true) {
  if(!['rig','pose','weights'].includes(mode))return;
  stopPlaying();state.mode=mode;document.body.dataset.mode=mode;
  document.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('active',el.dataset.mode===mode));
  const titles={rig:['Skelett bearbeiten','REST POSE'],pose:['Pose bearbeiten','FORWARD KINEMATICS'],weights:['Gewichte prüfen','SKIN WEIGHTS']};
  $('viewport-title').textContent=titles[mode][0];$('mode-tag').textContent=titles[mode][1];
  if(rig)applyPose(rig,mode==='rig'?defaultPose(state.joints):state.pose);
  updateDisplayMaterials();attachGizmo();updateInspector();
  if(save)scheduleSave();
}
function refreshTimeline(updateHint=true) {
  $('frame-number').value=state.frame;$('frame-slider').value=state.frame;$('playhead').style.left=(state.frame/LAST_FRAME*100)+'%';
  $('key-count').textContent=state.keys.length+' Keyframe'+(state.keys.length===1?'':'s');
  $('key-markers').innerHTML=state.keys.map(k=>'<span class="key-marker'+(k.frame===state.frame?' current':'')+'" style="left:'+(k.frame/LAST_FRAME*100)+'%" title="Keyframe '+k.frame+'"></span>').join('');
  $('delete-key').disabled=!state.keys.some(k=>k.frame===state.frame);
  if(updateHint)$('timeline-hint').textContent=state.keys.length?'Die gesamte Pose wird pro Keyframe gespeichert.':'Pose einstellen → Keyframe setzen → nächsten Frame wählen.';
}
function setFrame(frame) {
  stopPlaying();state.frame=Math.max(0,Math.min(LAST_FRAME,Math.round(frame)||0));
  if(state.keys.length)state.pose=samplePose(state.keys,state.frame,state.joints,state.pose);
  if(state.mode==='rig')setMode('pose',false);
  applyPose(rig,state.pose);updateInspector();refreshTimeline();scheduleSave();
}
function stopPlaying() {playing=false;if($('play')){$('play').innerHTML=icon('play');$('play').setAttribute('aria-label','Wiedergabe');}if(rig)attachGizmo();}
function togglePlay() {
  if(playing){stopPlaying();return;}
  if(state.keys.length<2){toast('Setze mindestens zwei Keyframes auf unterschiedlichen Frames.');return;}
  setMode('pose',false);playing=true;frameClock=state.frame>=LAST_FRAME?0:state.frame;$('play').innerHTML=icon('pause');$('play').setAttribute('aria-label','Wiedergabe anhalten');gizmo.detach();
}
function invalidateAnimation() {
  if(state.keys.length)toast('Das Skelett wurde geändert. Die bisherigen Animations-Keyframes wurden zurückgesetzt.');
  state.keys=[];state.pose=defaultPose(state.joints);state.frame=0;refreshTimeline();
}
function validateProject(project) {
  if(project?.format!=='dewald-rig-studio'||project.version!==1)throw new Error('Das ist keine unterstützte Rig-Studio-Projektdatei.');
  validateJoints(project.joints);
  if(!project.source||!['demo','obj','glb'].includes(project.source.kind)||typeof project.source.name!=='string'||project.source.name.length>250)throw new Error('Ungültige Modellquelle.');
  if(project.source.kind!=='demo'&&(typeof project.source.data!=='string'||project.source.data.length>50000000))throw new Error('Die Modelldaten fehlen oder sind zu groß.');
  if(typeof project.name!=='string'||project.name.length>60||!Number.isFinite(project.falloff)||project.falloff<1||project.falloff>6)throw new Error('Ungültige Projekteinstellungen.');
  const checkPose=pose=>{
    if(!pose||typeof pose!=='object')throw new Error('Die Pose ist ungültig.');
    project.joints.forEach(j=>{const a=pose[j.id];if(!Array.isArray(a)||a.length!==3||a.some(x=>!Number.isFinite(x)||Math.abs(x)>100))throw new Error('Die Pose enthält ungültige Rotationen.');});
  };
  checkPose(project.pose);
  if(!Array.isArray(project.keys)||project.keys.length>121)throw new Error('Zu viele Keyframes.');
  const frames=new Set();
  project.keys.forEach(k=>{if(!Number.isInteger(k.frame)||k.frame<0||k.frame>LAST_FRAME||frames.has(k.frame))throw new Error('Ungültiger oder doppelter Keyframe.');frames.add(k.frame);checkPose(k.pose);});
  if(!Number.isInteger(project.frame)||project.frame<0||project.frame>LAST_FRAME)throw new Error('Ungültiger Frame.');
  if(!project.joints.some(j=>j.id===project.selected))project.selected=project.joints[0].id;
  if(!['rig','pose','weights'].includes(project.mode))project.mode='rig';
  return project;
}
function bufferToBase64(buffer) {
  const bytes=new Uint8Array(buffer);let s='';
  for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(s);
}
function base64ToBuffer(data) {const s=atob(data),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);return bytes.buffer;}
function safeLoader() {
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{
    if(/^(data:|blob:)/i.test(url))return url;
    throw new Error('Externe Ressourcen sind nicht erlaubt. Bitte eine vollständig eingebettete GLB-Datei verwenden.');
  });
  return new GLTFLoader(manager);
}
async function sourceParts(source) {
  if(source.kind==='demo')return demoParts();
  if(source.kind==='obj')return normalizeParts(new OBJLoader().parse(source.data));
  const gltf=await safeLoader().parseAsync(base64ToBuffer(source.data),'');
  return normalizeParts(gltf.scene);
}
function disposeParts(oldParts) {
  const materials=new Set(),textures=new Set();
  oldParts.forEach(p=>{p.geometry.dispose();(Array.isArray(p.material)?p.material:[p.material]).forEach(m=>materials.add(m));});
  materials.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});m.dispose();});textures.forEach(t=>t.dispose());
}
async function loadState(newState,loadedParts=null) {
  stopPlaying();const prepared=loadedParts||await sourceParts(newState.source);
  clearRig();disposeParts(parts);parts=prepared;state=newState;
  $('project-name').value=state.name;rebuildRig();renderTree();setMode(state.mode,false);refreshTimeline();updateMetrics();refreshUndo();
}
async function openFile(file) {
  if(!file||busyImport)return;
  if(file.size>50*1024*1024){toast('Die Datei ist zu groß. Modelle: höchstens 35 MB; Projekte: höchstens 50 MB.',true);return;}
  const extension=file.name.split('.').at(-1).toLowerCase();
  if(!['glb','obj','json'].includes(extension)){toast('Bitte GLB, OBJ oder eine .rig.json-Projektdatei auswählen.',true);return;}
  if(extension!=='json'&&file.size>35*1024*1024){toast('Modelle dürfen höchstens 35 MB groß sein.',true);return;}
  if(dirty&&!(await confirmAction('Aktuelles Projekt ersetzen?','Speichere dein Projekt über „Speichern“, wenn du es behalten möchtest. Die automatische Browsersicherung wird durch das neue Projekt ersetzt.')))return;
  busyImport=true;busy(true,'Modell wird geladen und gewichtet …');await nextPaint();
  try {
    let next,prepared;
    if(extension==='json') {next=validateProject(JSON.parse(await file.text()));prepared=await sourceParts(next.source);}
    else {
      next=freshState();next.name=file.name.replace(/\.[^.]+$/,'').slice(0,60);
      next.source={kind:extension,name:file.name,data:extension==='obj'?await file.text():bufferToBase64(await file.arrayBuffer())};
      prepared=await sourceParts(next.source);
    }
    await loadState(next,prepared);undoStack=[];redoStack=[];dirty=false;refreshUndo();scheduleSave();focusModel();
    toast(extension==='json'?'Projekt geöffnet.':'Modell importiert. Passe das Humanoid-Skelett im Modus „Skelett“ an dein Modell an.');
    status('Modell geladen und gewichtet');
  }catch(error){console.error(error);toast('Import fehlgeschlagen: '+readableError(error),true);}
  finally{busyImport=false;busy(false);$('file-input').value='';}
}
function readableError(error) {
  const s=String(error?.message||error);
  if(/DRACO|draco|KTX|ktx|Meshopt|meshopt/.test(s))return 'Komprimierte Modelle werden nicht unterstützt. Exportiere eine unkomprimierte GLB-Datei.';
  return s.length>230?s.slice(0,230)+' …':s;
}
function download(data,name,mime='application/octet-stream') {
  const blob=data instanceof Blob?data:new Blob([data],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function slugName(){return state.name.replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/\s+/g,'_')||'Mein_Charakter';}
function saveProject() {download(JSON.stringify(snapshot()),slugName()+'.rig.json','application/json');dirty=false;toast('Projektdatei heruntergeladen. Bewahre sie als Sicherung auf.');status('Projektdatei gespeichert');}
async function exportGLB() {
  if(!rig||busyImport)return;stopPlaying();busy(true,'GLB mit Skelett und Animation erstellen …');await nextPaint();
  try {
    const materialBackup=rig.meshes.map(m=>m.material),poseBackup=clone(state.pose);
    rig.meshes.forEach((m,i)=>{
      m.material=parts[i].material;
      const originalColor=parts[i].geometry.getAttribute('color');
      if(originalColor)m.geometry.setAttribute('color',originalColor);else m.geometry.deleteAttribute('color');
    });
    const allMaterials=new Set(parts.flatMap(p=>Array.isArray(p.material)?p.material:[p.material]));
    const wireBackup=new Map([...allMaterials].map(m=>[m,m.wireframe]));allMaterials.forEach(m=>m.wireframe=false);
    applyPose(rig,defaultPose(state.joints));
    let result;
    try {
      const clip=animationClip(state.keys,state.joints,rig);
      result=await new GLTFExporter().parseAsync(rig.group,{binary:true,trs:true,animations:clip?[clip]:[],onlyVisible:true,maxTextureSize:2048});
    } finally {
      allMaterials.forEach(m=>m.wireframe=wireBackup.get(m));rig.meshes.forEach((m,i)=>m.material=materialBackup[i]);
      applyPose(rig,state.mode==='rig'?defaultPose(state.joints):poseBackup);
      updateDisplayMaterials();
    }
    download(result,slugName()+'.glb','model/gltf-binary');
    toast('GLB exportiert: Mesh, '+state.joints.length+' Knochen, Gewichte'+(state.keys.length?' und Animation.':'. Die aktuelle Pose bleibt in deiner Projektdatei; GLB enthält die Ruhepose.'));
    status('GLB erfolgreich exportiert');
  } catch(error){console.error(error);toast('Export fehlgeschlagen: '+readableError(error),true);}
  finally{busy(false);}
}
async function historyStep(from,to) {
  if(!from.length||busyImport)return;stopPlaying();const next=from.pop();to.push(snapshot());
  try{await loadState(next);mutation();status('Änderung '+(from===undoStack?'rückgängig gemacht':'wiederholt'));}catch(error){toast(readableError(error),true);}
}
async function doNewProject() {
  if(!(await confirmAction('Neues Projekt starten?','Das Studio startet wieder mit dem Beispielmodell. Lade dein aktuelles Projekt vorher über „Speichern“ herunter, wenn du es behalten möchtest.')))return;
  remember();await loadState(freshState());mutation();focusModel();toast('Neues Projekt mit Studio-Bot gestartet.');
}
function setJointPosition(axis,value) {
  if(state.mode!=='rig'||!Number.isFinite(value)||Math.abs(value)>100)return;
  remember();const j=state.joints.find(x=>x.id===state.selected);j.position[axis]=value;invalidateAnimation();rebuildRig();updateInspector();mutation();status('Knochenposition geändert');
}
function setRotation(axis,value,record=true) {
  if(!Number.isFinite(value)||state.mode==='rig')return;
  stopPlaying();if(record)remember();state.pose[state.selected][axis]=radians(Math.max(-180,Math.min(180,value)));
  applyPose(rig,state.pose);updateRotationInputs();mutation();status('Pose geändert · mit Keyframe sichern');
}
function addBone() {
  if(state.joints.length>=100){toast('Es sind höchstens 100 Knochen pro Projekt möglich.',true);return;}
  remember();stopPlaying();const parent=state.joints.find(j=>j.id===state.selected);
  const id='bone_'+THREE.MathUtils.generateUUID().replaceAll('-','').slice(0,12);
  state.joints.push({id,name:'Knochen '+(state.joints.length+1),parent:parent.id,position:[parent.position[0],parent.position[1]+.25,parent.position[2]]});
  state.selected=id;invalidateAnimation();rebuildRig();renderTree();setMode('rig',false);mutation();toast('Kindknochen hinzugefügt. Ziehe die Achsen oder ändere seine Position rechts.');
}
function deleteBone() {
  if(state.joints.length<=1)return;remember();stopPlaying();
  const current=state.joints.find(j=>j.id===state.selected);
  state.joints.filter(j=>j.parent===current.id).forEach(j=>j.parent=current.parent);
  state.joints=state.joints.filter(j=>j.id!==current.id);state.selected=current.parent||state.joints[0].id;
  invalidateAnimation();rebuildRig();renderTree();updateInspector();mutation();toast('Knochen gelöscht. Kindknochen wurden neu zugeordnet.');
}
function setPreset(kind) {
  remember();setMode('pose',false);state.pose=defaultPose(state.joints);
  if(kind==='wave') {
    if(state.pose.arm_L)state.pose.arm_L[2]=radians(48);
    if(state.pose.forearm_L)state.pose.forearm_L[2]=radians(60);
    if(state.pose.hand_L)state.pose.hand_L[1]=radians(20);
    if(state.pose.head)state.pose.head[2]=radians(-8);
    if(state.pose.arm_R)state.pose.arm_R[2]=radians(57);
    if(!state.pose.arm_L)toast('Dein Rig verwendet eigene Knochen. Das Winken-Preset benötigt die ursprünglichen Humanoid-IDs.');
  }
  applyPose(rig,state.pose);updateInspector();mutation();status(kind==='wave'?'Pose: Winken':'Ruhepose hergestellt');
}

function setupEvents() {
  $('undo').onclick=()=>historyStep(undoStack,redoStack);$('redo').onclick=()=>historyStep(redoStack,undoStack);
  $('save-project').onclick=saveProject;$('export').onclick=exportGLB;
  $('open-project').onclick=()=>{$('file-input').accept='.rig.json,.json';$('file-input').click();};
  $('import-model').onclick=()=>{$('file-input').accept='.glb,.obj';$('file-input').click();};
  $('file-input').onchange=()=>openFile($('file-input').files[0]);
  $('new-project').onclick=doNewProject;
  document.querySelector('.brand').onclick=e=>{e.preventDefault();focusModel();};
  $('help-button').onclick=()=>$('help-dialog').showModal();
  $('close-help').onclick=()=>$('help-dialog').close();$('start-working').onclick=()=>$('help-dialog').close();
  document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>setMode(el.dataset.mode));
  $('project-name').onfocus=()=>{$('project-name').dataset.previous=state.name;};
  $('project-name').onchange=()=>{const name=$('project-name').value.trim().slice(0,60)||'Mein Charakter';remember();state.name=name;$('project-name').value=name;mutation();};
  $('bone-name').onchange=()=>{
    const name=$('bone-name').value.trim().slice(0,60);if(!name){updateInspector();return;}
    remember();state.joints.find(j=>j.id===state.selected).name=name;renderTree();updateInspector();mutation();
  };
  $('bone-parent').onchange=()=>{
    if(state.mode!=='rig')return;remember();const j=state.joints.find(x=>x.id===state.selected);
    j.parent=$('bone-parent').value||null;invalidateAnimation();rebuildRig();renderTree();updateInspector();mutation();
  };
  ['x','y','z'].forEach((axis,i)=>{
    $('pos-'+axis).onchange=()=>setJointPosition(i,parseFloat($('pos-'+axis).value));
    $('rot-'+axis).oninput=()=>setRotation(i,parseFloat($('rot-'+axis).value));
    const slider=$('rot-'+axis+'-slider');
    slider.addEventListener('pointerdown',()=>{remember();stopPlaying();});
    slider.oninput=()=>setRotation(i,Number(slider.value),false);
    slider.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)&&!e.repeat)remember();});
  });
  $('add-bone').onclick=addBone;$('delete-bone').onclick=deleteBone;
  $('reset-bone').onclick=()=>{remember();stopPlaying();state.pose[state.selected]=[0,0,0];applyPose(rig,state.pose);updateInspector();mutation();};
  $('rest-pose').onclick=()=>setPreset('rest');$('wave-pose').onclick=()=>setPreset('wave');
  $('mirror').onclick=()=>{
    remember();setMode('pose',false);const old=clone(state.pose);
    for(const j of state.joints){const partner=j.id.endsWith('_L')?j.id.slice(0,-2)+'_R':j.id.endsWith('_R')?j.id.slice(0,-2)+'_L':j.id;const p=old[partner]||old[j.id];state.pose[j.id]=[p[0],-p[1],-p[2]];}
    applyPose(rig,state.pose);updateInspector();mutation();toast('Pose über die X-Achse gespiegelt.');
  };
  $('falloff').oninput=()=>$('falloff-value').textContent=Number($('falloff').value).toFixed(1).replace('.',',');
  $('falloff').onchange=()=>{remember();state.falloff=Number($('falloff').value);rebuildRig();mutation();toast('Einflussabfall geändert und Gewichte berechnet.');};
  $('auto-weights').onclick=async()=>{
    busy(true,'Gewichte werden berechnet …');await nextPaint();
    try{rebuildRig();mutation();toast('Gewichte für '+state.joints.length+' Knochen neu berechnet.');status('Gewichtung aktualisiert');}catch(error){toast(readableError(error),true);}finally{busy(false);}
  };
  $('toggle-bones').onclick=()=>{showBones=!showBones;$('toggle-bones').classList.toggle('active',showBones);$('toggle-bones').setAttribute('aria-pressed',String(showBones));};
  $('toggle-wire').onclick=()=>{wireframe=!wireframe;$('toggle-wire').classList.toggle('active',wireframe);$('toggle-wire').setAttribute('aria-pressed',String(wireframe));updateDisplayMaterials();};
  $('toggle-grid').onclick=()=>{showGrid=!showGrid;grid.visible=showGrid;axes.visible=showGrid;$('toggle-grid').classList.toggle('active',showGrid);$('toggle-grid').setAttribute('aria-pressed',String(showGrid));};
  $('focus').onclick=focusModel;$('camera-view').onchange=()=>switchCamera($('camera-view').value);
  $('play').onclick=togglePlay;$('to-start').onclick=()=>setFrame(0);
  $('frame-slider').oninput=()=>setFrame(Number($('frame-slider').value));
  $('frame-number').oninput=()=>setFrame(Number($('frame-number').value));
  $('add-key').onclick=()=>{
    stopPlaying();remember();if(state.mode==='rig')setMode('pose',false);
    const existing=state.keys.find(k=>k.frame===state.frame);
    if(existing)existing.pose=clone(state.pose);else state.keys.push({frame:state.frame,pose:clone(state.pose)});
    state.keys.sort((a,b)=>a.frame-b.frame);refreshTimeline();mutation();toast('Keyframe bei Frame '+state.frame+(existing?' aktualisiert.':' gesetzt.'));
  };
  $('delete-key').onclick=()=>{if(!state.keys.some(k=>k.frame===state.frame))return;remember();state.keys=state.keys.filter(k=>k.frame!==state.frame);refreshTimeline();mutation();};
  $('download-offline').onclick=async()=>{
    if(location.protocol==='file:'){toast('Du verwendest bereits die Offline-Version. Bewahre diese HTML-Datei auf.');return;}
    try{const response=await fetch('./dewald-rig-studio.html');if(!response.ok)throw new Error('Download nicht verfügbar');download(await response.blob(),'Dewald_Rig_Studio.html','text/html');toast('Offline-Version heruntergeladen. Öffne die HTML-Datei per Doppelklick.');}
    catch(error){toast('Offline-Download fehlgeschlagen: '+readableError(error),true);}
  };
  document.addEventListener('keydown',e=>{
    const editing=['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
    if(e.key==='Escape'){stopPlaying();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject();return;}
    if(editing||document.querySelector('dialog[open]'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?historyStep(redoStack,undoStack):historyStep(undoStack,redoStack);}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();historyStep(redoStack,undoStack);}
    else if(e.code==='Space'){e.preventDefault();togglePlay();}
    else if(e.key.toLowerCase()==='f')focusModel();
  });
  let dragDepth=0;
  document.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragDepth++;$('drop-zone').classList.add('visible');}});
  document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});
  document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('drop-zone').classList.remove('visible');});
  document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-zone').classList.remove('visible');openFile(e.dataTransfer.files[0]);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlaying();});
  for(let frame=0;frame<=LAST_FRAME;frame+=10) {const el=document.createElement('span');el.textContent=frame;el.style.left=(frame/LAST_FRAME*100)+'%';$('time-ruler').append(el);}
}

async function start() {
  try {
    setupScene();setupEvents();
    const saved=await openDatabase();
    if(saved) {
      try{await loadState(validateProject(saved));toast('Dein zuletzt bearbeitetes Projekt wurde wiederhergestellt.');}
      catch(error){console.warn('Projekt konnte nicht wiederhergestellt werden',error);await loadState(freshState());toast('Die Browsersicherung konnte nicht geladen werden. Öffne bei Bedarf deine Projektdatei.',true);}
    }else await loadState(freshState());
    busy(false);status('Bereit · wähle einen Knochen und leg los');scheduleSave();
  }catch(error){busy(false);console.error(error);toast('Start fehlgeschlagen: '+readableError(error),true);status('Start fehlgeschlagen');}
}
start();
