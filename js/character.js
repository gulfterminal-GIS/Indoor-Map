import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createToonCharacter, CHARACTER_HEIGHT } from './toon.js';

export { CHARACTER_HEIGHT };

const MODEL_FILES = { boy: 'models/male.glb', girl: 'models/female.glb' };
const MOTION_FILE = 'models/male.glb';
const CLIPS = { idle: /idle/i, walk: /walk/i, run: /run/i };
const TPOSE = /t-?pose/i;
const NATURAL_SPEED = { walk: 1.35, run: 3.4 };
const FADE = 0.25;
const SAMPLE_FPS = 30;

const loader = new GLTFLoader();
const files = new Map();
const prepared = new WeakMap();
const rigs = new Map();

function loadFile(url) {
  if (!files.has(url)) {
    files.set(url, loader.loadAsync(url).catch((err) => {
      files.delete(url);
      throw err;
    }));
  }
  return files.get(url);
}

function findClip(gltf, pattern) {
  return gltf.animations.find((clip) => pattern.test(clip.name)) || null;
}

function bonesOf(model) {
  const list = [];
  model.traverse((o) => { if (o.isBone) list.push(o); });
  return list;
}

function worldQuats(bones) {
  const map = new Map();
  bones.forEach((bone) => map.set(bone.name, bone.getWorldQuaternion(new THREE.Quaternion())));
  return map;
}

function prepare(gltf) {
  if (prepared.has(gltf)) return prepared.get(gltf);
  const model = gltf.scene;
  const holder = new THREE.Group();
  holder.add(model);

  const tpose = findClip(gltf, TPOSE);
  if (tpose) {
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(tpose).play();
    mixer.update(0);
  }

  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = false;
    }
  });

  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
  holder.scale.setScalar(CHARACTER_HEIGHT / Math.max(0.001, size.y));
  holder.updateMatrixWorld(true);

  const foot = model.getObjectByName('mixamorigLeftFoot');
  const toe = model.getObjectByName('mixamorigLeftToeBase');
  if (foot && toe) {
    const a = foot.getWorldPosition(new THREE.Vector3());
    const b = toe.getWorldPosition(new THREE.Vector3());
    holder.rotation.y = -Math.atan2(b.x - a.x, b.z - a.z);
    holder.updateMatrixWorld(true);
  }

  const bones = bonesOf(model);
  const rest = worldQuats(bones);
  const restLocal = new Map(bones.map((bone) => [bone.name, bone.quaternion.clone()]));
  const outerParent = new Map();
  bones.forEach((bone) => {
    if (!bone.parent.isBone) outerParent.set(bone.name, bone.parent.getWorldQuaternion(new THREE.Quaternion()));
  });
  const hips = bones.find((bone) => /hips$/i.test(bone.name)) || bones[0];
  const hipsRest = hips.getWorldPosition(new THREE.Vector3());

  const info = { gltf, model, holder, bones, rest, restLocal, outerParent, hips, hipsRest };
  prepared.set(gltf, info);
  return info;
}

