// Máquina de tatuagem rotativa (estilo pen) em 3D, procedural e leve. Modelo ilustrativo.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function mountMachine(el, { reduce }) {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) return null;

  const small = matchMedia('(max-width: 700px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !small;
  el.append(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const home = { pos: new THREE.Vector3(4.6, 2.3, 6.2), target: new THREE.Vector3(0, -0.15, 0) };
  camera.position.copy(home.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.minDistance = 2.4; controls.maxDistance = 12;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 1.1;
  controls.target.copy(home.target);

  // ---------- luz ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 3); key.castShadow = !small;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 20; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.PointLight(0xd71935, 14, 12, 2); rim.position.set(-3, 1.5, -2.5); scene.add(rim);
  const fill = new THREE.PointLight(0xffffff, 4, 10, 2); fill.position.set(-2, -2, 3); scene.add(fill);

  // ---------- materiais ----------
  const brushed = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 64);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 255 : 0},0.035)`; g.fillRect(Math.random() * 512, Math.random() * 64, Math.random() * 160 + 20, 1); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); return t;
  })();
  const M = {
    metal: new THREE.MeshPhysicalMaterial({ color: 0x2a2a2c, metalness: 1, roughness: 0.32, roughnessMap: brushed, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd9d9dc, metalness: 1, roughness: 0.12 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xd71935, metalness: 0.8, roughness: 0.3, clearcoat: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0, roughness: 0.85 }),
    cart: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.08, transmission: 0.85, thickness: 0.3, ior: 1.45, transparent: true, opacity: 0.9 }),
    cartCap: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5 }),
    needle: new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 1, roughness: 0.2 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.6 }),
  };

  // ---------- geometria (eixo Y; depois deitamos a máquina) ----------
  const machine = new THREE.Group();
  const parts = { needle: new THREE.Group(), grip: new THREE.Group(), body: new THREE.Group(), cable: new THREE.Group() };
  Object.values(parts).forEach((g) => machine.add(g));
  const lathe = (pts, mat, seg = 64) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat); m.castShadow = m.receiveShadow = true; return m; };

  // corpo do motor
  parts.body.add(lathe([[0, 0.55], [0.27, 0.55], [0.3, 0.6], [0.3, 1.9], [0.28, 1.98], [0.22, 2.02], [0, 2.02]], M.metal));
  for (const y of [0.72, 1.86]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.302, 0.012, 12, 64), M.chrome); r.rotation.x = Math.PI / 2; r.position.y = y; parts.body.add(r); }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.16, 64, 1, true), M.red); band.position.y = 1.3; parts.body.add(band);
  // tampa traseira e conector
  parts.cable.add(lathe([[0, 2.02], [0.17, 2.02], [0.17, 2.18], [0.1, 2.22], [0.1, 2.42], [0.07, 2.46], [0, 2.46]], M.chrome));
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.44, 0), new THREE.Vector3(0, 2.75, 0.02), new THREE.Vector3(0.15, 3.05, 0.25), new THREE.Vector3(0.55, 3.2, 0.6)]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 12), M.cable); cable.castShadow = true; parts.cable.add(cable);
  // grip emborrachado com sulcos
  const g = [[0, -0.6], [0.24, -0.6]];
  for (let i = 0; i < 22; i++) { const y = -0.56 + i * 0.05; g.push([0.25, y], [0.235, y + 0.025]); }
  g.push([0.25, 0.55], [0, 0.55]);
  parts.grip.add(lathe(g, M.rubber));
  const lock = lathe([[0, -0.66], [0.26, -0.66], [0.27, -0.6], [0, -0.6]], M.chrome); parts.grip.add(lock);
  // cartucho + agulha
  parts.needle.add(lathe([[0, -0.66], [0.2, -0.66], [0.2, -0.9], [0.17, -1.0], [0.07, -1.38], [0.05, -1.44], [0, -1.44]], M.cart));
  parts.needle.add(lathe([[0, -0.62], [0.205, -0.62], [0.205, -0.7], [0, -0.7]], M.cartCap));
  const nd = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.002, 0.95, 12), M.needle); nd.position.y = -1.18; parts.needle.add(nd);

  // centraliza o eixo da máquina na origem e inclina como se estivesse na mão
  machine.position.y = -0.55;
  const pivot = new THREE.Group(); pivot.add(machine);
  pivot.rotation.z = -Math.PI * 0.4;
  pivot.rotation.y = Math.PI * 0.1;
  scene.add(pivot);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.25; floor.receiveShadow = true; scene.add(floor);

  // ---------- foco em partes ----------
  const highlight = (name) => {
    for (const [k, grp] of Object.entries(parts)) grp.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.userData.base || o.material;
      if (name && k === name) { o.userData.base = o.material; const m = o.material.clone(); m.emissive = new THREE.Color(0xd71935); m.emissiveIntensity = 0.35; o.material = m; }
    });
  };
  let anim = null;
  const fly = (pos, target) => { anim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, t: 0 }; };
  const focus = (name) => {
    highlight(name);
    if (!name) return api.reset();
    const box = new THREE.Box3().setFromObject(parts[name]);
    const c = box.getCenter(new THREE.Vector3());
    const dir = camera.position.clone().sub(controls.target).normalize();
    fly(c.clone().add(dir.multiplyScalar(name === 'cable' ? 4 : 2.6)), c);
    controls.autoRotate = false;
    document.querySelector('[data-view="auto"]')?.setAttribute('aria-pressed', 'false');
  };

  // ---------- render sob demanda ----------
  const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(el); resize();
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(el);
  let lastT = performance.now();
  renderer.setAnimationLoop((t) => {
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (anim) {
      anim.t = Math.min(1, anim.t + dt * 1.4);
      const e = 1 - Math.pow(1 - anim.t, 3);
      camera.position.lerpVectors(anim.p0, anim.p1, e); controls.target.lerpVectors(anim.t0, anim.t1, e);
      if (anim.t >= 1) anim = null;
    }
    controls.update();
    renderer.render(scene, camera);
  });
  el.classList.add('is-ready');

  const api = {
    focus,
    reset: () => { highlight(null); fly(home.pos.clone(), home.target.clone()); },
    autoRotate: (on) => { controls.autoRotate = on; },
  };
  return api;
}
