import * as THREE from 'three';

const GAIT = {
  walk: { leg: 0.55, knee: 0.75, arm: 0.5, elbow: -0.3, bob: 0.035, lean: 0.05, twist: 0.1, stride: 1.35 },
  run: { leg: 0.95, knee: 1.5, arm: 0.95, elbow: -1.35, bob: 0.08, lean: 0.22, twist: 0.16, stride: 2.1 }
};

const PALETTES = {
  boy: { top: 0x1565A8, bottom: 0x1B2A4A, hair: 0x2B1D14, shoe: 0x142038, skin: 0xE9BF98, eye: 0x142038 },
  girl: { top: 0xC45C26, bottom: 0x2F4A6D, hair: 0x4A2E1F, shoe: 0x1B2A4A, skin: 0xF1CBA8, eye: 0x142038 }
};

export const CHARACTER_HEIGHT = 1.78;

export function createToonCharacter(kind) {
  const girl = kind === 'girl';
  const c = girl ? PALETTES.girl : PALETTES.boy;
  const materials = new Map();
  const geometries = [];

  function mat(hex) {
    if (!materials.has(hex)) {
      materials.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.78, metalness: 0 }));
    }
    return materials.get(hex);
  }

  function mesh(geometry, hex) {
    geometries.push(geometry);
    return new THREE.Mesh(geometry, mat(hex));
  }

  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
  const sphere = (r) => new THREE.SphereGeometry(r, 22, 16);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.86;
  body.add(hips);

  const chest = new THREE.Group();
  hips.add(chest);

  const torso = mesh(capsule(0.16, 0.3), c.top);
  torso.position.y = 0.31;
  torso.scale.set(1, 1, 0.78);
  chest.add(torso);

  const neck = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), c.skin);
  neck.position.y = 0.66;
  chest.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.82;
  chest.add(head);

  const skull = mesh(sphere(0.16), c.skin);
  head.add(skull);

  [-1, 1].forEach((side) => {
    const eye = mesh(sphere(0.022), c.eye);
    eye.position.set(side * 0.058, 0.015, 0.148);
    head.add(eye);
    const ear = mesh(sphere(0.035), c.skin);
    ear.position.set(side * 0.158, 0, 0);
    ear.scale.set(0.6, 1, 0.8);
    head.add(ear);
  });

  const cap = mesh(new THREE.SphereGeometry(0.168, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), c.hair);
  cap.rotation.x = -0.35;
  cap.position.y = 0.01;
  head.add(cap);

  if (girl) {
    const back = mesh(sphere(0.162), c.hair);
    back.position.set(0, -0.04, -0.06);
    back.scale.set(1.02, 1.12, 0.82);
    head.add(back);
    const tie = mesh(sphere(0.045), c.top);
    tie.position.set(0, 0.06, -0.18);
    head.add(tie);
    const tail = mesh(capsule(0.055, 0.16), c.hair);
    tail.position.set(0, -0.06, -0.22);
    tail.rotation.x = 0.45;
    head.add(tail);
    const skirt = mesh(new THREE.CylinderGeometry(0.15, 0.25, 0.28, 20), c.bottom);
    skirt.position.y = -0.04;
    hips.add(skirt);
  }

  function limb(parent, x, y, upper, lower, upperColor, lowerColor, endGeometry, endColor, endOffset) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    parent.add(pivot);
    const a = mesh(capsule(upper.r, upper.len), upperColor);
    a.position.y = -(upper.len / 2 + upper.r);
    pivot.add(a);
    const joint = new THREE.Group();
    joint.position.y = -(upper.len + upper.r * 2);
    pivot.add(joint);
    const b = mesh(capsule(lower.r, lower.len), lowerColor);
    b.position.y = -(lower.len / 2 + lower.r);
    joint.add(b);
    const end = mesh(endGeometry, endColor);
    end.position.set(0, -(lower.len + lower.r * 2) + endOffset[1], endOffset[2]);
    if (endOffset[3]) end.scale.set(endOffset[3][0], endOffset[3][1], endOffset[3][2]);
    joint.add(end);
    return { pivot, joint };
  }

  const arms = [-1, 1].map((side) => limb(
    chest, side * 0.215, 0.55,
    { r: 0.052, len: 0.2 }, { r: 0.046, len: 0.18 },
    c.top, c.skin,
    sphere(0.052), c.skin, [0, 0.02, 0]
  ));

  const legs = [-1, 1].map((side) => limb(
    hips, side * 0.085, 0.02,
    { r: 0.072, len: 0.28 }, { r: 0.062, len: 0.28 },
    c.bottom, c.bottom,
    sphere(0.06), c.shoe, [0, 0.025, 0.045, [1, 0.7, 1.9]]
  ));

  const g = Object.assign({}, GAIT.walk);
  let phase = 0;
  let weight = 0;
  let time = 0;

  function update(dt, opts) {
    time += dt;
    const target = GAIT[opts.gait] || GAIT.walk;
    const blend = 1 - Math.exp(-dt * 8);
    Object.keys(g).forEach((key) => { g[key] += (target[key] - g[key]) * blend; });
    weight += ((opts.moving ? 1 : 0) - weight) * (1 - Math.exp(-dt * 10));
    if (opts.moving) phase += (opts.distance / g.stride) * Math.PI * 2;

    const w = weight;
    const s = Math.sin(phase);
    const co = Math.cos(phase);

    legs[0].pivot.rotation.x = -g.leg * s * w;
    legs[1].pivot.rotation.x = g.leg * s * w;
    legs[0].joint.rotation.x = g.knee * Math.max(0, co) * w;
    legs[1].joint.rotation.x = g.knee * Math.max(0, -co) * w;

    arms[0].pivot.rotation.x = g.arm * s * w;
    arms[1].pivot.rotation.x = -g.arm * s * w;
    arms[0].pivot.rotation.z = -0.06;
    arms[1].pivot.rotation.z = 0.06;
    const elbow = -0.12 + (g.elbow + 0.12) * w;
    arms[0].joint.rotation.x = elbow;
    arms[1].joint.rotation.x = elbow;

    const runBlend = opts.gait === 'run' ? Math.abs(s) : Math.abs(co);
    body.position.y = w * g.bob * runBlend;
    chest.rotation.x = g.lean * w;
    chest.rotation.y = g.twist * s * w;
    chest.position.y = Math.sin(time * 2.2) * 0.006 * (1 - w);
    head.rotation.x = -chest.rotation.x * 0.6;
    head.rotation.y = -chest.rotation.y * 0.5;
  }

  function dispose() {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  return { root, update, dispose };
}