function bake(source, target, clip) {
  const srcBones = new Map(source.bones.map((bone) => [bone.name, bone]));
  const mixer = new THREE.AnimationMixer(source.model);
  mixer.clipAction(clip).play();

  const frames = Math.max(2, Math.round(clip.duration * SAMPLE_FPS) + 1);
  const times = new Float32Array(frames);
  const matched = target.bones.filter((bone) => srcBones.has(bone.name));
  const quatValues = new Map(matched.map((bone) => [bone.name, new Float32Array(frames * 4)]));
  const hipsValues = new Float32Array(frames * 3);
  const srcHips = srcBones.get(source.hips.name) || source.hips;

  const q = new THREE.Quaternion();
  const inv = new THREE.Quaternion();
  const pos = new THREE.Vector3();

  for (let i = 0; i < frames; i++) {
    const t = i === frames - 1 ? clip.duration : i / SAMPLE_FPS;
    times[i] = t;
    mixer.setTime(t);
    source.holder.updateMatrixWorld(true);

    const world = new Map();
    target.bones.forEach((bone) => {
      const parentWorld = world.get(bone.parent.name) || target.outerParent.get(bone.name) || new THREE.Quaternion();
      const src = srcBones.get(bone.name);
      let w;
      if (src) {
        src.getWorldQuaternion(q);
        inv.copy(source.rest.get(bone.name)).invert();
        w = q.clone().multiply(inv).multiply(target.rest.get(bone.name));
        const local = parentWorld.clone().invert().multiply(w);
        local.toArray(quatValues.get(bone.name), i * 4);
      } else {
        w = parentWorld.clone().multiply(target.restLocal.get(bone.name));
      }
      world.set(bone.name, w);
    });

    srcHips.getWorldPosition(pos).sub(source.hipsRest);
    pos.z = 0;
    const hipsWorld = target.hipsRest.clone().add(pos);
    target.hips.parent.worldToLocal(hipsWorld);
    hipsWorld.toArray(hipsValues, i * 3);
  }

  mixer.stopAllAction();
  mixer.uncacheRoot(source.model);

  const tracks = matched.map((bone) => new THREE.QuaternionKeyframeTrack(bone.name + '.quaternion', times, quatValues.get(bone.name)));
  tracks.push(new THREE.VectorKeyframeTrack(target.hips.name + '.position', times, hipsValues));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function rigFor(kind) {
  if (!rigs.has(kind)) {
    const job = Promise.all([loadFile(MOTION_FILE), loadFile(MODEL_FILES[kind] || MODEL_FILES.boy)]).then(([motionFile, modelFile]) => {
      const source = prepare(motionFile);
      const target = prepare(modelFile);
      const clips = {};
      Object.keys(CLIPS).forEach((key) => {
        const clip = findClip(motionFile, CLIPS[key]);
        if (clip) clips[key] = bake(source, target, clip);
      });
      if (!clips.walk && !clips.idle) throw new Error('No idle or walk animation in ' + MOTION_FILE);
      return { model: target.model, holder: target.holder, clips };
    });
    job.catch(() => rigs.delete(kind));
    rigs.set(kind, job);
  }
  return rigs.get(kind);
}

export function createCharacter(kind) {
  const root = new THREE.Group();
  const toon = createToonCharacter(kind);
  root.add(toon.root);
  let toonActive = true;
  let live = null;
  let disposed = false;

  function actionFor(name) {
    return live.actions[name] || live.actions.walk || live.actions.idle;
  }

  function play(name, fade) {
    const next = actionFor(name);
    if (!next || next === live.current) return;
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    if (live.current && fade > 0) next.crossFadeFrom(live.current, fade, false);
    live.current = next;
  }

  rigFor(kind).then((rig) => {
    if (disposed) return;
    root.remove(toon.root);
    toon.dispose();
    toonActive = false;
    const mixer = new THREE.AnimationMixer(rig.model);
    const actions = {};
    Object.keys(rig.clips).forEach((key) => { actions[key] = mixer.clipAction(rig.clips[key]); });
    root.add(rig.holder);
    live = { rig, mixer, actions, current: null };
    play('idle', 0);
    mixer.update(0);
  }).catch((err) => {
    console.warn('Character model could not be loaded; using the built-in figure.', err);
  });

  function update(dt, opts) {
    if (!live) {
      if (toonActive) toon.update(dt, opts);
      return;
    }
    const want = opts.moving ? opts.gait : 'idle';
    play(want, FADE);
    if (opts.moving && dt > 0 && NATURAL_SPEED[want]) {
      const speed = opts.distance / dt;
      live.current.setEffectiveTimeScale(Math.max(0.5, Math.min(2.5, speed / NATURAL_SPEED[want])));
    } else {
      live.current.setEffectiveTimeScale(1);
    }
    live.mixer.update(dt);
  }

  function dispose() {
    disposed = true;
    if (live) {
      live.mixer.stopAllAction();
      live.mixer.uncacheRoot(live.rig.model);
      root.remove(live.rig.holder);
      live = null;
    } else if (toonActive) {
      toon.dispose();
      toonActive = false;
    }
  }

  return { root, update, dispose };
}

export function preloadCharacters() {
  return Promise.allSettled(Object.keys(MODEL_FILES).map((kind) => rigFor(kind)));
}
