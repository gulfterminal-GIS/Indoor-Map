import * as THREE from 'three';

const DRAW_SECONDS = 8;
const RIDE_LEN = 16;
const TRAIL_Z = 0.06;
const PIN_Z = 0.08;
const SITE_SCALE = 60 / 220;

const DISC = new THREE.CircleGeometry(1, 40);
const RING = new THREE.RingGeometry(0.78, 1, 48);
const STICK = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 12).rotateX(Math.PI / 2).translate(0, 0, 0.75);
const KNOB = new THREE.SphereGeometry(0.22, 20, 14).translate(0, 0, 1.6);
const ARROW = new THREE.BufferGeometry();
ARROW.setAttribute('position', new THREE.Float32BufferAttribute([
  0.62, 0, 0.02,
  -0.38, 0.3, 0.02,
  -0.38, -0.3, 0.02
], 3));
const TRUNK = new THREE.CylinderGeometry(0.16, 0.34, 2.8, 8);
TRUNK.rotateX(Math.PI / 2);
TRUNK.translate(0, 0, 1.4);
const CROWN = new THREE.SphereGeometry(1.25, 16, 12);
CROWN.translate(0, 0, 3.15);
const CROWN_B = new THREE.SphereGeometry(0.95, 14, 10);
CROWN_B.translate(-0.85, 0.55, 2.7);
const CROWN_C = new THREE.SphereGeometry(0.8, 14, 10);
CROWN_C.translate(0.7, -0.6, 3.55);
const CROWN_D = new THREE.SphereGeometry(0.7, 12, 10);
CROWN_D.translate(0.15, 0.85, 2.45);
const PALM_TRUNK = new THREE.CylinderGeometry(0.09, 0.2, 5.6, 8);
PALM_TRUNK.rotateX(Math.PI / 2);
PALM_TRUNK.translate(0, 0, 2.8);
const PALM_HEART = new THREE.SphereGeometry(0.32, 10, 8);
PALM_HEART.translate(0, 0, 5.55);

function leafGeometry(length, width, droop) {
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const indices = [];
  const segs = 6;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = 0.2 + t * length;
    const z = -droop * t * t;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.05)) * width * (1 - t * 0.15);
    positions.push(x, w * 0.72, z + 0.04, x, 0, z, x, -w * 0.72, z + 0.04);
  }
  const tip = (segs + 1) * 3;
  positions.push(0.2 + length + 0.18, 0, -droop);
  for (let i = 0; i < segs; i++) {
    const a = i * 3;
    const mid = a + 1;
    const b = a + 2;
    const c = a + 3;
    const mid2 = a + 4;
    const d = a + 5;
    indices.push(a, mid, c, mid, mid2, c, mid, b, mid2, b, d, mid2);
  }
  const last = segs * 3;
  indices.push(last, last + 1, tip, last + 1, last + 2, tip);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const FROND = leafGeometry(2.85, 0.72, 0.95);
const FROND_LOW = leafGeometry(2.15, 0.5, 1.55);
const CAR_BODY = new THREE.BoxGeometry(4.4, 1.8, 0.62);
CAR_BODY.translate(0, 0, 0.78);
const CAR_CABIN = new THREE.BoxGeometry(2.15, 1.58, 0.48);
CAR_CABIN.translate(-0.2, 0, 1.28);
const CAR_WHEEL = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
CAR_WHEEL.rotateZ(Math.PI / 2);

function basic(color, extra) {
  return new THREE.MeshBasicMaterial(Object.assign({ color, side: THREE.DoubleSide }, extra || {}));
}

const MAT = {
  casing: basic(0xFFFFFF, { depthWrite: false, depthTest: false }),
  route: basic(0x1565A8, { depthWrite: false, depthTest: false }),
  path: basic(0x1565A8, { depthWrite: false, transparent: true, opacity: 0.55 }),
  network: basic(0x5C6B82, { depthWrite: false, transparent: true, opacity: 0.85 }),
  white: basic(0xFFFFFF),
  start: basic(0x15803D),
  userTrail: basic(0x15803D, { depthWrite: false }),
  userCasing: basic(0xFFFFFF, { depthWrite: false }),
  end: basic(0xB42318),
  via: basic(0x1B2A4A),
  shadow: basic(0x142038, { transparent: true, opacity: 0.22, depthWrite: false }),
  knob: new THREE.MeshStandardMaterial({ color: 0xB42318, roughness: 0.6 })
};

