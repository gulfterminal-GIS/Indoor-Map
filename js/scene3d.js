import * as THREE from 'three';
import { createCharacter, CHARACTER_HEIGHT } from './character.js';

const SPEED = { walk: 3.2, run: 6.8 };
const RIDE_SECONDS = 1.9;
const TRAIL_Z = 0.06;
const PIN_Z = 0.08;

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
  casing: basic(0xFFFFFF, { depthWrite: false }),
  route: basic(0x1565A8, { depthWrite: false }),
  path: basic(0x1565A8, { depthWrite: false, transparent: true, opacity: 0.55 }),
  white: basic(0xFFFFFF),
  start: basic(0x15803D),
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

function smooth(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
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
  const routeGroup = new THREE.Group();
  const pinGroup = new THREE.Group();
  world.add(siteGroup, shellGroup, pathGroup, routeGroup, pinGroup);

  const avatar = new THREE.Group();
  const facing = new THREE.Group();
  facing.rotation.x = Math.PI / 2;
  avatar.add(facing);
  const shadow = new THREE.Mesh(DISC, MAT.shadow);
  shadow.renderOrder = 3;
  world.add(avatar, shadow);
  avatar.visible = false;
  shadow.visible = false;

  let character = null;
  let characterKind = 'boy';

  let activeLevel = null;
  let shellRank = 0;
  let solid = false;
  let shellCats = null;
  let pathwaysOn = false;
  let pathLines = [];
  let trailWidth = 0.7;
  let charScale = 1;
  let draft = null;
  let labels = [];

  const pb = {
    plan: null,
    leg: 0,
    playing: false,
    done: false,
    gait: 'walk',
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
    charScale = Math.max(1, Math.min(2.6, (36 * mpp) / CHARACTER_HEIGHT));
    const width = Math.max(0.5, Math.min(2.4, 7 * mpp));
    if (Math.abs(width - trailWidth) / trailWidth > 0.08) {
      trailWidth = width;
      rebuildTrails();
      rebuildPaths();
    }
    const s = charScale * pb.size;
    avatar.scale.setScalar(Math.max(0.0001, s));
    avatar.position.set(pb.x, pb.y, pb.z);
    avatar.rotation.z = pb.heading + Math.PI / 2;
    shadow.position.set(pb.x, pb.y, pb.z + 0.03);
    shadow.scale.setScalar(Math.max(0.0001, 0.34 * s));
    const pinScale = Math.max(1, charScale * 0.9);
    pinGroup.children.forEach((pin) => {
      pin.scale.setScalar(pinScale);
    });
  }

  const labelPoint = new THREE.Vector4();

  function placeLabels() {
    if (!labels.length || !haveProj) return;
    const canvas = map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
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
      const scale = Math.min(1.2, Math.max(0.32, Math.pow(2, map.getZoom() - 18.4)));
      const title = !!label.title;
      label.el.style.fontSize = ((title ? 10 : 8) * scale).toFixed(2) + 'px';
      label.el.style.padding = ((title ? 2.5 : 1) * scale).toFixed(2) + 'px ' + ((title ? 6 : 4) * scale).toFixed(2) + 'px';
      label.el.style.visibility = 'visible';
      label.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) translate(-50%, -50%)';
    });
  }

  function setLabels(list) {
    labelHost.textContent = '';
    labels = list.map((item) => {
      const el = document.createElement('div');
      el.className = 'room-label' + (item.title ? ' building-title' : '') + (item.selected ? ' is-selected' : '');
      el.textContent = item.text;
      el.style.visibility = 'hidden';
      labelHost.appendChild(el);
      return { el, lngLat: item.lngLat, height: item.height || 0, title: !!item.title };
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

  function rebuildPaths() {
    clearGroup(pathGroup);
    const width = Math.max(0.14, trailWidth * 0.3);
    pathLines.forEach((line) => {
      const mesh = new THREE.Mesh(ribbon(line.pts, width, line.elev + TRAIL_Z - 0.01), MAT.path);
      mesh.userData.level = line.level;
      mesh.renderOrder = 1;
      pathGroup.add(mesh);
    });
    syncVisibility();
  }

  function setPathwaysVisible(on) {
    pathwaysOn = on;
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
        m.visible = solid ? !above : d.rank === shellRank;
        m.material.color.set(below ? 0xB9C4D2 : 0xFFFFFF);
        m.material.opacity = below ? 0.45 : 1;
        m.material.transparent = below;
        m.material.depthWrite = !below;
        m.material.needsUpdate = true;
        return;
      }
      if (d.kind === 'wall') {
        const catOn = !d.category || !shellCats || shellCats[d.category] !== false;
        m.visible = solid && d.level === activeLevel && catOn;
        m.material.color.set(0xB4C0CF);
        return;
      }
      if (d.kind === 'border') {
        const catOn = !d.category || !shellCats || shellCats[d.category] !== false;
        m.visible = !solid && d.level === activeLevel && catOn;
        return;
      }
      const catOn = !d.category || !shellCats || shellCats[d.category] !== false;
      m.visible = d.level === activeLevel && catOn;
    });
    pathGroup.children.forEach((m) => { m.visible = pathwaysOn && m.userData.level === activeLevel; });
    routeGroup.children.forEach((m) => {
      const onLevel = m.userData.level === activeLevel;
      if (m.userData.kind === 'arrow') m.visible = onLevel && m.userData.dist <= m.userData.limit + 0.2;
      else m.visible = onLevel;
    });
    pinGroup.children.forEach((m) => { m.visible = m.userData.level === activeLevel; });
    const show = !!pb.plan && pb.level === activeLevel;
    avatar.visible = show;
    shadow.visible = show;
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
    tree.scale.setScalar(part.scale || 1);
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
    const pts = drapeLine(line, 0.55);
    if (pts.length < 2) return;
    const asphalt = new THREE.Mesh(roadRibbon(pts, 6.4), basic(0x9AA3AD));
    asphalt.userData.ownMaterial = true;
    siteGroup.add(asphalt);
    const dashes = [];
    let travelled = 0;
    const dash = 3.2;
    const gap = 2.1;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-4) continue;
      let walked = 0;
      while (walked < len - 0.05) {
        const into = (travelled + walked) % (dash + gap);
        const run = into < dash ? Math.min(dash - into, len - walked) : Math.min(dash + gap - into, len - walked);
        if (into < dash && run > 0.15) {
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
      const piece = roadRibbon([seg.slice(0, 3), seg.slice(3)], 0.38);
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
    car.position.set(xy[0], xy[1], surfaceZ(part.lngLat) + 0.55);
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

  function setShell(parts) {
    clearGroup(shellGroup);
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
      const depth = Math.max(0.02, part.top - part.bottom);
      let geo;
      try {
        geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
      } catch (err) {
        return;
      }
      geo.translate(0, 0, part.bottom);
      const mesh = new THREE.Mesh(geo, basic(part.color));
      mesh.userData = {
        ownMaterial: true,
        level: part.level,
        rank: part.rank || 0,
        kind: part.kind,
        category: part.category || '',
        id: part.id,
        color: part.color
      };
      shellGroup.add(mesh);
    });
    syncVisibility();
    map.triggerRepaint();
  }

  function setUnitTone(selectedId, hoverId) {
    shellGroup.children.forEach((m) => {
      if (m.userData.kind !== 'unit') return;
      const id = m.userData.id;
      const color = String(id) === String(selectedId) ? 0xBBD3EA
        : (hoverId != null && String(id) === String(hoverId) ? 0xDCE7F2 : m.userData.color);
      m.material.color.set(color);
    });
    map.triggerRepaint();
  }

  function setSolid(on) {
    solid = !!on;
    syncVisibility();
    map.triggerRepaint();
  }

  function setActiveLevel(levelId, rank, cats) {
    activeLevel = levelId;
    if (rank != null) shellRank = rank;
    if (cats) shellCats = cats;
    syncVisibility();
    map.triggerRepaint();
  }

  function setCharacter(kind) {
    characterKind = kind === 'girl' ? 'girl' : 'boy';
    if (character) {
      facing.remove(character.root);
      character.dispose();
    }
    character = createCharacter(characterKind);
    facing.add(character.root);
    wake(600);
  }

  function setGait(gait) {
    pb.gait = gait === 'run' ? 'run' : 'walk';
    wake(300);
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
    leg.casing.geometry = ribbon(pts, trailWidth + Math.max(0.2, trailWidth * 0.5), leg.elev + TRAIL_Z);
    leg.core.geometry = ribbon(pts, trailWidth, leg.elev + TRAIL_Z + 0.004);
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
      const arrow = new THREE.Mesh(ARROW, MAT.white);
      arrow.position.set(p.x, p.y, leg.elev + TRAIL_Z + 0.03);
      arrow.rotation.z = p.heading;
      arrow.userData.level = leg.level;
      arrow.userData.kind = 'arrow';
      arrow.userData.dist = dist;
      arrow.userData.limit = 0;
      arrow.visible = false;
      arrow.renderOrder = 4;
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
        leg.casing.renderOrder = 2;
        leg.core.renderOrder = 3;
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
    pb.size = 1;
    placeAt(pb.plan.start.level, pb.plan.start.xy, pb.plan.start.elev, firstHeading(pb.plan));
    syncVisibility();
    wake(300);
  }

  function play() {
    if (!pb.plan) return;
    if (pb.done) reset();
    pb.playing = true;
    const leg = pb.plan.legs[pb.leg];
    hooks.onStep(leg ? leg.step : pb.plan.arriveStep);
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

  function advance() {
    pb.leg += 1;
    const next = pb.plan.legs[pb.leg];
    if (!next) {
      complete(false);
      return;
    }
    hooks.onStep(next.step);
  }

  function tick(dt, now) {
    let moved = 0;
    let moving = false;
    if (pb.plan && pb.playing) {
      const leg = pb.plan.legs[pb.leg];
      if (!leg) {
        complete(false);
      } else if (leg.kind === 'walk') {
        const before = leg.shown;
        leg.shown = Math.min(leg.length, leg.shown + SPEED[pb.gait] * dt);
        moved = leg.shown - before;
        moving = moved > 0;
        const p = legPoint(leg, leg.shown);
        pb.level = leg.level;
        pb.x = p.x;
        pb.y = p.y;
        pb.z = leg.elev;
        pb.size = 1;
        if (p.heading != null) pb.targetHeading = p.heading;
        updateTrail(leg);
        if (leg.shown >= leg.length) advance();
      } else {
        leg.t = Math.min(1, leg.t + dt / RIDE_SECONDS);
        pb.x = leg.xy[0];
        pb.y = leg.xy[1];
        if (leg.t < 0.5) {
          pb.z = leg.fromElev;
          pb.size = 1 - smooth(leg.t / 0.4);
        } else {
          if (!leg.switched) {
            leg.switched = true;
            pb.level = leg.to;
            hooks.onLevel(leg.to);
          }
          pb.z = leg.toElev;
          pb.size = smooth((leg.t - 0.6) / 0.4);
        }
        if (leg.t >= 1) advance();
      }
      if (pb.plan && pb.playing) hooks.onMove({ lngLat: fromScene(pb.x, pb.y), elev: pb.z });
    }
    pb.heading = lerpAngle(pb.heading, pb.targetHeading, 1 - Math.exp(-dt * 12));
    if (character) {
      character.update(dt, { moving, gait: pb.gait, distance: moved / Math.max(1, charScale) });
    }
    pb.pulses.forEach((pulse) => {
      const t = (now / 1400) % 1;
      pulse.scale.setScalar(0.7 + t * 1.6);
      pulse.material.opacity = 0.55 * (1 - t);
    });
  }

  function loop(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    tick(dt, now);
    map.triggerRepaint();
    if (pb.playing || now < idleUntil) {
      raf = requestAnimationFrame(loop);
    } else {
      last = 0;
    }
  }

  function wake(ms) {
    idleUntil = Math.max(idleUntil, performance.now() + (ms || 0));
    if (!raf) raf = requestAnimationFrame(loop);
  }

  setCharacter(characterKind);

  return {
    layer,
    setOrigin,
    toScene,
    fromScene,
    pick,
    setLabels,
    setPathways,
    setPathwaysVisible,
    setShell,
    setSite,
    setUnitTone,
    setSolid,
    setActiveLevel,
    setCharacter,
    setGait,
    setRoute,
    clearRoute,
    setDraft,
    reset,
    play,
    pause,
    finish,
    isPlaying: () => pb.playing,
    isDone: () => pb.done,
    hasRoute: () => !!pb.plan
  };
}
