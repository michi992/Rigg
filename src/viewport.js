import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { SoftwareRenderer } from './software-renderer.js';
import { defaultPose, applyPose } from './rig-core.js';
import { $ } from './ui/dom.js';
import { icon } from './icons.js';

export function createViewport(
  container,
  {
    getState,
    getParts,
    isPlaying,
    remember,
    stopPlaying,
    invalidateAnimation,
    rebuildRig,
    mutation,
    updateInspector,
    selectBone,
    toast,
    onFrame,
  },
) {
  let rig = null,
    renderer,
    scene,
    camera,
    perspective,
    ortho,
    orbit,
    gizmo,
    gizmoHelper;
  const selectedProxy = new THREE.Object3D(),
    bonesGroup = new THREE.Group();
  let boneVisuals = [],
    jointVisuals = [],
    floor,
    grid,
    axes;
  let wireframe = false,
    showBones = true,
    showGrid = true,
    dragging = false,
    software = false,
    dragged = false;
  let pointerDown = null;
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x99b5a4,
    roughness: 0.55,
    metalness: 0.12,
  });
  const weightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const segmentStart = new THREE.Vector3(),
    segmentEnd = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  function setupScene() {
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
      });
    } catch (error) {
      renderer = new SoftwareRenderer();
      software = true;
      $('status-right').textContent = 'Software-3D · Werte rechts bearbeiten';
      $('viewport-guide').innerHTML =
        icon('mouse') +
        '<span><b>Ziehen</b> drehen <em>·</em> <b>Scrollen</b> zoomen <em>·</em> <b>Knochen</b> rechts bearbeiten</span>';
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.prepend(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      'Interaktive 3D-Ansicht des Charakters und seines Skeletts',
    );
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202a28);
    scene.fog = new THREE.Fog(0x202a28, 11, 26);
    perspective = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    ortho = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.01, 100);
    camera = perspective;
    camera.position.set(4, 3.1, 7.5);
    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.09;
    orbit.target.set(0, 1.45, 0);
    orbit.minDistance = 1;
    orbit.maxDistance = 18;
    orbit.maxPolarAngle = Math.PI * 0.97;
    scene.add(new THREE.HemisphereLight(0xd7f0e2, 0x455b51, 2.1));
    const key = new THREE.DirectionalLight(0xe2f6ef, 3.5);
    key.position.set(3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0007;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9acef0, 2);
    rim.position.set(-4, 3, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x9ed9b3, 1);
    fill.position.set(-4, 2, 3);
    scene.add(fill);
    floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x202c27, roughness: 0.95, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.035;
    floor.receiveShadow = true;
    scene.add(floor);
    grid = new THREE.GridHelper(30, 60, 0x5d7366, 0x34493c);
    grid.position.y = -0.022;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    scene.add(grid);
    axes = new THREE.Group();
    const axisLines = [
      [[0, 0, -15], [0, 0, 15], 0x4b6685],
      [[-15, 0, 0], [15, 0, 0], 0x825b58],
    ];
    axisLines.forEach(([a, b, color]) => {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...a),
          new THREE.Vector3(...b),
        ]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 }),
      );
      line.position.y = -0.019;
      axes.add(line);
    });
    scene.add(axes);
    scene.add(bonesGroup, selectedProxy);
    gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.setSize(0.65);
    gizmoHelper = gizmo.getHelper();
    scene.add(gizmoHelper);
    // Ein kompletter Ziehvorgang zählt als ein Undo-Schritt. Die endgültigen
    // Gewichte und die Browsersicherung werden erst beim Loslassen aktualisiert.
    gizmo.addEventListener('dragging-changed', (e) => {
      dragging = e.value;
      orbit.enabled = !e.value;
      if (e.value) {
        remember();
        stopPlaying();
      } else if (dragged) {
        dragged = false;
        if (getState().mode === 'rig') {
          invalidateAnimation();
          rebuildRig();
        }
        mutation();
        updateInspector();
      }
    });
    gizmo.addEventListener('objectChange', () => {
      const joint = getState().joints.find((j) => j.id === getState().selected);
      if (!joint || !rig) return;
      dragged = true;
      if (getState().mode === 'rig') {
        joint.position = selectedProxy.position.toArray();
        syncRestBones();
        updateInspector();
      } else if (getState().mode === 'pose') {
        const e = rig.boneMap.get(joint.id).rotation;
        getState().pose[joint.id] = [e.x, e.y, e.z];
        rig.group.updateMatrixWorld(true);
        rig.skeleton.update();
        updateInspector();
      }
    });
    renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDown = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (
        !pointerDown ||
        Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5 ||
        dragging ||
        gizmo.axis
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...jointVisuals, ...boneVisuals], false);
      if (hits.length) selectBone(hits[0].object.userData.boneId);
    });
    if (!software)
      renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        stopPlaying();
        toast(
          'Der 3D-Kontext wurde unterbrochen. Speichere dein Projekt und lade die Seite neu.',
          true,
        );
      });
    new ResizeObserver(resize).observe(container);
    resize();
    requestAnimationFrame(tick);
  }

  function resize() {
    if (!renderer) return;
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h, false);
    perspective.aspect = w / h;
    perspective.updateProjectionMatrix();
    const half = 2.05;
    ortho.left = (-half * w) / h;
    ortho.right = (half * w) / h;
    ortho.top = half;
    ortho.bottom = -half;
    ortho.updateProjectionMatrix();
  }

  function switchCamera(view = 'perspective') {
    camera = view === 'perspective' ? perspective : ortho;
    const positions = {
      perspective: [4, 3.1, 7.5],
      front: [0, 1.5, 8],
      side: [8, 1.5, 0],
      top: [0, 8, 0],
    };
    camera.position.fromArray(positions[view] || positions.perspective);
    camera.up.set(0, view === 'top' ? 0 : 1, view === 'top' ? -1 : 0);
    if (view === 'perspective') {
      perspective.fov = 36;
      perspective.updateProjectionMatrix();
    } else {
      ortho.zoom = 1;
      ortho.updateProjectionMatrix();
    }
    orbit.object = camera;
    orbit.target.set(0, 1.5, 0);
    orbit.enableRotate = view === 'perspective';
    orbit.update();
    gizmo.camera = camera;
    resize();
  }

  function clearRig() {
    // Das Rig besitzt seine Geometrien; Materialien und Texturen gehören zum
    // geladenen Modell und werden erst beim Modellwechsel freigegeben.
    gizmo?.detach();
    if (rig) {
      scene.remove(rig.group);
      rig.meshes.forEach((m) => m.geometry.dispose());
      rig.skeleton.dispose();
    }
    rig = null;
  }

  function syncRestBones() {
    // Eine verschobene Ruhepose darf das Mesh noch nicht verformen. Die
    // Bindematrizen werden während des Ziehens an die Gelenkpositionen angepasst.
    for (const j of getState().joints) {
      const p = getState().joints.find((x) => x.id === j.parent),
        bone = rig.boneMap.get(j.id);
      bone.position.fromArray(j.position);
      if (p) bone.position.sub(new THREE.Vector3(...p.position));
      bone.rotation.set(0, 0, 0);
    }
    rig.group.updateMatrixWorld(true);
    rig.skeleton.calculateInverses();
    rig.skeleton.update();
  }

  function rebuildBoneVisuals() {
    bonesGroup.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    bonesGroup.clear();
    boneVisuals = [];
    jointVisuals = [];
    for (const j of getState().joints) {
      const joint = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xa8efd0,
          depthTest: false,
          transparent: true,
          opacity: 0.95,
        }),
      );
      joint.userData.boneId = j.id;
      joint.renderOrder = 10;
      bonesGroup.add(joint);
      jointVisuals.push(joint);
      if (j.parent) {
        const vertices = new Float32Array([
          0, 0, 0, -0.032, 0.18, 0, 0, 0.18, 0.032, 0.032, 0.18, 0, 0, 0.18, -0.032, 0, 1, 0,
        ]);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 5, 2, 1, 5, 3, 2, 5, 4, 3, 5, 1, 4]);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: 0xa4eacb,
            depthTest: false,
            transparent: true,
            opacity: 0.68,
            side: THREE.DoubleSide,
          }),
        );
        mesh.userData.boneId = j.id;
        mesh.userData.parentId = j.parent;
        mesh.renderOrder = 9;
        bonesGroup.add(mesh);
        boneVisuals.push(mesh);
      }
    }
  }

  function updateBoneVisuals() {
    if (!rig) return;
    bonesGroup.visible = showBones;
    for (const m of jointVisuals) {
      rig.boneMap.get(m.userData.boneId).getWorldPosition(m.position);
      const selected = m.userData.boneId === getState().selected;
      m.scale.setScalar(selected ? 1.6 : 1);
      m.material.color.set(selected ? 0xf2ffe6 : 0x9ce9c2);
    }
    for (const m of boneVisuals) {
      rig.boneMap.get(m.userData.parentId).getWorldPosition(segmentStart);
      rig.boneMap.get(m.userData.boneId).getWorldPosition(segmentEnd);
      direction.copy(segmentEnd).sub(segmentStart);
      const length = direction.length();
      m.position.copy(segmentStart);
      m.scale.set(1, length, 1);
      if (length > 1e-5) m.quaternion.setFromUnitVectors(up, direction.normalize());
      const selected = m.userData.boneId === getState().selected;
      m.material.color.set(selected ? 0xe6ffbe : 0x82dbae);
      m.material.opacity = selected ? 0.95 : 0.62;
    }
  }

  function attachGizmo() {
    if (!rig || !gizmo) return;
    const j = getState().joints.find((x) => x.id === getState().selected);
    if (!j || getState().mode === 'weights' || isPlaying() || software) {
      gizmo.detach();
      return;
    }
    if (getState().mode === 'rig') {
      selectedProxy.position.fromArray(j.position);
      selectedProxy.rotation.set(0, 0, 0);
      gizmo.setMode('translate');
      gizmo.setSpace('world');
      gizmo.attach(selectedProxy);
    } else {
      gizmo.setMode('rotate');
      gizmo.setSpace('local');
      gizmo.attach(rig.boneMap.get(j.id));
    }
  }

  function updateDisplayMaterials() {
    if (!rig) return;
    const selectedIndex = rig.index.get(getState().selected) || 0;
    rig.meshes.forEach((mesh, i) => {
      if (getState().mode === 'weights') {
        const geometry = mesh.geometry,
          weights = geometry.attributes.skinWeight,
          indices = geometry.attributes.skinIndex;
        const colors = new Float32Array(weights.count * 3),
          color = new THREE.Color();
        for (let v = 0; v < weights.count; v++) {
          let value = 0;
          for (let k = 0; k < 4; k++)
            if (indices.array[v * 4 + k] === selectedIndex) value += weights.array[v * 4 + k];
          color.setHSL(0.65 * (1 - value), 0.75, 0.35 + value * 0.15);
          colors.set([color.r, color.g, color.b], v * 3);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        mesh.material = weightMaterial;
      } else {
        mesh.material = getParts()[i].material || baseMaterial;
        const originalColor = getParts()[i].geometry.getAttribute('color');
        if (originalColor) mesh.geometry.setAttribute('color', originalColor);
        else mesh.geometry.deleteAttribute('color');
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m) => (m.wireframe = wireframe));
    });
  }

  function tick(time) {
    requestAnimationFrame(tick);
    if (!rig) return;
    onFrame(time);
    orbit.update();
    updateBoneVisuals();
    const state = getState();
    if (software)
      renderer.render(scene, camera, rig, {
        selected: state.selected,
        mode: state.mode,
        showBones,
        showGrid,
        wireframe,
        joints: state.joints,
      });
    else renderer.render(scene, camera);
  }
  setupScene();
  return {
    clear: clearRig,
    syncRestBones,
    attachGizmo,
    updateDisplayMaterials,
    switchCamera,
    get software() {
      return software;
    },
    setRig(next) {
      clearRig();
      rig = next;
      scene.add(rig.group);
      const state = getState();
      applyPose(rig, state.mode === 'rig' ? defaultPose(state.joints) : state.pose);
      rebuildBoneVisuals();
      updateDisplayMaterials();
      attachGizmo();
    },
    toggleBones() {
      showBones = !showBones;
      return showBones;
    },
    toggleWire() {
      wireframe = !wireframe;
      updateDisplayMaterials();
      return wireframe;
    },
    toggleGrid() {
      showGrid = !showGrid;
      grid.visible = showGrid;
      axes.visible = showGrid;
      return showGrid;
    },
  };
}