function ribbon(pts, width, z) {
  const pos = [];
  const h = width / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const nx = (-dy / len) * h;
    const ny = (dx / len) * h;
    pos.push(
      a[0] + nx, a[1] + ny, z, a[0] - nx, a[1] - ny, z, b[0] - nx, b[1] - ny, z,
      a[0] + nx, a[1] + ny, z, b[0] - nx, b[1] - ny, z, b[0] + nx, b[1] + ny, z
    );
  }
  if (pts.length > 1) {
    const seg = 14;
    pts.forEach((c) => {
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2;
        const a1 = ((k + 1) / seg) * Math.PI * 2;
        pos.push(
          c[0], c[1], z,
          c[0] + Math.cos(a0) * h, c[1] + Math.sin(a0) * h, z,
          c[0] + Math.cos(a1) * h, c[1] + Math.sin(a1) * h, z
        );
      }
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return geometry;
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createScene3D(map, options) {
  const ml = window.maplibregl;
  const hooks = Object.assign({ onLevel() {}, onStep() {}, onMove() {}, onDone() {} }, options || {});
  const labelHost = options.labelHost;

  let renderer = null;
  let origin = new ml.MercatorCoordinate(0.5, 0.5, 0);
  let unit = 1;
  let originLat = 0;
  const local = new THREE.Matrix4();
  const proj = new THREE.Matrix4();
  const projInv = new THREE.Matrix4();
  let haveProj = false;

  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  world.scale.y = -1;
  scene.add(world);

  const sky = new THREE.HemisphereLight(0xFFFFFF, 0xB9C4D2, 1.7);
  sky.position.set(0, 0, 1);
  world.add(sky);
  const sun = new THREE.DirectionalLight(0xFFFFFF, 1.5);
  sun.position.set(-30, -40, 80);
  world.add(sun);

  const shellGroup = new THREE.Group();
  const siteGroup = new THREE.Group();
  const pathGroup = new THREE.Group();
  const networkGroup = new THREE.Group();
  const routeGroup = new THREE.Group();
  const pinGroup = new THREE.Group();
  const userGroup = new THREE.Group();
  world.add(siteGroup, shellGroup, networkGroup, pathGroup, routeGroup, pinGroup, userGroup);

  let activeLevel = null;
  let shellRank = 0;
  let solid = false;
  let shellCats = null;
  let shellSelected = null;
  let shellHover = null;
  let escalatorLive = false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeTex(draw) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    draw(g);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const TEX = {
    tile: makeTex((g) => {
      g.strokeStyle = 'rgba(70, 84, 102, 0.28)';
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, 125, 125);
    }),
    soft: makeTex((g) => {
      for (let i = 0; i < 16; i++) {
        g.fillStyle = 'rgba(60, 72, 90, 0.06)';
        g.beginPath();
        g.ellipse((i * 37) % 128, (i * 53) % 128, 20, 12, i, 0, Math.PI * 2);
        g.fill();
      }
    }),
    plaster: makeTex((g) => {
      for (let i = 0; i < 280; i++) {
        const v = 226 + (i * 17) % 28;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.45)';
        g.fillRect((i * 47) % 128, (i * 19) % 128, 2, 2);
      }
    }),
    metal: makeTex((g) => {
      g.strokeStyle = 'rgba(70, 82, 96, 0.35)';
      g.lineWidth = 2;
      for (let i = -4; i < 8; i++) {
        g.beginPath();
        g.moveTo(i * 32, 0);
        g.lineTo(i * 32 + 128, 128);
        g.stroke();
      }
    })
  };

  const FIN = {
    glass: basic(0xD7E6F2, { transparent: true, opacity: 0.22, depthWrite: false }),
    mullion: basic(0x2A3546),
    spandrel: basic(0xE4EBF3),
    kick: basic(0x9AA6B4),
    tread: basic(0xE4EAF0),
    landing: basic(0x8B97A4),
    skirt: basic(0x1B2330),
    rail: basic(0x121820),
    yellow: basic(0xE2B43A)
  };
  let pathwaysOn = false;
  let networkOn = false;
  let pathLines = [];
  let networkPathLines = [];
  let trailWidth = 0.7;
  let draft = null;
  let here = null;
  let userMark = null;
  let userPts = [];
  let userDrawn = 0;
  let userElev = 0;
  let userCore = null;
  let userCasing = null;
  const USER_MIN_STEP = 0.45;
  const USER_DRAW = 3.2;
  let labels = [];

  const pb = {
    plan: null,
    leg: 0,
    playing: false,
    done: false,
    elapsed: 0,
    total: 0,
    announced: -1,
    level: null,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    targetHeading: 0,
    size: 1,
    pulses: []
  };

  let raf = 0;
  let last = 0;
  let idleUntil = 0;

  const layer = {
    id: 'scene3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(gl, arg) {
      const raw = arg && arg.defaultProjectionData ? arg.defaultProjectionData.mainMatrix : arg;
      proj.fromArray(raw);
      projInv.copy(proj).invert();
      haveProj = true;
      camera.projectionMatrix.multiplyMatrices(proj, local);
      applySizes();
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(scene, camera);
      placeLabels();
    }
  };

  let originAlt = 0;

  function setOrigin(lonlat, altitude) {
    const sea = ml.MercatorCoordinate.fromLngLat(lonlat, 0);
    originAlt = altitude || 0;
    origin = ml.MercatorCoordinate.fromLngLat(lonlat, originAlt);
    unit = sea.meterInMercatorCoordinateUnits();
    originLat = lonlat[1];
    local.makeTranslation(origin.x, origin.y, origin.z).multiply(new THREE.Matrix4().makeScale(unit, unit, unit));
    map.triggerRepaint();
  }

  function toScene(lonlat) {
    const mc = ml.MercatorCoordinate.fromLngLat(lonlat, 0);
    return [(mc.x - origin.x) / unit, -(mc.y - origin.y) / unit];
  }

  function fromScene(x, y) {
    const ll = new ml.MercatorCoordinate(origin.x + x * unit, origin.y - y * unit, 0).toLngLat();
    return [ll.lng, ll.lat];
  }

  function pick(point, elev) {
    if (!haveProj) return null;
    const canvas = map.getCanvas();
    const nx = (point.x / canvas.clientWidth) * 2 - 1;
    const ny = 1 - (point.y / canvas.clientHeight) * 2;
    const a = new THREE.Vector4(nx, ny, -1, 1).applyMatrix4(projInv);
    const b = new THREE.Vector4(nx, ny, 1, 1).applyMatrix4(projInv);
    a.divideScalar(a.w);
    b.divideScalar(b.w);
    const zt = origin.z + elev * unit;
    const dz = b.z - a.z;
    if (Math.abs(dz) < 1e-18) return null;
    const t = (zt - a.z) / dz;
    if (!isFinite(t)) return null;
    const ll = new ml.MercatorCoordinate(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0).toLngLat();
    return [ll.lng, ll.lat];
  }

  function metersPerPixel() {
    return (40075016.686 * Math.cos((originLat * Math.PI) / 180)) / (512 * Math.pow(2, map.getZoom()));
  }

  function applySizes() {
    const mpp = metersPerPixel();
    const narrow = (map.getCanvas().clientWidth || window.innerWidth) <= 700;
    const width = Math.max(narrow ? 0.32 : 0.5, Math.min(narrow ? 1.15 : 2.4, 7 * mpp));
    if (Math.abs(width - trailWidth) / trailWidth > 0.08) {
      trailWidth = width;
      rebuildTrails();
      rebuildPaths();
      if (userPts.length > 1) paintUserTrail();
    }
    const pinScale = Math.max(narrow ? 0.72 : 1, Math.min(narrow ? 1.35 : 2.3, 18 * mpp));
    pinGroup.children.forEach((pin) => {
      pin.scale.setScalar(pinScale);
    });
    if (userMark) userMark.scale.setScalar(pinScale * 0.55);
  }

  const labelPoint = new THREE.Vector4();

  function labelsOverlap(a, b) {
    const gap = 4;
    return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
  }

  function placeLabels() {
    if (!labels.length || !haveProj) return;
    const canvas = map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const narrow = w <= 700;
    const scale = Math.min(narrow ? 1 : 1.2, Math.max(0.32, Math.pow(2, map.getZoom() - 18.4))) * (narrow ? 0.86 : 1);
    const ready = [];
    labels.forEach((label) => {
      const xy = toScene(label.lngLat);
      labelPoint.set(xy[0], -xy[1], label.height, 1).applyMatrix4(camera.projectionMatrix);
      if (labelPoint.w <= 0) {
        label.el.style.visibility = 'hidden';
        return;
      }
      const px = (labelPoint.x / labelPoint.w + 1) * 0.5 * w;
      const py = (1 - labelPoint.y / labelPoint.w) * 0.5 * h;
      if (!isFinite(px) || !isFinite(py) || px < -80 || py < -40 || px > w + 80 || py > h + 40) {
        label.el.style.visibility = 'hidden';
        return;
      }
      const title = !!label.title;
      label.el.style.fontSize = ((title ? 10 : 8) * scale).toFixed(2) + 'px';
      label.el.style.padding = ((title ? 2.5 : 1) * scale).toFixed(2) + 'px ' + ((title ? 6 : 4) * scale).toFixed(2) + 'px';
      label.el.style.visibility = 'hidden';
      label.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) translate(-50%, -50%)';
      ready.push({ label: label, px: px, py: py });
    });
    ready.sort((a, b) => {
      const pa = a.label.selected ? 0 : a.label.priority;
      const pb = b.label.selected ? 0 : b.label.priority;
      if (pa !== pb) return pa - pb;
      return a.px - b.px;
    });
    const drawn = [];
    ready.forEach((item) => {
      const width = item.label.el.offsetWidth;
      const height = item.label.el.offsetHeight;
      const box = { x: item.px - width / 2, y: item.py - height / 2, w: width, h: height };
      if (!item.label.selected && !item.label.car && width > 0 && drawn.some((other) => labelsOverlap(box, other))) return;
      drawn.push(box);
      item.label.el.style.visibility = 'visible';
    });
  }

  function setLabels(list) {
    labelHost.textContent = '';
    labels = list.map((item) => {
      const el = document.createElement('div');
      el.className = 'room-label' + (item.title ? ' building-title' : '') + (item.car ? ' is-car' : '') + (item.selected ? ' is-selected' : '');
      el.textContent = item.text;
      el.style.visibility = 'hidden';
      labelHost.appendChild(el);
      return { el, lngLat: item.lngLat, height: item.height || 0, title: !!item.title, selected: !!item.selected, car: !!item.car, priority: item.priority == null ? 1 : item.priority };
    });
    map.triggerRepaint();
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children.pop();
      child.traverse((o) => {
        if (o.geometry && o.geometry !== DISC && o.geometry !== RING && o.geometry !== STICK && o.geometry !== KNOB && o.geometry !== ARROW && o.geometry !== TRUNK && o.geometry !== CROWN && o.geometry !== CROWN_B && o.geometry !== CROWN_C && o.geometry !== CROWN_D && o.geometry !== PALM_TRUNK && o.geometry !== PALM_HEART && o.geometry !== FROND && o.geometry !== FROND_LOW && o.geometry !== CAR_BODY && o.geometry !== CAR_CABIN && o.geometry !== CAR_WHEEL) o.geometry.dispose();
        if (o.material && o.userData.ownMaterial) o.material.dispose();
      });
    }
  }

  function setPathways(lines) {
    pathLines = lines;
    rebuildPaths();
  }

  function setNetwork(lines) {
    networkPathLines = lines || [];
    rebuildPaths();
  }

  function addPathMeshes(group, lines, material, width, order) {
    lines.forEach((line) => {
      const mesh = new THREE.Mesh(ribbon(line.pts, width, line.elev + TRAIL_Z - 0.01), material);
      mesh.userData.level = line.level;
      mesh.renderOrder = order;
      group.add(mesh);
    });
  }

  function rebuildPaths() {
    clearGroup(pathGroup);
    clearGroup(networkGroup);
    const width = Math.max(0.14, trailWidth * 0.3);
    addPathMeshes(networkGroup, networkPathLines, MAT.network, width * 0.72, 1);
    addPathMeshes(pathGroup, pathLines, MAT.path, width, 2);
    syncVisibility();
  }

  function setPathwaysVisible(on) {
    pathwaysOn = on;
    syncVisibility();
    map.triggerRepaint();
  }

  function setNetworkVisible(on) {
    networkOn = on;
    syncVisibility();
    map.triggerRepaint();
  }

  function makePin(kind, level, xy, elev) {
    const group = new THREE.Group();
    group.position.set(xy[0], xy[1], elev + PIN_Z);
    group.userData.level = level;
    const halo = new THREE.Mesh(DISC, MAT.white);
    halo.scale.setScalar(0.62);
    const dot = new THREE.Mesh(DISC, MAT[kind]);
    dot.scale.setScalar(0.44);
    dot.position.z = 0.01;
    halo.renderOrder = 4;
    dot.renderOrder = 5;
    group.add(halo, dot);
    if (kind === 'end') {
      const stick = new THREE.Mesh(STICK, MAT.knob);
      const knob = new THREE.Mesh(KNOB, MAT.knob);
      group.add(stick, knob);
      const pulseMat = basic(0xB42318, { transparent: true, opacity: 0.5, depthWrite: false });
      const pulse = new THREE.Mesh(RING, pulseMat);
      pulse.userData.ownMaterial = true;
      pulse.renderOrder = 4;
      group.add(pulse);
      pb.pulses.push(pulse);
    }
    pinGroup.add(group);
    return group;
  }

  function syncVisibility() {
    shellGroup.children.forEach((m) => {
      const d = m.userData;
      if (d.kind === 'base') {
        m.visible = solid;
        return;
      }
      if (d.kind === 'plate') {
        const above = solid && d.rank > shellRank;
        const below = solid && d.rank < shellRank;
        m.visible = solid && !above;
        m.material.color.set(d.color == null ? 0xFFFFFF : d.color);
        m.material.opacity = below ? 0.78 : 1;
        m.material.transparent = below;
        m.material.depthWrite = !below;
        m.material.needsUpdate = true;
        applySkin(m);
        return;
      }
      if (d.kind === 'wall') {
        const catOn = !d.category || !shellCats || shellCats[d.category] !== false;
        m.visible = solid && d.level === activeLevel && catOn;
        m.material.color.set(0xB4C0CF);
        applySkin(m);
        return;
      }
      if (d.kind === 'shopfront') {
        const catOn = !d.category || !shellCats || shellCats[d.category] !== false;
        m.visible = solid && d.level === activeLevel && catOn;
        return;
      }
      if (d.kind === 'border') {
        const catOn = !d.category || !shellCats || shellCats[d.category] !== false;
        m.visible = !solid && d.level === activeLevel && catOn;
        return;
      }
      if (d.kind === 'facade') {
        m.visible = solid && (d.rank || 0) <= shellRank;
        return;
      }
      if (d.kind === 'machine') {
        const catOn = !d.category || !shellCats || shellCats[d.category] !== false;
        m.visible = solid && (d.rank || 0) <= shellRank && catOn;
        return;
      }
      const catOn = !d.category || !shellCats || shellCats[d.category] !== false;
      m.visible = d.level === activeLevel && catOn;
      if (m.material && m.material.color) m.material.color.set(unitColor(d));
      applySkin(m);
    });
    pathGroup.children.forEach((m) => { m.visible = pathwaysOn && m.userData.level === activeLevel; });
    networkGroup.children.forEach((m) => { m.visible = networkOn && m.userData.level === activeLevel; });
    routeGroup.children.forEach((m) => {
      const onLevel = m.userData.level === activeLevel;
      if (m.userData.kind === 'arrow') m.visible = onLevel && m.userData.dist <= m.userData.limit + 0.2;
      else m.visible = onLevel;
    });
    pinGroup.children.forEach((m) => { m.visible = m.userData.level === activeLevel; });
  }

  function surfaceZ(lngLat) {
    let height = null;
    try { height = map.queryTerrainElevation(lngLat, { exaggerated: true }); } catch (err) { height = null; }
    if (height == null || !isFinite(height)) return 0.3;
    return height - originAlt + 0.4;
  }

  function addTree(part, palm) {
    const xy = toScene(part.lngLat);
    const tree = new THREE.Group();
    tree.position.set(xy[0], xy[1], surfaceZ(part.lngLat));
    tree.scale.setScalar((part.scale || 1) * SITE_SCALE);
    const lean = ((Math.abs(part.lngLat[0]) * 10000) % 1) - 0.5;
    tree.rotation.x = lean * 0.1;
    tree.rotation.y = lean * 0.16;
    if (palm) {
      const trunk = new THREE.Mesh(PALM_TRUNK, basic(0x8A6A42));
      const heart = new THREE.Mesh(PALM_HEART, basic(0x2F7A3E));
      trunk.userData.ownMaterial = true;
      heart.userData.ownMaterial = true;
      tree.add(trunk, heart);
      for (let i = 0; i < 9; i++) {
        const frond = new THREE.Mesh(FROND, basic(i % 2 ? 0x3C9A4A : 0x1F6B34));
        frond.position.z = 5.35;
        frond.rotation.z = (i / 9) * Math.PI * 2 + 0.2;
        frond.userData.ownMaterial = true;
        tree.add(frond);
      }
      for (let i = 0; i < 6; i++) {
        const frond = new THREE.Mesh(FROND_LOW, basic(i % 2 ? 0x6A8A3A : 0x4E7A32));
        frond.position.z = 5.05;
        frond.rotation.z = (i / 6) * Math.PI * 2;
        frond.userData.ownMaterial = true;
        tree.add(frond);
      }
    } else {
      const trunk = new THREE.Mesh(TRUNK, basic(0x6A4A32));
      const crown = new THREE.Mesh(CROWN, basic(part.color || 0x2F7D45));
      const side = new THREE.Mesh(CROWN_B, basic(0x256B38));
      const top = new THREE.Mesh(CROWN_C, basic(0x4E9A55));
      const low = new THREE.Mesh(CROWN_D, basic(0x1E6434));
      trunk.userData.ownMaterial = true;
      crown.userData.ownMaterial = true;
      side.userData.ownMaterial = true;
      top.userData.ownMaterial = true;
      low.userData.ownMaterial = true;
      tree.add(trunk, crown, side, top, low);
    }
    siteGroup.add(tree);
  }

  function roadRibbon(pts, width) {
    const pos = [];
    const h = width / 2;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-4) continue;
      const nx = (-dy / len) * h;
      const ny = (dx / len) * h;
      pos.push(
        a[0] + nx, a[1] + ny, a[2],
        a[0] - nx, a[1] - ny, a[2],
        b[0] - nx, b[1] - ny, b[2],
        a[0] + nx, a[1] + ny, a[2],
        b[0] - nx, b[1] - ny, b[2],
        b[0] + nx, b[1] + ny, b[2]
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }

  function drapeLine(lngLats, lift) {
    const pts = [];
    const push = (x, y, ll) => pts.push([x, y, surfaceZ(ll || fromScene(x, y)) + lift]);
    for (let i = 1; i < lngLats.length; i++) {
      const a = toScene(lngLats[i - 1]);
      const b = toScene(lngLats[i]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.ceil(len / 8));
      for (let s = (i === 1 ? 0 : 1); s <= steps; s++) {
        const t = s / steps;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        push(x, y, s === 0 ? lngLats[i - 1] : (s === steps ? lngLats[i] : null));
      }
    }
    return pts;
  }

  function addRoad(line) {
    const pts = drapeLine(line, 0.55 * SITE_SCALE);
    if (pts.length < 2) return;
    const asphalt = new THREE.Mesh(roadRibbon(pts, 6.4 * SITE_SCALE), basic(0x9AA3AD));
    asphalt.userData.ownMaterial = true;
    siteGroup.add(asphalt);
    const dashes = [];
    let travelled = 0;
    const dash = 3.2 * SITE_SCALE;
    const gap = 2.1 * SITE_SCALE;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-4) continue;
      let walked = 0;
      while (walked < len - 0.05) {
        const into = (travelled + walked) % (dash + gap);
        const run = into < dash ? Math.min(dash - into, len - walked) : Math.min(dash + gap - into, len - walked);
        if (into < dash && run > 0.15 * SITE_SCALE) {
          const t0 = walked / len;
          const t1 = (walked + run) / len;
          const z0 = a[2] + 0.06;
          const z1 = b[2] + 0.06;
          dashes.push([
            a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, z0,
            a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, z1
          ]);
        }
        if (run < 1e-3) break;
        walked += run;
      }
      travelled += len;
    }
    if (!dashes.length) return;
    const markPos = [];
    dashes.forEach((seg) => {
      const piece = roadRibbon([seg.slice(0, 3), seg.slice(3)], 0.38 * SITE_SCALE);
      const arr = piece.attributes.position.array;
      for (let k = 0; k < arr.length; k++) markPos.push(arr[k]);
      piece.dispose();
    });
    const markGeo = new THREE.BufferGeometry();
    markGeo.setAttribute('position', new THREE.Float32BufferAttribute(markPos, 3));
    const mark = new THREE.Mesh(markGeo, basic(0xE7EDF2));
    mark.userData.ownMaterial = true;
    siteGroup.add(mark);
  }

  function addCar(part) {
    const xy = toScene(part.lngLat);
    const car = new THREE.Group();
    car.position.set(xy[0], xy[1], surfaceZ(part.lngLat) + 0.55 * SITE_SCALE);
    car.scale.setScalar(SITE_SCALE);
    car.rotation.z = part.heading || 0;
    const paint = basic(part.color || 0xF4F7FA);
    const glass = basic(0x243044);
    const body = new THREE.Mesh(CAR_BODY, paint);
    const cabin = new THREE.Mesh(CAR_CABIN, glass);
    body.userData.ownMaterial = true;
    cabin.userData.ownMaterial = true;
    car.add(body, cabin);
    [[1.35, 0.72], [1.35, -0.72], [-1.35, 0.72], [-1.35, -0.72]].forEach((spot) => {
      const wheel = new THREE.Mesh(CAR_WHEEL, basic(0x1C2430));
      wheel.position.set(spot[0], spot[1], 0.32);
      wheel.userData.ownMaterial = true;
      car.add(wheel);
    });
    siteGroup.add(car);
  }

  function setSite(parts) {
    clearGroup(siteGroup);
    const order = { lawn: 0, road: 1, tree: 2, palm: 2, car: 3 };
    (parts || []).slice().sort((a, b) => (order[a.kind] || 0) - (order[b.kind] || 0)).forEach((part) => {
      if (part.kind === 'lawn' && part.ring && part.ring.length >= 4) {
        const pts = part.ring.map((c) => toScene(c));
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        pts.forEach((p) => {
          minX = Math.min(minX, p[0]);
          minY = Math.min(minY, p[1]);
          maxX = Math.max(maxX, p[0]);
          maxY = Math.max(maxY, p[1]);
        });
        const cols = Math.max(3, Math.min(16, Math.ceil((maxX - minX) / 6)));
        const rows = Math.max(3, Math.min(16, Math.ceil((maxY - minY) / 6)));
        const positions = [];
        const indices = [];
        for (let j = 0; j <= rows; j++) {
          for (let i = 0; i <= cols; i++) {
            const x = minX + (maxX - minX) * (i / cols);
            const y = minY + (maxY - minY) * (j / rows);
            positions.push(x, y, surfaceZ(fromScene(x, y)));
          }
        }
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const a = j * (cols + 1) + i;
            const b = a + 1;
            const c = a + cols + 1;
            indices.push(a, c, b, b, c, c + 1);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, basic(part.color || 0x7EAE62));
        mesh.userData.ownMaterial = true;
        siteGroup.add(mesh);
        return;
      }
      if (part.kind === 'tree' || part.kind === 'palm') addTree(part, part.kind === 'palm');
      else if (part.kind === 'road') addRoad(part.line);
      else if (part.kind === 'car') addCar(part);
    });
    map.triggerRepaint();
  }

  function paintUVs(geo, tile) {
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    const n = tile || 1;
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / n;
      uv[i * 2 + 1] = pos.getY(i) / n;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  function surfaceTexture(part) {
    if (part.kind === 'plate') return { map: TEX.plaster, tile: 3.2 };
    if (part.kind === 'wall') return { map: TEX.plaster, tile: 1.7 };
    if (part.kind !== 'unit') return null;
    if (part.category === 'restroom') return { map: TEX.tile, tile: 0.52 };
    if (part.category === 'room') return { map: TEX.soft, tile: 1.8 };
    if (part.category === 'elevator' || part.category === 'escalator') return { map: TEX.metal, tile: 0.65 };
    if (part.category === 'stair') return { map: TEX.plaster, tile: 0.9 };
    if (part.category === 'corridor' || part.category === 'hall') return { map: TEX.tile, tile: 1.25 };
    return { map: TEX.soft, tile: 1.5 };
  }

  function applySkin(mesh) {
    if (!mesh.material || !mesh.userData.tex) return;
    const next = solid ? mesh.userData.tex : null;
    if (mesh.material.map !== next) {
      mesh.material.map = next;
      mesh.material.needsUpdate = true;
    }
  }

  function unitColor(d) {
    if (shellSelected != null && String(d.id) === String(shellSelected)) return 0xBBD3EA;
    if (shellHover != null && String(d.id) === String(shellHover)) return 0xDCE7F2;
    if (solid && d.category === 'escalator') return 0x343B44;
    if (solid && d.category === 'stair') return 0xC9BBA8;
    if (solid && d.category === 'elevator') return 0x3E4854;
    return d.color;
  }

  function ringScene(ring) {
    const pts = [];
    let end = ring.length;
    if (end > 1 && ring[end - 1][0] === ring[0][0] && ring[end - 1][1] === ring[0][1]) end -= 1;
    for (let i = 0; i < end; i++) pts.push(toScene(ring[i]));
    return pts;
  }

  function ringFrame(ring) {
    const pts = ringScene(ring);
    if (pts.length < 3) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    pts.forEach((p) => {
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    });
    const w = maxX - minX;
    const h = maxY - minY;
    if (w < 1 || h < 1) return null;
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: w, h: h };
  }

  function pushPanel(list, cx, cy, dx, dy, width, z0, z1) {
    const hx = dx * width * 0.5;
    const hy = dy * width * 0.5;
    const x0 = cx - hx;
    const y0 = cy - hy;
    const x1 = cx + hx;
    const y1 = cy + hy;
    list.push(
      x0, y0, z0, x1, y1, z0, x1, y1, z1,
      x0, y0, z0, x1, y1, z1, x0, y0, z1
    );
  }

  function addMerged(pos, material, order, part) {
    if (pos.length < 9) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = order;
    mesh.userData = { kind: 'facade', rank: part.rank || 0, level: part.level };
    shellGroup.add(mesh);
  }

  function addFacade(ring, part) {
    const pts = ringScene(ring);
    if (pts.length < 3) return;
    let cx = 0;
    let cy = 0;
    pts.forEach((p) => { cx += p[0]; cy += p[1]; });
    cx /= pts.length;
    cy /= pts.length;
    const base = part.top;
    const clear = Math.max(2.4, (part.story || 4) - (part.slab || 0.25));
    const glass0 = base + 0.18;
    const glass1 = base + clear - 0.46;
    const top = base + clear - 0.06;
    const glassPos = [];
    const bandPos = [];
    const kickPos = [];
    const mullionPos = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 2.4) continue;
      const ux = dx / len;
      const uy = dy / len;
      let ox = (a[0] + b[0]) / 2 - cx;
      let oy = (a[1] + b[1]) / 2 - cy;
      const ol = Math.hypot(ox, oy) || 1;
      ox /= ol;
      oy /= ol;
      const span = len - 0.36;
      const mx = (a[0] + b[0]) / 2 + ox * 0.05;
      const my = (a[1] + b[1]) / 2 + oy * 0.05;
      pushPanel(kickPos, mx, my, ux, uy, span, base + 0.02, glass0);
      pushPanel(bandPos, mx, my, ux, uy, span, glass1, top);
      const count = Math.max(1, Math.round((len - 0.8) / 3.15));
      const step = (len - 0.8) / count;
      const start = 0.4;
      for (let k = 0; k <= count; k++) {
        const s = start + step * k;
        pushPanel(mullionPos, a[0] + ux * s + ox * 0.16, a[1] + uy * s + oy * 0.16, ux, uy, 0.1, glass0, glass1);
      }
      for (let k = 0; k < count; k++) {
        const s = start + step * k + step / 2;
        pushPanel(glassPos, a[0] + ux * s + ox * 0.1, a[1] + uy * s + oy * 0.1, ux, uy, Math.max(0.4, step - 0.14), glass0, glass1);
      }
    }
    addMerged(glassPos, FIN.glass, 1, part);
    addMerged(kickPos, FIN.kick, 2, part);
    addMerged(bandPos, FIN.spandrel, 2, part);
    addMerged(mullionPos, FIN.mullion, 2, part);
  }

  function wallRun(ring) {
    const pts = ringScene(ring);
    if (pts.length < 4) return null;
    let cx = 0;
    let cy = 0;
    pts.forEach((p) => { cx += p[0]; cy += p[1]; });
    cx /= pts.length;
    cy /= pts.length;
    let len = 0;
    let ux = 1;
    let uy = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d > len) {
        len = d;
        ux = (b[0] - a[0]) / d;
        uy = (b[1] - a[1]) / d;
      }
    }
    if (len < 0.2) return null;
    return { cx: cx, cy: cy, ux: ux, uy: uy, len: len };
  }

  function addShopfront(ring, part) {
    const run = wallRun(ring);
    if (!run) return;
    const group = new THREE.Group();
    group.userData = {
      kind: 'shopfront',
      level: part.level,
      rank: part.rank || 0,
      category: part.category || 'room'
    };
    const angle = Math.atan2(run.uy, run.ux);
    const place = (len, thick, z0, z1, along, material, order) => {
      const h = Math.max(0.02, z1 - z0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.04, len), thick, h), material);
      mesh.position.set(run.cx + run.ux * along, run.cy + run.uy * along, (z0 + z1) / 2);
      mesh.rotation.z = angle;
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      group.add(mesh);
    };
    const z0 = part.bottom;
    const z1 = part.top;
    const head = z1 - 0.22;
    const sill = part.door ? z0 + 0.02 : z0 + 0.16;
    const span = Math.max(0.2, run.len - 0.08);
    place(span, 0.08, head, z1, 0, FIN.spandrel, 3);
    if (!part.door) place(span, 0.08, z0, sill, 0, FIN.kick, 3);
    [-1, 1].forEach((side) => {
      place(0.07, 0.08, z0, z1, side * (run.len / 2 - 0.04), FIN.mullion, 3);
    });
    const inner = Math.max(0.2, run.len - 0.16);
    const count = part.door ? 1 : Math.max(1, Math.round(inner / 1.7));
    const step = inner / count;
    const start = -inner / 2;
    for (let k = 0; k < count; k++) {
      place(Math.max(0.2, step - 0.08), 0.04, sill, head, start + step * k + step / 2, FIN.glass, 2);
      if (k > 0) place(0.06, 0.08, sill, head, start + step * k, FIN.mullion, 3);
    }
    if (part.door) place(0.035, 0.06, z0 + 0.95, z0 + 1.15, start + inner * 0.72, FIN.mullion, 3);
    shellGroup.add(group);
  }

  function addBox(parent, sx, sy, sz, x, y, z, material, rotX, order) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    if (rotX) mesh.rotation.x = rotX;
    if (order) mesh.renderOrder = order;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  }

  function machineGroup(frame, part, category) {
    const outer = new THREE.Group();
    outer.position.set(frame.cx, frame.cy, part.top + 0.03);
    outer.frustumCulled = false;
    const alongY = frame.h >= frame.w - 0.05;
    if (!alongY) outer.rotation.z = Math.PI / 2;
    outer.userData = {
      kind: 'machine',
      category: category,
      rank: part.rank || 0,
      level: part.level,
      steps: null
    };
    shellGroup.add(outer);
    return { outer: outer, length: alongY ? frame.h : frame.w, across: alongY ? frame.w : frame.h };
  }

  function addStair(ring, part) {
    const frame = ringFrame(ring);
    if (!frame) return;
    const host = machineGroup(frame, part, 'stair');
    const model = new THREE.Group();
    host.outer.add(model);
    const half = host.length / 2;
    const rise = part.rise || 3.94;
    const land = Math.min(1.35, host.length * 0.16);
    const going = Math.max(1.2, host.length - land * 2);
    const steps = 20;
    const tread = going / steps;
    const riser = rise / steps;
    const width = Math.min(2.2, host.across * 0.48);
    const y0 = -half + land;
    const y1 = y0 + going;
    for (let i = 0; i < steps; i++) {
      addBox(model, width, tread * 0.9, riser * 0.88, 0, y0 + tread * i + tread * 0.5, riser * i + riser * 0.44, FIN.tread);
    }
    addBox(model, width + 0.25, land, 0.08, 0, -half + land / 2, 0.04, FIN.landing);
    addBox(model, width + 0.25, Math.max(0.4, half - y1), 0.08, 0, (y1 + half) / 2, rise - 0.04, FIN.landing);
    const railLen = Math.hypot(going, rise);
    [-1, 1].forEach((side) => {
      const x = side * (width / 2 + 0.05);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([
        x, y0, 0.02, x, y1, 0.02, x, y1, rise
      ], 3));
      model.add(new THREE.Mesh(geo, FIN.skirt));
      addBox(model, 0.07, railLen, 0.07, x, (y0 + y1) / 2, rise / 2 + 0.86, FIN.rail, Math.atan2(rise, going));
    });
  }

  function addElevator(ring, part) {
    const frame = ringFrame(ring);
    if (!frame) return;
    const host = machineGroup(frame, part, 'elevator');
    const model = new THREE.Group();
    host.outer.add(model);
    const w = Math.min(2.35, host.across * 0.42);
    const d = Math.min(2.35, host.length * 0.42);
    const h = 2.65;
    addBox(model, w, d, h, 0, 0, h / 2 + 0.04, FIN.glass, 0, 1);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((p) => {
      addBox(model, 0.09, 0.09, h + 0.1, p[0] * w / 2, p[1] * d / 2, h / 2, FIN.mullion);
    });
    addBox(model, w * 0.64, 0.07, h * 0.7, 0, -d / 2 - 0.03, h * 0.42, FIN.skirt);
  }

  function addEscalator(ring, part) {
    const frame = ringFrame(ring);
    if (!frame) return;
    const host = machineGroup(frame, part, 'escalator');
    const model = new THREE.Group();
    model.frustumCulled = false;
    if (/B\b/.test(part.name || '')) model.scale.y = -1;
    host.outer.add(model);
    const half = host.length / 2;
    const rise = part.rise || 3.94;
    let ang = 35 * Math.PI / 180;
    let runL = rise / Math.tan(ang);
    if (runL > host.length - 0.9) {
      runL = Math.max(1.6, host.length - 0.9);
      ang = Math.atan2(rise, runL);
    }
    const landL = (host.length - runL) / 2;
    const incline = Math.hypot(runL, rise);
    const y0 = -half + landL;
    const y1 = half - landL;
    const stepW = Math.min(1.7, Math.max(0.9, host.across * 0.38));
    const nY = -Math.sin(ang);
    const nZ = Math.cos(ang);
    const midY = (y0 + y1) / 2;
    addBox(model, stepW + 0.6, landL, 0.07, 0, -half + landL / 2, 0.045, FIN.landing);
    addBox(model, stepW + 0.6, landL, 0.06, 0, half - landL / 2, rise - 0.03, FIN.landing);
    addBox(model, stepW + 0.15, 0.16, 0.045, 0, y0, 0.1, FIN.yellow);
    addBox(model, stepW + 0.15, 0.16, 0.045, 0, y1, rise + 0.02, FIN.yellow);
    [-1, 1].forEach((side) => {
      const x = side * (stepW / 2 + 0.08);
      addBox(model, 0.08, incline, 0.55, x, midY, rise / 2, FIN.skirt, ang);
      addBox(model, 0.04, incline, 0.7, x, midY + nY * 0.46, rise / 2 + nZ * 0.46, FIN.glass, ang, 2);
      addBox(model, 0.08, incline, 0.07, x, midY + nY * 0.86, rise / 2 + nZ * 0.86, FIN.rail, ang);
      addBox(model, 0.08, landL * 0.92, 0.07, x, -half + landL / 2, nZ * 0.86, FIN.rail);
      addBox(model, 0.08, landL * 0.92, 0.07, x, half - landL / 2, rise + nZ * 0.86, FIN.rail);
      addBox(model, 0.1, 0.1, 0.92, x, -half + 0.12, 0.46, FIN.rail);
      addBox(model, 0.1, 0.1, 0.92, x, half - 0.12, rise + 0.46, FIN.rail);
    });
    const count = Math.max(8, Math.floor(incline / 0.4));
    const items = [];
    for (let i = 0; i < count; i++) {
      const step = new THREE.Group();
      step.frustumCulled = false;
      addBox(step, stepW, 0.36, 0.12, 0, 0, 0.06, FIN.tread);
      addBox(step, stepW, 0.05, 0.03, 0, 0.15, 0.12, FIN.yellow);
      const dist = (incline / count) * i;
      step.position.y = y0 + Math.cos(ang) * dist;
      step.position.z = Math.sin(ang) * dist;
      model.add(step);
      items.push({ mesh: step, phase: dist });
    }
    host.outer.userData.steps = { items: items, y0: y0, ang: ang, length: incline };
    escalatorLive = true;
  }

  function moveMachines(now) {
    if (!escalatorLive || reduceMotion || !solid) return;
    const shift = ((now || performance.now()) / 1000) * 0.48;
    shellGroup.children.forEach((group) => {
      const run = group.userData.steps;
      if (!run || !group.visible) return;
      run.items.forEach((s) => {
        const dist = (s.phase + shift) % run.length;
        s.mesh.position.y = run.y0 + Math.cos(run.ang) * dist;
        s.mesh.position.z = Math.sin(run.ang) * dist;
      });
    });
  }

  function setShell(parts) {
    clearGroup(shellGroup);
    escalatorLive = false;
    (parts || []).forEach((part) => {
      const ring = part.ring;
      if (!ring || ring.length < 4) return;
      const shape = new THREE.Shape();
      const first = toScene(ring[0]);
      shape.moveTo(first[0], first[1]);
      let end = ring.length;
      const last = ring[end - 1];
      if (last[0] === ring[0][0] && last[1] === ring[0][1]) end -= 1;
      if (end < 3) return;
      for (let i = 1; i < end; i++) {
        const p = toScene(ring[i]);
        shape.lineTo(p[0], p[1]);
      }
      if (part.kind === 'wall' && part.shopfront) {
        addShopfront(ring, part);
      } else {
        const depth = Math.max(0.02, part.top - part.bottom);
        let geo;
        try {
          geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        } catch (err) {
          return;
        }
        geo.translate(0, 0, part.bottom);
        const tex = surfaceTexture(part);
        if (tex) paintUVs(geo, tex.tile);
        const mesh = new THREE.Mesh(geo, basic(part.color));
        mesh.frustumCulled = false;
        mesh.userData = {
          ownMaterial: true,
          level: part.level,
          rank: part.rank || 0,
          kind: part.kind,
          category: part.category || '',
          id: part.id,
          color: part.color,
          tex: tex ? tex.map : null
        };
        if (tex && solid) mesh.material.map = tex.map;
        shellGroup.add(mesh);
      }
      if (part.kind === 'plate') addFacade(ring, part);
      if (part.kind === 'unit' && part.above && part.category === 'escalator') addEscalator(ring, part);
      if (part.kind === 'unit' && part.above && part.category === 'stair') addStair(ring, part);
      if (part.kind === 'unit' && part.category === 'elevator') addElevator(ring, part);
    });
    syncVisibility();
    if (solid && escalatorLive && !reduceMotion) wake(0);
    map.triggerRepaint();
  }

  function setUnitTone(selectedId, hoverId) {
    shellSelected = selectedId;
    shellHover = hoverId;
    shellGroup.children.forEach((m) => {
      if (m.userData.kind !== 'unit' || !m.material) return;
      m.material.color.set(unitColor(m.userData));
    });
    map.triggerRepaint();
  }

  function setSolid(on) {
    solid = !!on;
    syncVisibility();
    if (solid && escalatorLive && !reduceMotion) wake(0);
    map.triggerRepaint();
  }

  function setActiveLevel(levelId, rank, cats) {
    activeLevel = levelId;
    if (rank != null) shellRank = rank;
    if (cats) shellCats = cats;
    syncVisibility();
    map.triggerRepaint();
  }

  function legPoint(leg, d) {
    const pts = leg.pts;
    if (pts.length === 1 || leg.length === 0) return { x: pts[0][0], y: pts[0][1], heading: null, index: 0 };
    let i = 1;
    while (i < leg.cum.length - 1 && leg.cum[i] < d) i++;
    const seg = leg.cum[i] - leg.cum[i - 1];
    const u = seg === 0 ? 0 : (d - leg.cum[i - 1]) / seg;
    const a = pts[i - 1];
    const b = pts[i];
    return {
      x: a[0] + (b[0] - a[0]) * u,
      y: a[1] + (b[1] - a[1]) * u,
      heading: Math.atan2(b[1] - a[1], b[0] - a[0]),
      index: i
    };
  }

  function trailPoints(leg) {
    if (leg.shown >= leg.length) return leg.pts;
    if (leg.shown <= 0) return [];
    const p = legPoint(leg, leg.shown);
    return leg.pts.slice(0, p.index).concat([[p.x, p.y]]);
  }

  function updateTrail(leg) {
    const pts = trailPoints(leg);
    leg.casing.geometry.dispose();
    leg.core.geometry.dispose();
    const routeWidth = trailWidth * 0.72;
    leg.casing.geometry = ribbon(pts, routeWidth + Math.max(0.14, routeWidth * 0.45), leg.elev + TRAIL_Z);
    leg.core.geometry = ribbon(pts, routeWidth, leg.elev + TRAIL_Z + 0.004);
    if (leg.arrows) {
      leg.arrows.forEach((arrow) => {
        arrow.userData.limit = leg.shown;
        arrow.visible = arrow.userData.dist <= leg.shown + 0.2;
      });
    }
  }

  function rebuildTrails() {
    if (!pb.plan) return;
    pb.plan.legs.forEach((leg) => { if (leg.kind === 'walk') updateTrail(leg); });
  }

  function placeAt(level, xy, elev, heading) {
    pb.level = level;
    pb.x = xy[0];
    pb.y = xy[1];
    pb.z = elev;
    if (heading != null) {
      pb.heading = heading;
      pb.targetHeading = heading;
    }
    placeHere();
  }

  function ensureHere() {
    if (here) return here;
    here = new THREE.Group();
    here.frustumCulled = false;
    here.userData.kind = 'here';
    here.userData.level = null;
    const halo = new THREE.Mesh(DISC, MAT.white);
    halo.scale.setScalar(0.95);
    halo.position.z = 0.02;
    halo.renderOrder = 6;
    const dot = new THREE.Mesh(DISC, MAT.route);
    dot.scale.setScalar(0.62);
    dot.position.z = 0.04;
    dot.renderOrder = 7;
    const arrow = new THREE.Mesh(ARROW, MAT.white);
    arrow.scale.setScalar(0.5);
    arrow.position.z = 0.06;
    arrow.renderOrder = 8;
    here.add(halo, dot, arrow);
    pinGroup.add(here);
    return here;
  }

  function ensureUser() {
    if (userMark) return userMark;
    userMark = new THREE.Group();
    userMark.frustumCulled = false;
    const halo = new THREE.Mesh(DISC, MAT.white);
    halo.scale.setScalar(1.15);
    halo.position.z = 0.02;
    halo.renderOrder = 9;
    const dot = new THREE.Mesh(DISC, MAT.start);
    dot.scale.setScalar(0.72);
    dot.position.z = 0.05;
    dot.renderOrder = 10;
    const arrow = new THREE.Mesh(ARROW, MAT.white);
    arrow.scale.setScalar(0.46);
    arrow.position.z = 0.08;
    arrow.renderOrder = 11;
    arrow.name = 'heading';
    userMark.add(halo, dot, arrow);
    userGroup.add(userMark);
    return userMark;
  }

  function trailSpan(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    return cum;
  }

  function trailSlice(pts, cum, dist) {
    if (pts.length < 2 || dist <= 0) return [];
    const total = cum[cum.length - 1];
    if (dist >= total) return pts;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < dist) i++;
    const seg = cum[i] - cum[i - 1];
    const u = seg === 0 ? 0 : (dist - cum[i - 1]) / seg;
    const a = pts[i - 1];
    const b = pts[i];
    return pts.slice(0, i).concat([[a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]]);
  }

  function ensureUserTrail() {
    if (userCore) return;
    userCasing = new THREE.Mesh(new THREE.BufferGeometry(), MAT.userCasing);
    userCore = new THREE.Mesh(new THREE.BufferGeometry(), MAT.userTrail);
    userCasing.frustumCulled = false;
    userCore.frustumCulled = false;
    userCasing.renderOrder = 4;
    userCore.renderOrder = 5;
    userCasing.visible = false;
    userCore.visible = false;
    userGroup.add(userCasing, userCore);
  }

  function paintUserTrail() {
    ensureUserTrail();
    const cum = trailSpan(userPts);
    const total = cum.length ? cum[cum.length - 1] : 0;
    const pts = trailSlice(userPts, cum, Math.min(userDrawn, total));
    const show = pts.length > 1;
    userCasing.visible = show;
    userCore.visible = show;
    if (!show) return;
    const width = Math.max(0.16, trailWidth * 0.62);
    userCasing.geometry.dispose();
    userCore.geometry.dispose();
    userCasing.geometry = ribbon(pts, width + Math.max(0.08, width * 0.45), userElev + TRAIL_Z);
    userCore.geometry = ribbon(pts, width, userElev + TRAIL_Z + 0.004);
  }

  function clearUserTrail() {
    userPts = [];
    userDrawn = 0;
    if (userCore) userCore.visible = false;
    if (userCasing) userCasing.visible = false;
  }

  function userTrailLive() {
    if (userPts.length < 2) return false;
    const cum = trailSpan(userPts);
    return userDrawn < cum[cum.length - 1] - 0.01;
  }

  function extendUserTrail(xy) {
    if (!userPts.length) {
      userPts.push([xy[0], xy[1]]);
      return;
    }
    const last = userPts[userPts.length - 1];
    const step = Math.hypot(xy[0] - last[0], xy[1] - last[1]);
    if (step < USER_MIN_STEP) return;
    userPts.push([xy[0], xy[1]]);
    if (step > 60) {
      const cum = trailSpan(userPts);
      userDrawn = cum[cum.length - 1];
      paintUserTrail();
    }
    while (userPts.length > 360) {
      const drop = Math.hypot(userPts[1][0] - userPts[0][0], userPts[1][1] - userPts[0][1]);
      userPts.shift();
      userDrawn = Math.max(0, userDrawn - drop);
    }
  }

  function tickUserTrail(dt) {
    if (!userTrailLive()) return;
    const cum = trailSpan(userPts);
    const total = cum[cum.length - 1];
    userDrawn = reduceMotion ? total : Math.min(total, userDrawn + USER_DRAW * dt);
    paintUserTrail();
  }

  function setUser(lngLat, elev, heading) {
    if (!lngLat) {
      clearUserTrail();
      if (userMark) userMark.visible = false;
      map.triggerRepaint();
      return;
    }
    const marker = ensureUser();
    const xy = toScene(lngLat);
    const z = elev || 0;
    marker.position.set(xy[0], xy[1], z + PIN_Z + 0.12);
    const arrow = marker.getObjectByName('heading');
    const aimed = typeof heading === 'number' && isFinite(heading);
    if (arrow) arrow.visible = aimed;
    if (aimed) {
      const rad = heading * Math.PI / 180;
      marker.rotation.z = Math.atan2(Math.cos(rad), Math.sin(rad));
    }
    userElev = z;
    clearUserTrail();
    marker.visible = true;
    map.triggerRepaint();
  }

  function placeHere() {
    if (!pb.plan) return;
    const marker = ensureHere();
    marker.position.set(pb.x, pb.y, (pb.z || 0) + PIN_Z + 0.05);
    marker.rotation.z = pb.heading || 0;
    marker.userData.level = pb.level;
    marker.visible = !activeLevel || marker.userData.level === activeLevel;
  }

  function firstHeading(plan) {
    const leg = plan.legs.find((l) => l.kind === 'walk' && l.length > 0);
    return leg ? legPoint(leg, 0).heading : 0;
  }

  function addRouteArrows(leg) {
    if (!(leg.length > 1.4)) return;
    const gap = 7;
    let dist = Math.min(3.2, leg.length * 0.45);
    while (dist < leg.length - 0.7) {
      const p = legPoint(leg, dist);
      const arrow = new THREE.Mesh(ARROW, basic(0xFFFFFF, { depthWrite: false, depthTest: false }));
      arrow.position.set(p.x, p.y, leg.elev + TRAIL_Z + 0.03);
      arrow.rotation.z = p.heading;
      arrow.userData.level = leg.level;
      arrow.userData.kind = 'arrow';
      arrow.userData.dist = dist;
      arrow.userData.limit = 0;
      arrow.userData.ownMaterial = true;
      arrow.visible = false;
      arrow.renderOrder = 8;
      routeGroup.add(arrow);
      if (!leg.arrows) leg.arrows = [];
      leg.arrows.push(arrow);
      if (leg.length < gap) break;
      dist += gap;
    }
  }

  function setRoute(plan) {
    clearRoute();
    plan.legs.forEach((leg) => {
      if (leg.kind === 'walk') {
        leg.cum = [0];
        for (let i = 1; i < leg.pts.length; i++) {
          leg.cum.push(leg.cum[i - 1] + Math.hypot(leg.pts[i][0] - leg.pts[i - 1][0], leg.pts[i][1] - leg.pts[i - 1][1]));
        }
        leg.length = leg.cum[leg.cum.length - 1];
        leg.shown = 0;
        leg.casing = new THREE.Mesh(new THREE.BufferGeometry(), MAT.casing);
        leg.core = new THREE.Mesh(new THREE.BufferGeometry(), MAT.route);
        leg.casing.renderOrder = 6;
        leg.core.renderOrder = 7;
        leg.casing.userData.level = leg.level;
        leg.core.userData.level = leg.level;
        routeGroup.add(leg.casing, leg.core);
        addRouteArrows(leg);
      } else {
        leg.t = 0;
        leg.switched = false;
        makePin('via', leg.from, leg.xy, leg.fromElev);
        makePin('via', leg.to, leg.xy, leg.toElev);
      }
    });
    makePin('start', plan.start.level, plan.start.xy, plan.start.elev);
    makePin('end', plan.end.level, plan.end.xy, plan.end.elev);
    pb.plan = plan;
    pb.leg = 0;
    pb.done = false;
    pb.playing = false;
    pb.size = 1;
    placeAt(plan.start.level, plan.start.xy, plan.start.elev, firstHeading(plan));
    syncVisibility();
    wake(600);
  }

  function clearRoute() {
    pb.plan = null;
    pb.playing = false;
    pb.done = false;
    pb.pulses = [];
    clearGroup(routeGroup);
    clearGroup(pinGroup);
    here = null;
    if (draft) setDraft(null);
    syncVisibility();
    map.triggerRepaint();
  }

  function setDraft(item) {
    if (draft) {
      pinGroup.remove(draft);
      draft = null;
    }
    if (item) {
      draft = makePin('start', item.level, item.xy, item.elev);
      syncVisibility();
    }
    map.triggerRepaint();
  }

  function reset() {
    if (!pb.plan) return;
    pb.plan.legs.forEach((leg) => {
      if (leg.kind === 'walk') {
        leg.shown = 0;
        updateTrail(leg);
      } else {
        leg.t = 0;
        leg.switched = false;
      }
    });
    pb.leg = 0;
    pb.done = false;
    pb.playing = false;
    pb.elapsed = 0;
    pb.announced = -1;
    pb.size = 1;
    placeAt(pb.plan.start.level, pb.plan.start.xy, pb.plan.start.elev, firstHeading(pb.plan));
    syncVisibility();
    wake(300);
  }

  function play() {
    if (!pb.plan) return;
    if (pb.done) reset();
    pb.playing = true;
    pb.elapsed = 0;
    pb.total = pb.plan.legs.reduce((sum, leg) => sum + (leg.kind === 'walk' ? leg.length : RIDE_LEN), 0);
    pb.announced = -1;
    pb.plan.legs.forEach((leg) => {
      if (leg.kind === 'walk') {
        leg.shown = 0;
        updateTrail(leg);
      } else {
        leg.t = 0;
        leg.switched = false;
      }
    });
    placeAt(pb.plan.start.level, pb.plan.start.xy, pb.plan.start.elev, firstHeading(pb.plan));
    const first = pb.plan.legs[0];
    pb.announced = first ? first.step : pb.plan.arriveStep;
    hooks.onStep(pb.announced);
    wake(0);
  }

  function pause() {
    pb.playing = false;
    wake(400);
  }

  function complete(skipped) {
    pb.plan.legs.forEach((leg) => {
      if (leg.kind === 'walk') {
        leg.shown = leg.length;
        updateTrail(leg);
      } else {
        leg.t = 1;
        leg.switched = true;
      }
    });
    pb.leg = pb.plan.legs.length;
    pb.playing = false;
    pb.done = true;
    pb.size = 1;
    const walks = pb.plan.legs.filter((l) => l.kind === 'walk' && l.length > 0);
    const lastWalk = walks[walks.length - 1];
    const heading = lastWalk ? legPoint(lastWalk, lastWalk.length).heading : null;
    placeAt(pb.plan.end.level, pb.plan.end.xy, pb.plan.end.elev, heading);
    syncVisibility();
    hooks.onStep(pb.plan.arriveStep);
    hooks.onDone({ skipped: !!skipped });
    wake(4000);
  }

  function finish() {
    if (!pb.plan) return;
    if (pb.plan.end.level !== activeLevel) hooks.onLevel(pb.plan.end.level);
    complete(true);
  }

  function reveal(distance) {
    let remain = distance;
    let level = pb.plan.start.level;
    let elev = pb.plan.start.elev;
    let x = pb.plan.start.xy[0];
    let y = pb.plan.start.xy[1];
    let heading = pb.heading;
    let step = pb.plan.legs.length ? pb.plan.legs[0].step : pb.plan.arriveStep;
    let active = true;
    pb.plan.legs.forEach((leg) => {
      if (leg.kind === 'walk') {
        const show = active ? Math.max(0, Math.min(leg.length, remain)) : 0;
        leg.shown = show;
        updateTrail(leg);
        if (show > 0) {
          const p = legPoint(leg, show);
          level = leg.level;
          elev = leg.elev;
          x = p.x;
          y = p.y;
          if (p.heading != null) heading = p.heading;
          step = leg.step;
        }
        if (active) {
          remain -= leg.length;
          if (remain < -0.001) active = false;
          else remain = Math.max(0, remain);
        }
      } else if (active) {
        const climbed = Math.max(0, Math.min(RIDE_LEN, remain));
        const u = climbed / RIDE_LEN;
        leg.t = u;
        const arrived = u >= 1;
        if (arrived && !leg.switched) {
          leg.switched = true;
          if (leg.to !== activeLevel) hooks.onLevel(leg.to);
        }
        level = arrived ? leg.to : leg.from;
        elev = leg.fromElev + (leg.toElev - leg.fromElev) * u;
        x = leg.xy[0];
        y = leg.xy[1];
        step = leg.step;
        remain -= RIDE_LEN;
        if (remain < -0.001) active = false;
        else remain = Math.max(0, remain);
      }
    });
    pb.level = level;
    pb.x = x;
    pb.y = y;
    pb.z = elev;
    pb.targetHeading = heading;
    if (step !== pb.announced) {
      pb.announced = step;
      hooks.onStep(step);
    }
  }

  function tick(dt, now) {
    if (pb.plan && pb.playing) {
      pb.elapsed = Math.min(DRAW_SECONDS, pb.elapsed + dt);
      reveal((pb.elapsed / DRAW_SECONDS) * pb.total);
      if (pb.elapsed >= DRAW_SECONDS) complete(false);
      else hooks.onMove({ lngLat: fromScene(pb.x, pb.y), elev: pb.z });
    }
    pb.heading = lerpAngle(pb.heading, pb.targetHeading, 1 - Math.exp(-dt * 8));
    placeHere();
    tickUserTrail(dt);
    pb.pulses.forEach((pulse) => {
      const t = (now / 1400) % 1;
      pulse.scale.setScalar(0.7 + t * 1.6);
      pulse.material.opacity = 0.55 * (1 - t);
    });
    moveMachines(now);
  }

  function loop(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    tick(dt, now);
    map.triggerRepaint();
    if (pb.playing || userTrailLive() || now < idleUntil || (solid && escalatorLive && !reduceMotion)) {
      raf = requestAnimationFrame(loop);
    } else {
      last = 0;
    }
  }

  function wake(ms) {
    idleUntil = Math.max(idleUntil, performance.now() + (ms || 0));
    if (!raf) raf = requestAnimationFrame(loop);
  }

  return {
    layer,
    setOrigin,
    toScene,
    fromScene,
    pick,
    setLabels,
    setPathways,
    setPathwaysVisible,
    setNetwork,
    setNetworkVisible,
    setShell,
    setSite,
    setUnitTone,
    setSolid,
    setActiveLevel,
    setRoute,
    clearRoute,
    setDraft,
    setUser,
    reset,
    play,
    pause,
    finish,
    isPlaying: () => pb.playing,
    isDone: () => pb.done,
    hasRoute: () => !!pb.plan
  };
}
