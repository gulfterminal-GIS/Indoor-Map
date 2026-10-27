import { createScene3D } from './scene3d.js';

const FLOOR_HEIGHT = 4;
const BASE = 1.4;
const SLAB = 0.25;
const UNIT_TOP = 0.06;
const WALL_HEIGHT = 2.6;
const PLAN_SCALE = 50 / 220;
const WALL_THICK = 0.28 * PLAN_SCALE;
const DOOR_WIDTH = 1.6 * PLAN_SCALE;
const BORDER_WIDTH = 0.55 * PLAN_SCALE;
const PITCH_3D = 55;
const BEARING_3D = -18;
const DRAW_MS = 8000;
const FLOOR_GROUND = [0xF4D7A8, 0xB9D4F5, 0xC6E7C8, 0xF3C6D6];

const CATEGORIES = [
  { id: 'hall', label: 'Halls', fill: '#E8F1F8', line: '#1565A8' },
  { id: 'room', label: 'Rooms', fill: '#F4F7FA', line: '#2F4A6D' },
  { id: 'corridor', label: 'Corridors', fill: '#E7EDF4', line: '#5C6B82' },
  { id: 'restroom', label: 'Restrooms', fill: '#E7F2EA', line: '#15803D' },
  { id: 'elevator', label: 'Elevators', fill: '#E4EAF3', line: '#1B2A4A' },
  { id: 'escalator', label: 'Escalators', fill: '#FDE7D6', line: '#C2410C' },
  { id: 'stair', label: 'Stairs', fill: '#F3EEE8', line: '#6B778C' },
  { id: 'pathway', label: 'Pathways', fill: '#1565A8', line: '#1565A8', lineOnly: true, note: 'Main lines' },
  { id: 'network', label: 'Full network', fill: '#5C6B82', line: '#5C6B82', lineOnly: true, note: 'Every walk link' }
];

const DOCK_TITLES = { floors: 'Floors', layers: 'Layers', directions: 'Directions' };

const state = {
  levelId: null,
  layers: {
    hall: true, room: true, corridor: true, restroom: true,
    elevator: true, escalator: true, stair: true, pathway: false, network: false, labels: true
  },
  is3d: false,
  dockOpen: false,
  dock: 'floors',
  selectedId: null,
  hoverId: null,
  endpoints: { from: null, to: null },
  tool: null,
  drawPhase: 0,
  route: null,
  step: 0,
  follow: true,
  vertical: 'either',
  ground: 0,
  viewer: null
};

let map;
let scene3d;
let spatial;
let graph;
let collection;
let walls = { type: 'FeatureCollection', features: [] };
let pad = 0;
let floors = [];
let layersReady = false;
let playToken = 0;
const panoCache = new Map();

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function motion(ms) {
  return reducedMotion() ? 0 : ms;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || { label: id || 'Place', fill: '#F4F7FA', line: '#2F4A6D' };
}

function featureById(id) {
  if (!collection || id == null) return null;
  return collection.features.find((f) => String(f.id) === String(id)) || null;
}

function showLoaderError(message) {
  const el = document.getElementById('loadingScreen');
  el.style.display = '';
  el.classList.remove('fade-out');
  const spin = document.querySelector('.loading-spinner');
  if (spin) spin.style.display = 'none';
  document.getElementById('loading-text').textContent = message;
}

function cameraPadding() {
  const dock = document.getElementById('dock').classList.contains('open');
  const detail = document.getElementById('detail-panel').classList.contains('open');
  const narrow = window.innerWidth <= 900;
  return {
    top: 76,
    bottom: 170,
    left: dock && !narrow ? 400 : 48,
    right: detail && !narrow ? 360 : 48
  };
}

function floorOrdinal(levelId) {
  const floor = floors.find((f) => f.id === levelId);
  return floor ? floor.ordinal : 0;
}

function floorRank(levelId) {
  const index = floors.findIndex((f) => f.id === levelId);
  return index < 0 ? 0 : index;
}

function floorGround(rank) {
  const index = Math.max(0, rank || 0);
  return FLOOR_GROUND[Math.min(index, FLOOR_GROUND.length - 1)];
}

function mixColor(base, tint, amount) {
  const channel = (color, shift) => (color >> shift) & 255;
  const mix = (a, b) => Math.round(a + (b - a) * amount);
  return (mix(channel(base, 16), channel(tint, 16)) << 16)
    | (mix(channel(base, 8), channel(tint, 8)) << 8)
    | mix(channel(base, 0), channel(tint, 0));
}

function floorBase(rank) {
  return pad + BASE + rank * FLOOR_HEIGHT;
}

function levelElev(levelId) {
  return floorBase(floorRank(levelId)) + SLAB + UNIT_TOP;
}

function targetPitch() {
  return state.is3d ? PITCH_3D : 0;
}

function cameraCenter(lonlat, elev, pitch, bearing) {
  const m = elev * Math.tan((pitch * Math.PI) / 180);
  const b = (bearing * Math.PI) / 180;
  return [
    lonlat[0] + (m * Math.sin(b)) / spatial.lonScale,
    lonlat[1] + (m * Math.cos(b)) / spatial.latScale
  ];
}

function eachCoord(geometry, visit) {
  if (!geometry || !geometry.coordinates) return;
  const coords = geometry.coordinates;
  if (typeof coords[0] === 'number') {
    visit(coords);
    return;
  }
  coords.forEach((part) => eachCoord({ coordinates: part }, visit));
}

function boundsOfFeatures(list) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  list.forEach((f) => {
    eachCoord(f.geometry, (c) => {
      any = true;
      minX = Math.min(minX, c[0]);
      minY = Math.min(minY, c[1]);
      maxX = Math.max(maxX, c[0]);
      maxY = Math.max(maxY, c[1]);
    });
  });
  if (!any) return null;
  return [[minX, minY], [maxX, maxY]];
}

function boundsOfLines(lines) {
  return boundsOfFeatures(lines.filter((line) => line && line.length).map((line) => ({
    geometry: { type: 'LineString', coordinates: line }
  })));
}

function polygonRings(feature) {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates.slice(0, 1);
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p[0]);
  return [];
}

function lineParts(feature) {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  return [];
}

function extractFloors(fc) {
  const found = new Map();
  (fc.features || []).forEach((f) => {
    const p = f.properties || {};
    if (!p.level_id) return;
    if (!found.has(p.level_id)) {
      found.set(p.level_id, {
        id: p.level_id,
        name: p.level_name || (p.feature_type === 'level' ? p.name : p.level_id),
        ordinal: p.ordinal == null ? 0 : Number(p.ordinal)
      });
    } else if (p.feature_type === 'level') {
      const floor = found.get(p.level_id);
      floor.name = p.name || p.level_name || floor.name;
      if (p.ordinal != null) floor.ordinal = Number(p.ordinal);
    }
  });
  return Array.from(found.values()).sort((a, b) => a.ordinal - b.ordinal || a.name.localeCompare(b.name));
}

function floorName(id) {
  const floor = floors.find((f) => f.id === id);
  return floor ? floor.name : (id || '—');
}

function unitsOn(levelId) {
  return collection.features
    .filter((f) => f.properties.feature_type === 'unit' && f.properties.level_id === levelId)
    .sort((a, b) => String(a.properties.name).localeCompare(String(b.properties.name)));
}

function hasPano(feature) {
  const p = (feature && feature.properties) || {};
  return p.pano === true || p.pano === 'true' || !!p.image;
}

function normalize(fc) {
  const features = (fc.features || []).map((f, i) => {
    const id = f.id != null ? f.id : (f.properties && f.properties.id != null ? f.properties.id : 'f-' + i);
    return {
      type: 'Feature',
      id: id,
      properties: Object.assign({}, f.properties, { id: id }),
      geometry: f.geometry
    };
  });
  return Object.assign({}, fc, { type: 'FeatureCollection', features: features });
}

function crossParam(a, b, p, q) {
  const r0 = b[0] - a[0];
  const r1 = b[1] - a[1];
  const s0 = q[0] - p[0];
  const s1 = q[1] - p[1];
  const den = r0 * s1 - r1 * s0;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p[0] - a[0]) * s1 - (p[1] - a[1]) * s0) / den;
  const u = ((p[0] - a[0]) * r1 - (p[1] - a[1]) * r0) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return t;
}

function edgeOf(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.05) return null;
  if (Math.abs(dy) <= 0.04) {
    return { axis: 'h', at: (a[1] + b[1]) / 2, min: Math.min(a[0], b[0]), max: Math.max(a[0], b[0]), a: a, b: b, len: len };
  }
  if (Math.abs(dx) <= 0.04) {
    return { axis: 'v', at: (a[0] + b[0]) / 2, min: Math.min(a[1], b[1]), max: Math.max(a[1], b[1]), a: a, b: b, len: len };
  }
  return { axis: 'd', a: a, b: b, len: len };
}

function mergeSpans(spans) {
  if (!spans.length) return [];
  const sorted = spans.slice().sort((p, q) => p[0] - q[0]);
  const out = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i][0] <= last[1] + 0.05) last[1] = Math.max(last[1], sorted[i][1]);
    else out.push([sorted[i][0], sorted[i][1]]);
  }
  return out;
}

function cutSpans(segments, cuts) {
  const out = [];
  segments.forEach((seg) => {
    let cursor = seg[0];
    cuts.forEach((cut) => {
      const c0 = Math.max(seg[0], cut[0]);
      const c1 = Math.min(seg[1], cut[1]);
      if (c1 <= c0 + 0.001) return;
      if (c0 > cursor + 0.05) out.push([cursor, c0]);
      cursor = Math.max(cursor, c1);
    });
    if (seg[1] > cursor + 0.05) out.push([cursor, seg[1]]);
  });
  return out;
}

function sharedSpans(edge, others) {
  if (!others || edge.axis === 'd') return [];
  const spans = [];
  others.forEach((other) => {
    if (other.axis !== edge.axis || Math.abs(other.at - edge.at) > 0.3) return;
    const lo = Math.max(edge.min, other.min);
    const hi = Math.min(edge.max, other.max);
    if (hi - lo < 0.35) return;
    const origin = edge.axis === 'h' ? edge.a[0] : edge.a[1];
    const dir = (edge.axis === 'h' ? edge.b[0] - edge.a[0] : edge.b[1] - edge.a[1]) >= 0 ? 1 : -1;
    const s0 = (lo - origin) * dir;
    const s1 = (hi - origin) * dir;
    spans.push([Math.max(0, Math.min(s0, s1)), Math.min(edge.len, Math.max(s0, s1))]);
  });
  return mergeSpans(spans);
}

function buildWalls() {
  const segments = new Map();
  const circulation = new Map();
  const rooms = new Map();
  collection.features.forEach((f) => {
    const p = f.properties;
    if (p.feature_type === 'pathway') {
      if (!segments.has(p.level_id)) segments.set(p.level_id, []);
      lineParts(f).forEach((line) => {
        for (let i = 1; i < line.length; i++) {
          segments.get(p.level_id).push([
            spatial.toMeters(line[i - 1][0], line[i - 1][1]),
            spatial.toMeters(line[i][0], line[i][1])
          ]);
        }
      });
      return;
    }
    if (p.feature_type !== 'unit') return;
    const bucket = p.category === 'corridor' || p.category === 'hall' ? circulation : p.category === 'room' ? rooms : null;
    if (!bucket) return;
    if (!bucket.has(p.level_id)) bucket.set(p.level_id, []);
    const list = bucket.get(p.level_id);
    polygonRings(f).forEach((ring) => {
      const pts = ring.map((c) => spatial.toMeters(c[0], c[1]));
      for (let i = 1; i < pts.length; i++) {
        const edge = edgeOf(pts[i - 1], pts[i]);
        if (edge && edge.axis !== 'd') list.push(edge);
      }
    });
  });

  const out = [];
  const half = WALL_THICK / 2;
  const pushPiece = (p, a, b, len, s0, s1, shopfront, door) => {
    const dx = (b[0] - a[0]) / len;
    const dy = (b[1] - a[1]) / len;
    const nx = -dy * half;
    const ny = dx * half;
    const e0 = s0 <= 0.001 ? -half : 0;
    const e1 = s1 >= len - 0.001 ? half : 0;
    const p0 = [a[0] + dx * (s0 + e0), a[1] + dy * (s0 + e0)];
    const p1 = [a[0] + dx * (s1 + e1), a[1] + dy * (s1 + e1)];
    const corners = [
      [p0[0] + nx, p0[1] + ny],
      [p1[0] + nx, p1[1] + ny],
      [p1[0] - nx, p1[1] - ny],
      [p0[0] - nx, p0[1] - ny]
    ].map((c) => spatial.toLonLat(c[0], c[1]));
    corners.push(corners[0]);
    out.push({
      type: 'Feature',
      properties: {
        level_id: p.level_id,
        rank: p.rank,
        category: p.category,
        shopfront: !!shopfront,
        door: !!door
      },
      geometry: { type: 'Polygon', coordinates: [corners] }
    });
  };
  collection.features.forEach((f) => {
    const p = f.properties;
    if (p.feature_type !== 'unit') return;
    const paths = segments.get(p.level_id) || [];
    const fronts = p.category === 'room' ? circulation.get(p.level_id) : (p.category === 'corridor' || p.category === 'hall') ? rooms.get(p.level_id) : null;
    polygonRings(f).forEach((ring) => {
      const pts = ring.map((c) => spatial.toMeters(c[0], c[1]));
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const edge = edgeOf(a, b);
        if (!edge) continue;
        const gaps = [];
        paths.forEach((seg) => {
          const t = crossParam(a, b, seg[0], seg[1]);
          if (t != null) gaps.push([t * edge.len - DOOR_WIDTH / 2, t * edge.len + DOOR_WIDTH / 2]);
        });
        gaps.sort((x, y) => x[0] - y[0]);
        const front = sharedSpans(edge, fronts);
        let solid = [[0, edge.len]];
        let glass = [];
        let doors = [];
        if (p.category === 'room') {
          glass = cutSpans(front, gaps);
          solid = cutSpans(cutSpans([[0, edge.len]], front), gaps);
          front.forEach((span) => {
            gaps.forEach((gap) => {
              const g0 = Math.max(span[0], gap[0]);
              const g1 = Math.min(span[1], gap[1]);
              if (g1 - g0 > 0.4) doors.push([g0, g1]);
            });
          });
        } else if (p.category === 'corridor' || p.category === 'hall') {
          solid = cutSpans(cutSpans([[0, edge.len]], front), gaps);
        } else {
          solid = cutSpans([[0, edge.len]], gaps);
        }
        solid.forEach((seg) => pushPiece(p, a, b, edge.len, seg[0], seg[1], false, false));
        glass.forEach((seg) => pushPiece(p, a, b, edge.len, seg[0], seg[1], true, false));
        doors.forEach((seg) => pushPiece(p, a, b, edge.len, seg[0], seg[1], true, true));
      }
    });
  });
  return { type: 'FeatureCollection', features: out };
}

function applyFilters() {
  if (!layersReady || !state.levelId) return;
  scene3d.setActiveLevel(state.levelId, floorRank(state.levelId), state.layers);
  scene3d.setPathwaysVisible(state.layers.pathway);
  scene3d.setNetworkVisible(state.layers.network);
  scene3d.setUnitTone(state.selectedId, state.hoverId);
}

function ensureLayers() {
  if (!map.getLayer('scene3d')) map.addLayer(scene3d.layer);
  layersReady = true;
}

function footprintHigh() {
  let high = state.ground;
  const sample = (lng, lat) => {
    let h = null;
    try { h = map.queryTerrainElevation([lng, lat]); } catch (err) { h = null; }
    if (h != null && isFinite(h) && h > high) high = h;
  };
  collection.features.forEach((f) => {
    if (f.properties.feature_type !== 'level' || (f.properties.rank || 0) !== 0) return;
    polygonRings(f).forEach((ring) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      ring.forEach((c) => {
        sample(c[0], c[1]);
        minX = Math.min(minX, c[0]);
        minY = Math.min(minY, c[1]);
        maxX = Math.max(maxX, c[0]);
        maxY = Math.max(maxY, c[1]);
      });
      if (!isFinite(minX)) return;
      sample((minX + maxX) / 2, (minY + maxY) / 2);
      sample((minX + maxX) / 2, minY);
      sample((minX + maxX) / 2, maxY);
      sample(minX, (minY + maxY) / 2);
      sample(maxX, (minY + maxY) / 2);
    });
  });
  return high;
}

function pathSegments(levelId) {
  const segs = [];
  collection.features.forEach((f) => {
    const p = f.properties;
    if (p.feature_type !== 'pathway' || p.level_id !== levelId) return;
    lineParts(f).forEach((line) => {
      for (let i = 1; i < line.length; i++) {
        segs.push([
          spatial.toMeters(line[i - 1][0], line[i - 1][1]),
          spatial.toMeters(line[i][0], line[i][1])
        ]);
      }
    });
  });
  return segs;
}

function borderRings(ring, paths) {
  const width = BORDER_WIDTH;
  const meters = ring.map((c) => spatial.toMeters(c[0], c[1]));
  const out = [];
  for (let i = 1; i < meters.length; i++) {
    const a = meters[i - 1];
    const b = meters[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.05) continue;
    const gaps = [];
    (paths || []).forEach((seg) => {
      const t = crossParam(a, b, seg[0], seg[1]);
      if (t != null) gaps.push([t * len - DOOR_WIDTH / 2, t * len + DOOR_WIDTH / 2]);
    });
    gaps.sort((x, y) => x[0] - y[0]);
    const pieces = [];
    let cursor = 0;
    gaps.forEach((gap) => {
      const g0 = Math.max(0, gap[0]);
      const g1 = Math.min(len, gap[1]);
      if (g0 > cursor + 0.05) pieces.push([cursor, g0]);
      cursor = Math.max(cursor, g1);
    });
    if (len > cursor + 0.05) pieces.push([cursor, len]);
    const dx = (b[0] - a[0]) / len;
    const dy = (b[1] - a[1]) / len;
    const nx = -dy * (width / 2);
    const ny = dx * (width / 2);
    pieces.forEach(([s0, s1]) => {
      const p0 = [a[0] + dx * s0, a[1] + dy * s0];
      const p1 = [a[0] + dx * s1, a[1] + dy * s1];
      const corners = [
        [p0[0] + nx, p0[1] + ny],
        [p1[0] + nx, p1[1] + ny],
        [p1[0] - nx, p1[1] - ny],
        [p0[0] - nx, p0[1] - ny]
      ].map((c) => spatial.toLonLat(c[0], c[1]));
      corners.push(corners[0]);
      out.push(corners);
    });
  }
  return out;
}

function shellParts() {
  const parts = [];
  const topRank = {};
  collection.features.forEach((f) => {
    const p = f.properties;
    if (!p || p.feature_type !== 'level') return;
    const key = p.building || p.level_id || '';
    const rank = p.rank || 0;
    if (topRank[key] == null || rank > topRank[key]) topRank[key] = rank;
  });
  const add = (ring, extra) => {
    if (!ring || ring.length < 4) return;
    parts.push(Object.assign({ ring: ring }, extra));
  };
  collection.features.forEach((f) => {
    const p = f.properties;
    if (p.feature_type !== 'level') return;
    const rank = p.rank || 0;
    const z = floorBase(rank);
    polygonRings(f).forEach((ring) => {
      if (rank === 0) {
        add(ring, { level: p.level_id, rank: rank, kind: 'base', bottom: pad + 0.15, top: pad + BASE - 0.02, color: 0xD5DDE6 });
      }
      add(ring, { level: p.level_id, rank: rank, kind: 'plate', bottom: z, top: z + SLAB, color: floorGround(rank), story: FLOOR_HEIGHT, slab: SLAB });
    });
  });
  walls.features.forEach((f) => {
    const p = f.properties;
    const rank = p.rank || 0;
    const z = floorBase(rank) + SLAB;
    polygonRings(f).forEach((ring) => {
      add(ring, {
        level: p.level_id,
        rank: rank,
        kind: 'wall',
        category: p.category,
        shopfront: !!p.shopfront,
        door: !!p.door,
        bottom: z,
        top: z + WALL_HEIGHT,
        color: 0xB4C0CF
      });
    });
  });
  const pathsByLevel = new Map();
  collection.features.forEach((f) => {
    const p = f.properties;
    if (p.feature_type !== 'unit') return;
    const rank = p.rank || 0;
    const z = floorBase(rank) + SLAB;
    const color = mixColor(parseInt(String(categoryMeta(p.category).fill).slice(1), 16), floorGround(rank), 0.62);
    if (!pathsByLevel.has(p.level_id)) pathsByLevel.set(p.level_id, pathSegments(p.level_id));
    const doors = pathsByLevel.get(p.level_id);
    polygonRings(f).forEach((ring) => {
      add(ring, {
        id: f.id,
        level: p.level_id,
        rank: rank,
        kind: 'unit',
        category: p.category,
        name: p.name || '',
        above: rank < (topRank[p.building || p.level_id || ''] == null ? rank : topRank[p.building || p.level_id || '']),
        rise: FLOOR_HEIGHT - UNIT_TOP,
        bottom: z + 0.01,
        top: z + UNIT_TOP,
        color: color
      });
      borderRings(ring, doors).forEach((edge) => {
        add(edge, {
          level: p.level_id,
          rank: rank,
          kind: 'border',
          category: p.category,
          bottom: z + UNIT_TOP + 0.02,
          top: z + UNIT_TOP + 0.08,
          color: 0x1B2A4A
        });
      });
    });
  });
  return parts;
}

function siteFeatures() {
  const parts = [];
  collection.features.forEach((f) => {
    const p = f.properties || {};
    if (p.feature_type === 'green') {
      polygonRings(f).forEach((ring) => parts.push({ kind: 'lawn', ring: ring, color: parseInt(String(p.color || '7EAE62'), 16) }));
    } else if (p.feature_type === 'tree' && f.geometry && f.geometry.type === 'Point') {
      parts.push({
        kind: p.tree === 'palm' ? 'palm' : 'tree',
        lngLat: f.geometry.coordinates,
        scale: p.scale || 1,
        color: parseInt(String(p.color || '2F7D45'), 16)
      });
    } else if (p.feature_type === 'road' && f.geometry && f.geometry.type === 'LineString') {
      parts.push({ kind: 'road', line: f.geometry.coordinates });
    } else if (p.feature_type === 'car' && f.geometry && f.geometry.type === 'Point') {
      parts.push({
        kind: 'car',
        lngLat: f.geometry.coordinates,
        heading: p.heading || 0,
        color: parseInt(String(p.color || 'F4F7FA'), 16)
      });
    }
  });
  return parts;
}

function seatBuilding() {
  pad = Math.max(0, footprintHigh() - state.ground);
  scene3d.setShell(shellParts());
  scene3d.setSite(siteFeatures());
  scene3d.setPathways(pathwayLines());
  scene3d.setNetwork(networkLines());
  refreshLabels();
}

function loadCollection(fc, fit) {
  collection = normalize(fc);
  floors = extractFloors(collection);
  if (!floors.length) {
    IndoorUI.toast('This GeoJSON has no floors.');
    return;
  }
  collection.features.forEach((f) => {
    if (f.properties.level_id) f.properties.rank = floorRank(f.properties.level_id);
  });
  spatial = IndoorRoute.spatial(collection);
  graph = IndoorRoute.buildGraph(spatial, collection);
  walls = buildWalls();
  scene3d.setOrigin([spatial.origin.lon, spatial.origin.lat], state.ground);
  if (!floors.some((f) => f.id === state.levelId)) state.levelId = floors[0].id;

  state.selectedId = null;
  state.hoverId = null;
  state.endpoints.from = null;
  state.endpoints.to = null;
  closeDetail();
  ensureLayers();
  scene3d.setShell(shellParts());
  scene3d.setSite(siteFeatures());
  clearRoute();
  scene3d.setPathways(pathwayLines());
  scene3d.setNetwork(networkLines());
  applyFilters();
  syncFloorUi();
  renderLayerChoices();
  renderLegend();
  syncEndpointUi('from');
  syncEndpointUi('to');
  refreshLabels();
  updateStatus();
  map.setMaxBounds(null);
  if (!graph.nodes.size) IndoorUI.toast('This plan has no pathways, so directions are unavailable.');
  if (fit) fitFloor(true);
}

function unitFrame(feature) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  polygonRings(feature).forEach((ring) => {
    ring.forEach((c) => {
      const m = spatial.toMeters(c[0], c[1]);
      minX = Math.min(minX, m[0]);
      minY = Math.min(minY, m[1]);
      maxX = Math.max(maxX, m[0]);
      maxY = Math.max(maxY, m[1]);
    });
  });
  if (!isFinite(minX)) return null;
  const p = feature.properties;
  return {
    level: p.level_id,
    category: p.category,
    minX: minX,
    minY: minY,
    maxX: maxX,
    maxY: maxY,
    w: maxX - minX,
    h: maxY - minY
  };
}

function frameAt(frames, level, x, y) {
  let found = null;
  let best = Infinity;
  frames.forEach((box) => {
    if (box.level !== level) return;
    if (x < box.minX - 0.05 || x > box.maxX + 0.05 || y < box.minY - 0.05 || y > box.maxY + 0.05) return;
    const area = box.w * box.h;
    if (area < best) {
      best = area;
      found = box;
    }
  });
  return found;
}

function pathwayLines() {
  const frames = [];
  collection.features.forEach((f) => {
    if (!f.properties || f.properties.feature_type !== 'unit') return;
    const frame = unitFrame(f);
    if (frame) frames.push(frame);
  });
  const lines = [];
  const pending = [];
  collection.features.forEach((f) => {
    const p = f.properties || {};
    if (p.feature_type !== 'pathway') return;
    const elev = levelElev(p.level_id);
    lineParts(f).forEach((line) => {
      for (let i = 1; i < line.length; i++) {
        const a = spatial.toMeters(line[i - 1][0], line[i - 1][1]);
        const b = spatial.toMeters(line[i][0], line[i][1]);
        const dx = Math.abs(b[0] - a[0]);
        const dy = Math.abs(b[1] - a[1]);
        const item = {
          level: p.level_id,
          elev: elev,
          pts: [line[i - 1], line[i]].map((c) => scene3d.toScene(c)),
          a: a,
          b: b,
          horizontal: dy <= 0.08 && dx > 0.08,
          vertical: dx <= 0.08 && dy > 0.08
        };
        if (p.outdoor) lines.push(item);
        else pending.push(item);
      }
    });
  });
  const spines = pending.filter((seg) => {
    const box = frameAt(frames, seg.level, (seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2);
    if (!box || (box.category !== 'corridor' && box.category !== 'hall')) return false;
    if (box.w >= box.h) {
      const cy = (box.minY + box.maxY) / 2;
      return seg.horizontal && Math.abs(seg.a[1] - cy) <= 0.45 && Math.abs(seg.b[1] - cy) <= 0.45;
    }
    const cx = (box.minX + box.maxX) / 2;
    return seg.vertical && Math.abs(seg.a[0] - cx) <= 0.45 && Math.abs(seg.b[0] - cx) <= 0.45;
  });
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.6;
  pending.forEach((seg) => {
    if (spines.includes(seg)) {
      lines.push(seg);
      return;
    }
    const mid = frameAt(frames, seg.level, (seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2);
    if (mid) return;
    const joined = spines.some((spine) => {
      if (spine.level !== seg.level) return false;
      if (seg.horizontal !== spine.horizontal || seg.vertical !== spine.vertical) return false;
      if (seg.horizontal && Math.abs(seg.a[1] - spine.a[1]) > 0.25) return false;
      if (seg.vertical && Math.abs(seg.a[0] - spine.a[0]) > 0.25) return false;
      return near(seg.a, spine.a) || near(seg.a, spine.b) || near(seg.b, spine.a) || near(seg.b, spine.b);
    });
    if (joined) lines.push(seg);
  });
  return lines;
}

function networkLines() {
  const lines = [];
  collection.features.forEach((f) => {
    const p = f.properties || {};
    if (p.feature_type !== 'pathway') return;
    const elev = levelElev(p.level_id);
    lineParts(f).forEach((line) => {
      for (let i = 1; i < line.length; i++) {
        lines.push({
          level: p.level_id,
          elev: elev,
          pts: [line[i - 1], line[i]].map((c) => scene3d.toScene(c))
        });
      }
    });
  });
  return lines;
}

function syncGlass() {
  if (document.documentElement.getAttribute('data-theme') === 'glass') IndoorUI.syncLiquidGlass();
}

function syncFloorUi() {
  const pills = document.getElementById('floor-pills');
  pills.innerHTML = '';
  floors.slice().reverse().forEach((floor) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bookmark-pill' + (floor.id === state.levelId ? ' active' : '');
    const swatch = document.createElement('span');
    swatch.className = 'floor-swatch';
    swatch.style.background = '#' + floorGround(floorRank(floor.id)).toString(16).padStart(6, '0');
    btn.appendChild(swatch);
    btn.appendChild(document.createTextNode(floor.name));
    btn.setAttribute('aria-pressed', floor.id === state.levelId ? 'true' : 'false');
    btn.addEventListener('click', () => setFloor(floor.id, true));
    pills.appendChild(btn);
  });

  const list = document.getElementById('floor-list');
  list.innerHTML = '';
  floors.slice().reverse().forEach((floor) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn' + (floor.id === state.levelId ? ' active' : '');
    const ground = '#' + floorGround(floorRank(floor.id)).toString(16).padStart(6, '0');
    btn.innerHTML = '<span class="floor-swatch" style="background:' + ground + ';margin-top:4px"></span><span class="choice-copy"><strong>' + esc(floor.name) + '</strong><span>' + unitsOn(floor.id).length + ' places</span></span>';
    btn.addEventListener('click', () => setFloor(floor.id, true));
    list.appendChild(btn);
  });
  syncGlass();
}

function renderLayerChoices() {
  const list = document.getElementById('layer-list');
  list.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn' + (state.layers[cat.id] ? ' active' : '');
    btn.setAttribute('aria-pressed', state.layers[cat.id] ? 'true' : 'false');
    btn.innerHTML = '<span class="choice-copy"><strong>' + esc(cat.label) + '</strong><span>' + esc(cat.note || 'Show on the plan') + '</span></span>';
    btn.addEventListener('click', () => toggleLayer(cat.id));
    list.appendChild(btn);
  });
  const labels = document.createElement('button');
  labels.type = 'button';
  labels.className = 'choice-btn' + (state.layers.labels ? ' active' : '');
  labels.setAttribute('aria-pressed', state.layers.labels ? 'true' : 'false');
  labels.innerHTML = '<span class="choice-copy"><strong>Labels</strong><span>Names on the plan</span></span>';
  labels.addEventListener('click', () => toggleLayer('labels'));
  list.appendChild(labels);
}

function renderLegend() {
  const host = document.getElementById('legendContent');
  host.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'legend-item' + (state.layers[cat.id] ? '' : ' off');
    if (cat.lineOnly) {
      row.innerHTML = '<span class="legend-line" style="background:' + cat.line + '"></span><span class="legend-text">' + esc(cat.label) + '</span>';
    } else {
      row.innerHTML = '<span class="legend-swatch" style="background:' + cat.fill + ';border-color:' + cat.line + '"></span><span class="legend-text">' + esc(cat.label) + '</span>';
    }
    row.addEventListener('click', () => toggleLayer(cat.id));
    host.appendChild(row);
  });
  const foot = document.createElement('div');
  foot.className = 'muted';
  foot.style.marginTop = '8px';
  foot.textContent = collection && collection.name ? collection.name : 'Indoor plan';
  host.appendChild(foot);
}

function toggleLayer(id) {
  state.layers[id] = !state.layers[id];
  applyFilters();
  renderLayerChoices();
  renderLegend();
  refreshLabels();
}

function setFloor(id, fly) {
  if (!floors.some((f) => f.id === id) || !map) return;
  const changed = id !== state.levelId;
  state.levelId = id;
  applyFilters();
  placeDevice();
  syncFloorUi();
  refreshLabels();
  updateStatus();
  if (fly) fitFloor(false);
  else if (changed && !scene3d.isPlaying()) recenterOnFloor();
}

function recenterOnFloor() {
  const center = map.getCenter();
  const elevNow = state._lastElev == null ? levelElev(state.levelId) : state._lastElev;
  const elev = levelElev(state.levelId);
  const pitch = map.getPitch();
  const bearing = map.getBearing();
  const ground = cameraCenter([center.lng, center.lat], -elevNow, pitch, bearing);
  map.easeTo({ center: cameraCenter(ground, elev, pitch, bearing), duration: motion(600) });
  state._lastElev = elev;
}

function fitFloor(resetBearing, duration) {
  const features = collection.features.filter((f) => f.properties.level_id === state.levelId && f.properties.feature_type !== 'pathway');
  const bounds = boundsOfFeatures(features.length ? features : collection.features);
  if (!bounds) return;
  fitShifted(bounds, levelElev(state.levelId), resetBearing ? (state.is3d ? BEARING_3D : 0) : map.getBearing(), duration);
}

function fitShifted(bounds, elev, bearing, duration) {
  const pitch = targetPitch();
  const shifted = cameraCenter(bounds[0], elev, pitch, bearing);
  const dx = shifted[0] - bounds[0][0];
  const dy = shifted[1] - bounds[0][1];
  state._lastElev = elev;
  map.fitBounds([[bounds[0][0] + dx, bounds[0][1] + dy], [bounds[1][0] + dx, bounds[1][1] + dy]], {
    padding: cameraPadding(),
    duration: duration == null ? motion(900) : duration,
    maxZoom: 20.4,
    pitch,
    bearing,
    linear: true
  });
}

function flyTo(lonlat, zoom, levelId) {
  if (!lonlat) return;
  const elev = levelElev(levelId || state.levelId);
  const pitch = targetPitch();
  state._lastElev = elev;
  map.easeTo({
    center: cameraCenter(lonlat, elev, pitch, map.getBearing()),
    zoom: zoom == null ? Math.min(21.2, Math.max(map.getZoom(), 20.2)) : zoom,
    pitch,
    duration: motion(800),
    padding: cameraPadding(),
    essential: true
  });
}

function refreshLabels() {
  if (!scene3d || !collection) return;
  const list = [];
  const seen = new Set();
  const titleHeight = floorBase(floorRank(state.levelId)) + WALL_HEIGHT + 1.2;
  collection.features.forEach((f) => {
    const p = f.properties;
    if (p.feature_type !== 'level' || p.level_id !== state.levelId || !p.building || seen.has(p.building)) return;
    seen.add(p.building);
    list.push({
      text: p.building,
      lngLat: IndoorRoute.describe(spatial, f).centroidLonLat,
      height: titleHeight,
      title: true
    });
  });
  if (state.layers.labels) {
    const zoom = map.getZoom();
    const height = levelElev(state.levelId) + 0.35;
    collection.features.forEach((f) => {
      const p = f.properties;
      if (p.feature_type !== 'unit' || p.level_id !== state.levelId) return;
      if (!state.layers[p.category] || p.category === 'corridor') return;
      const selected = String(f.id) === String(state.selectedId);
      if (zoom < 17.6 && !selected) return;
      list.push({ text: p.name, lngLat: IndoorRoute.describe(spatial, f).centroidLonLat, height: height, selected: selected });
    });
  }
  scene3d.setLabels(list);
}

function paintSelect(id) {
  state.selectedId = id;
  if (scene3d) scene3d.setUnitTone(state.selectedId, state.hoverId);
}

function servedText(group) {
  if (!group) return '';
  return floors.filter((floor) => collection.features.some((f) => f.properties.transition_group === group && f.properties.level_id === floor.id))
    .map((floor) => floor.name)
    .join(', ');
}

function openDetail(feature) {
  const p = feature.properties;
  const meta = categoryMeta(p.category);
  const described = IndoorRoute.describe(spatial, feature);
  document.getElementById('detail-type').textContent = meta.label + ' · ' + (p.level_name || floorName(p.level_id));
  document.getElementById('detail-title').textContent = p.name || 'Place';
  const area = described.area > 1 ? Math.round(described.area) + ' m²' : '—';
  const serves = servedText(p.transition_group);
  let html = '<div class="stat-grid">'
    + '<div class="stat"><div class="k">Floor</div><div class="v">' + esc(p.level_name || floorName(p.level_id)) + '</div></div>'
    + '<div class="stat"><div class="k">Area</div><div class="v">' + esc(area) + '</div></div>'
    + '</div>';
  if (serves) html += '<div class="dealer-block"><p>Serves ' + esc(serves) + '.</p></div>';
  else if (p.summary) html += '<div class="dealer-block"><p>' + esc(p.summary) + '</p></div>';
  html += '<div class="detail-actions">'
    + '<button class="btn" type="button" id="detail-from">Directions from here</button>'
    + '<button class="btn" type="button" id="detail-to">Directions to here</button>';
  if (hasPano(feature)) html += '<button class="btn btn-primary" type="button" id="detail-pano">View 360</button>';
  html += '</div>';
  document.getElementById('detail-body').innerHTML = html;
  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('detail-from').addEventListener('click', () => {
    openDock('directions', true);
    setEndpoint('from', endpointFromFeature(feature));
  });
  document.getElementById('detail-to').addEventListener('click', () => {
    openDock('directions', true);
    setEndpoint('to', endpointFromFeature(feature));
  });
  const panoBtn = document.getElementById('detail-pano');
  if (panoBtn) panoBtn.addEventListener('click', () => openPano(feature));
  syncGlass();
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
}

function selectFeature(feature, fly) {
  if (!feature) return;
  if (feature.properties.level_id && feature.properties.level_id !== state.levelId) {
    state.levelId = feature.properties.level_id;
    applyFilters();
    syncFloorUi();
  }
  paintSelect(feature.id);
  openDetail(feature);
  refreshLabels();
  updateStatus();
  if (fly) flyTo(IndoorRoute.describe(spatial, feature).centroidLonLat, null, feature.properties.level_id);
}

function endpointFromFeature(feature) {
  const anchor = IndoorRoute.anchorMeters(spatial, feature);
  return {
    id: feature.id,
    name: feature.properties.name,
    building: feature.properties.building || '',
    level_id: feature.properties.level_id,
    level_name: feature.properties.level_name || floorName(feature.properties.level_id),
    x: anchor[0],
    y: anchor[1],
    focus: spatial.toLonLat(anchor[0], anchor[1])
  };
}

function floorPoint(event) {
  return scene3d.pick(event.point, levelElev(state.levelId)) || [event.lngLat.lng, event.lngLat.lat];
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(area);
}

function ringContains(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][1];
    const yj = ring[j][1];
    if ((yi > lat) === (yj > lat)) continue;
    const x = ((ring[j][0] - ring[i][0]) * (lat - yi)) / (yj - yi) + ring[i][0];
    if (lon < x) inside = !inside;
  }
  return inside;
}

function unitAt(lonlat, skipCorridor) {
  let found = null;
  let best = Infinity;
  collection.features.forEach((f) => {
    const p = f.properties;
    if (p.feature_type !== 'unit' || p.level_id !== state.levelId) return;
    if (!state.layers[p.category]) return;
    if (skipCorridor && p.category === 'corridor') return;
    const rings = polygonRings(f);
    if (!rings.some((ring) => ringContains(ring, lonlat[0], lonlat[1]))) return;
    const area = ringArea(rings[0]);
    if (area < best) {
      best = area;
      found = f;
    }
  });
  return found;
}

function endpointFromEvent(event) {
  const hit = unitAt(floorPoint(event), true);
  if (hit) return endpointFromFeature(hit);
  const lonlat = floorPoint(event);
  const meters = spatial.toMeters(lonlat[0], lonlat[1]);
  const near = IndoorRoute.nearest(graph, state.levelId, meters[0], meters[1]);
  if (!near || near.d > 12) return null;
  return {
    id: null,
    name: 'Map point',
    level_id: state.levelId,
    level_name: floorName(state.levelId),
    x: near.node.x,
    y: near.node.y,
    focus: near.node.lonlat
  };
}

function floorAliases() {
  const list = [];
  floors.forEach((floor) => {
    list.push({ id: floor.id, key: String(floor.name || '').toLowerCase() });
    list.push({ id: floor.id, key: String(floor.id || '').toLowerCase() });
  });
  [
    ['L0', 'ground floor'],
    ['L1', 'first floor'], ['L1', '1st floor'],
    ['L2', 'second floor'], ['L2', '2nd floor'],
    ['L3', 'third floor'], ['L3', '3rd floor']
  ].forEach((pair) => list.push({ id: pair[0], key: pair[1] }));
  return list.filter((item) => item.key).sort((a, b) => b.key.length - a.key.length);
}

function queryParts(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { levelId: null, rest: '' };
  const aliases = floorAliases();
  for (let i = 0; i < aliases.length; i++) {
    const key = aliases[i].key;
    const at = q.indexOf(key);
    if (at < 0) continue;
    const before = at === 0 || q.charAt(at - 1) === ' ';
    const after = at + key.length === q.length || q.charAt(at + key.length) === ' ';
    if (!before || !after) continue;
    const rest = (q.slice(0, at) + ' ' + q.slice(at + key.length)).replace(/\s+/g, ' ').trim();
    return { levelId: aliases[i].id, rest: rest };
  }
  return { levelId: null, rest: q };
}

function placeBlob(p) {
  return (p.name + ' ' + (p.building || '') + ' ' + (p.level_name || '') + ' ' + (p.level_id || '')).toLowerCase();
}

function capPlaces(list, floorId) {
  if (floorId) return list.slice(0, 16);
  const buckets = new Map();
  list.forEach((f) => {
    const key = (f.properties.building || '') + '|' + f.properties.level_id;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f);
  });
  const keys = Array.from(buckets.keys()).sort((a, b) => {
    const aa = buckets.get(a)[0].properties;
    const bb = buckets.get(b)[0].properties;
    const ac = aa.level_id === state.levelId ? 0 : 1;
    const bc = bb.level_id === state.levelId ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const rank = floorRank(aa.level_id) - floorRank(bb.level_id);
    if (rank) return rank;
    return (aa.building || '').localeCompare(bb.building || '');
  });
  const out = [];
  keys.forEach((key) => buckets.get(key).slice(0, 4).forEach((f) => out.push(f)));
  return out.slice(0, 24);
}

function routePlaces(query, floorId) {
  if (!collection) return [];
  const parsed = queryParts(query);
  const levelId = floorId || parsed.levelId;
  const rest = floorId && parsed.levelId && parsed.levelId !== floorId ? query.trim().toLowerCase() : parsed.rest;
  const places = collection.features.filter((f) => {
    const p = f.properties || {};
    if (p.feature_type !== 'unit' || p.category === 'corridor') return false;
    if (levelId && p.level_id !== levelId) return false;
    if (!rest) return true;
    return placeBlob(p).includes(rest);
  });
  places.sort((a, b) => {
    const ap = a.properties;
    const bp = b.properties;
    if (!levelId) {
      const af = ap.level_id === state.levelId ? 0 : 1;
      const bf = bp.level_id === state.levelId ? 0 : 1;
      if (af !== bf) return af - bf;
    }
    const rank = floorRank(ap.level_id) - floorRank(bp.level_id);
    if (rank) return rank;
    const building = (ap.building || '').localeCompare(bp.building || '');
    if (building) return building;
    const as = rest && (ap.name || '').toLowerCase().startsWith(rest) ? 0 : 1;
    const bs = rest && (bp.name || '').toLowerCase().startsWith(rest) ? 0 : 1;
    if (as !== bs) return as - bs;
    return (ap.name || '').localeCompare(bp.name || '');
  });
  return capPlaces(places, levelId);
}

let placeTimer = 0;
const searchFloor = { from: '', to: '' };

function hidePlaceResults() {
  window.clearTimeout(placeTimer);
  ['from-results', 'to-results'].forEach((id) => {
    const host = document.getElementById(id);
    host.hidden = true;
    host.innerHTML = '';
  });
}

function renderPlaceResults(which) {
  const input = document.getElementById(which === 'from' ? 'from-search' : 'to-search');
  const host = document.getElementById(which === 'from' ? 'from-results' : 'to-results');
  document.getElementById(which === 'from' ? 'to-results' : 'from-results').hidden = true;
  const floorId = searchFloor[which];
  const hits = routePlaces(input.value, floorId);
  host.innerHTML = '';
  host.hidden = false;
  const chips = document.createElement('div');
  chips.className = 'place-floors';
  const choices = [{ id: '', name: 'All' }].concat(floors.map((floor) => ({ id: floor.id, name: floor.name })));
  choices.forEach((floor) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'place-floor' + (floor.id === floorId ? ' active' : '');
    chip.textContent = floor.name;
    chip.addEventListener('mousedown', (event) => {
      event.preventDefault();
      searchFloor[which] = floor.id;
      renderPlaceResults(which);
    });
    chips.appendChild(chip);
  });
  host.appendChild(chips);
  if (!hits.length) {
    const empty = document.createElement('div');
    empty.className = 'place-empty';
    empty.textContent = floorId ? 'No places on this floor.' : 'No places match.';
    host.appendChild(empty);
    return;
  }
  let group = '';
  hits.forEach((f) => {
    const where = (f.properties.building || 'Building') + ' · ' + (f.properties.level_name || floorName(f.properties.level_id));
    if (where !== group) {
      group = where;
      const label = document.createElement('div');
      label.className = 'place-floor-label';
      label.textContent = where;
      host.appendChild(label);
    }
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'place-hit';
    row.innerHTML = '<strong>' + esc(f.properties.name) + '</strong>';
    row.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const ep = endpointFromFeature(f);
      setEndpoint(which, ep);
      hidePlaceResults();
      focusEndpoint(ep);
      if (which === 'from' && !state.endpoints.to) document.getElementById('to-search').focus();
    });
    host.appendChild(row);
  });
}

function bindPlaceSearch(which) {
  const input = document.getElementById(which === 'from' ? 'from-search' : 'to-search');
  input.addEventListener('focus', () => {
    window.clearTimeout(placeTimer);
    renderPlaceResults(which);
  });
  input.addEventListener('input', () => {
    if (!input.value.trim() && state.endpoints[which]) setEndpoint(which, null);
    renderPlaceResults(which);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hidePlaceResults();
      input.blur();
      return;
    }
    if (event.key !== 'Enter') return;
    const hit = document.querySelector('#' + (which === 'from' ? 'from-results' : 'to-results') + ' .place-hit');
    if (hit) hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    event.preventDefault();
  });
  input.addEventListener('blur', () => {
    const ep = state.endpoints[which];
    const typed = input.value;
    placeTimer = window.setTimeout(() => {
      hidePlaceResults();
      if (state.endpoints[which] === ep && input.value === typed) syncEndpointUi(which);
    }, 160);
  });
}

function syncEndpointUi(which) {
  const ep = state.endpoints[which];
  const input = document.getElementById(which === 'from' ? 'from-search' : 'to-search');
  const note = document.getElementById(which === 'from' ? 'from-note' : 'to-note');
  input.value = ep ? ep.name : '';
  note.textContent = ep ? [ep.building, ep.level_name].filter(Boolean).join(' · ') : '';
}

function setEndpoint(which, ep, opts) {
  state.endpoints[which] = ep;
  syncEndpointUi(which);
  updateStatus();
  if (!opts || !opts.skipRoute) maybeRoute();
}

function focusEndpoint(ep) {
  if (!ep || !ep.level_id || (state.endpoints.from && state.endpoints.to)) return;
  if (ep.level_id !== state.levelId) {
    state.levelId = ep.level_id;
    applyFilters();
    syncFloorUi();
    refreshLabels();
    updateStatus();
  }
  if (ep.focus) flyTo(ep.focus, null, ep.level_id);
}

function setTool(tool) {
  const next = state.tool === tool ? null : tool;
  state.tool = next;
  state.drawPhase = 0;
  if (!next && scene3d) scene3d.setDraft(null);
  document.querySelectorAll('[data-tool]').forEach((btn) => {
    const on = btn.dataset.tool === next;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  if (next === 'from') IndoorUI.toast('Click the start.');
  else if (next === 'to') IndoorUI.toast('Click the destination.');
  else if (next === 'draw') IndoorUI.toast('Click the start, then the destination.');
}

function routeRef(ep) {
  if (!ep) return null;
  if (ep.id != null) return ep.id;
  return { level_id: ep.level_id, level_name: ep.level_name, x: ep.x, y: ep.y, name: ep.name };
}

function maybeRoute() {
  if (state.endpoints.from && state.endpoints.to) calculate();
  else clearRoute();
}

function calculate() {
  const result = IndoorRoute.route(spatial, graph, collection, routeRef(state.endpoints.from), routeRef(state.endpoints.to), {
    vertical: state.vertical
  });
  if (result.error) {
    clearRoute();
    IndoorUI.toast(result.error);
    return;
  }
  showRoute(result);
}

function clearRoute() {
  playToken += 1;
  state.route = null;
  state.step = 0;
  hideRideCaption();
  stopDeviceTrack();
  if (scene3d) scene3d.clearRoute();
  if (map) map.stop();
  renderSteps();
  updateStatus();
}

let deviceWatch = null;
let deviceFix = null;
let deviceNoted = false;

function placeDevice() {
  if (!deviceFix || !state.route || !scene3d) return;
  scene3d.setUser(deviceFix.lngLat, levelElev(state.levelId), deviceFix.heading);
}

function startDeviceTrack() {
  if (deviceWatch != null) return;
  if (!navigator.geolocation) {
    IndoorUI.toast('This device has no location.');
    return;
  }
  if (!window.isSecureContext) {
    IndoorUI.toast('Location needs a secure page.');
    return;
  }
  deviceNoted = false;
  deviceWatch = navigator.geolocation.watchPosition((pos) => {
    if (!state.route) {
      stopDeviceTrack();
      return;
    }
    deviceFix = {
      lngLat: [pos.coords.longitude, pos.coords.latitude],
      heading: pos.coords.heading
    };
    placeDevice();
    if (!deviceNoted) {
      deviceNoted = true;
      IndoorUI.toast('Tracking this device.');
    }
  }, (err) => {
    stopDeviceTrack();
    IndoorUI.toast(err && err.code === 1 ? 'Location permission was denied.' : 'This device location is unavailable.');
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
}

function stopDeviceTrack() {
  if (deviceWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(deviceWatch);
  deviceWatch = null;
  deviceFix = null;
  if (scene3d) scene3d.setUser(null);
}

let rideCaptionTimer = 0;

function rideCaptionText(step) {
  const mode = step.mode === 'stair' ? 'Stairs' : step.mode === 'escalator' ? 'Escalator' : 'Elevator';
  return mode + ' to ' + (step.level_name || floorName(step.toLevel));
}

function showRideCaption(step) {
  const el = document.getElementById('ride-caption');
  document.getElementById('ride-caption-text').textContent = rideCaptionText(step);
  document.getElementById('ride-caption-swatch').style.background = '#' + floorGround(floorRank(step.toLevel)).toString(16).padStart(6, '0');
  window.clearTimeout(rideCaptionTimer);
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
}

function hideRideCaption(delay) {
  const el = document.getElementById('ride-caption');
  window.clearTimeout(rideCaptionTimer);
  const close = () => {
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
  };
  if (delay) rideCaptionTimer = window.setTimeout(close, delay);
  else close();
}

function buildPlan(result) {
  const legs = [];
  result.steps.forEach((step, index) => {
    if (step.kind === 'walk') {
      legs.push({
        kind: 'walk',
        level: step.level_id,
        elev: levelElev(step.level_id),
        pts: step.coordinates.map((c) => scene3d.toScene(c)),
        step: index
      });
    } else if (step.kind === 'transition') {
      legs.push({
        kind: 'ride',
        mode: step.mode,
        from: step.fromLevel,
        to: step.toLevel,
        fromElev: levelElev(step.fromLevel),
        toElev: levelElev(step.toLevel),
        xy: scene3d.toScene(step.toFocus || step.fromFocus),
        step: index
      });
    }
  });
  return {
    legs,
    arriveStep: result.steps.length - 1,
    start: { level: result.from.level_id, elev: levelElev(result.from.level_id), xy: scene3d.toScene(result.from.lonlat) },
    end: { level: result.to.level_id, elev: levelElev(result.to.level_id), xy: scene3d.toScene(result.to.lonlat) }
  };
}

function showRoute(result) {
  state.route = result;
  state.step = 0;
  scene3d.setDraft(null);
  scene3d.setRoute(buildPlan(result));
  state.levelId = result.from.level_id;
  applyFilters();
  syncFloorUi();
  refreshLabels();
  renderSteps();
  updateStatus();
  startPlayback();
  startDeviceTrack();
}

let routeStarted = 0;

function frameRoute(levelId, duration) {
  if (!state.route || !map) return;
  const lines = state.route.segments.filter((s) => s.level_id === levelId).map((s) => s.coordinates);
  const bounds = boundsOfLines(lines);
  if (!bounds) return;
  const bearing = state.is3d ? BEARING_3D : map.getBearing();
  const pitch = targetPitch();
  const elev = levelElev(levelId);
  const shifted = cameraCenter(bounds[0], elev, pitch, bearing);
  const dx = shifted[0] - bounds[0][0];
  const dy = shifted[1] - bounds[0][1];
  const camera = map.cameraForBounds(
    [[bounds[0][0] + dx, bounds[0][1] + dy], [bounds[1][0] + dx, bounds[1][1] + dy]],
    { padding: cameraPadding(), maxZoom: 19.8, bearing: bearing, pitch: pitch }
  );
  if (!camera) return;
  state._lastElev = elev;
  map.easeTo(Object.assign({}, camera, {
    duration: duration == null ? DRAW_MS : duration,
    essential: true,
    easing: (t) => 1 - Math.pow(1 - t, 3)
  }));
}

function startPlayback() {
  if (!state.route) return;
  playToken += 1;
  hideRideCaption();
  scene3d.reset();
  scene3d.play();
  if (state.levelId !== state.route.from.level_id) setFloor(state.route.from.level_id, false);
  state.follow = false;
  routeStarted = performance.now();
  if (reducedMotion()) {
    scene3d.finish();
    frameRoute(state.route.to.level_id, 0);
    return;
  }
  frameRoute(state.route.from.level_id, DRAW_MS);
}

function followCamera(info) {
  state._lastElev = info.elev;
  if (!state.follow) return;
  const target = cameraCenter(info.lngLat, info.elev, map.getPitch(), map.getBearing());
  const c = map.getCenter();
  const k = 0.14;
  map.jumpTo({ center: [c.lng + (target[0] - c.lng) * k, c.lat + (target[1] - c.lat) * k] });
}

function renderSteps() {
  const host = document.getElementById('route-steps');
  const empty = document.getElementById('route-empty');
  const summary = document.getElementById('route-summary');
  host.innerHTML = '';
  if (!state.route) {
    summary.textContent = '';
    empty.hidden = false;
    document.getElementById('btn-replay').disabled = true;
    return;
  }
  empty.hidden = true;
  document.getElementById('btn-replay').disabled = false;
  summary.textContent = Math.round(state.route.walkMeters) + ' m · ' + state.route.from.name + ' to ' + state.route.to.name;
  state.route.steps.forEach((step, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'step-btn' + (index === state.step ? ' active' : '');
    const detail = step.detail ? '<span class="step-k">' + esc(step.detail) + '</span>' : '';
    btn.innerHTML = '<span class="step-arrow" aria-hidden="true">' + stepIcon(step.action) + '</span>'
      + '<span class="choice-copy"><strong>' + esc(step.text) + '</strong>' + detail + '</span>';
    btn.addEventListener('click', () => goToStep(index));
    host.appendChild(btn);
  });
}

function stepIcon(action) {
  const up = '<path d="M11 20.2V9.1L7.2 12.6 5.8 11.1 12 4.2l6.2 6.9-1.4 1.5L13 9.1v11.1H11z"/>';
  const icons = {
    depart: up,
    straight: up,
    outside: up,
    left: '<path d="M14.2 20.2V13c0-.9-.2-1.3-1.1-1.3H8.6l2.2 2.5-1.5 1.3L4.4 10.6 9.3 5.7l1.5 1.3-2.2 2.5h4.7c2.2 0 3.4 1.1 3.4 3.3v7.4h-2.5z"/>',
    right: '<path d="M9.8 20.2V13c0-.9.2-1.3 1.1-1.3h4.5l-2.2 2.5 1.5 1.3 4.9-4.9-4.9-4.9-1.5 1.3 2.2 2.5H10.7c-2.2 0-3.4 1.1-3.4 3.3v7.4h2.5z"/>',
    'slight-left': '<path d="M11.2 20.2V11L7.4 14l-1.3-1.6 6.2-5.2 5.4 6.4-1.6 1.3-2.4-2.8v8.1h-2.5z"/>',
    'slight-right': '<path d="M12.8 20.2V11l3.8 3 1.3-1.6-6.2-5.2-5.4 6.4 1.6 1.3 2.4-2.8v8.1h2.5z"/>',
    'sharp-left': '<path d="M18.2 14.2h-7.4V8.6l2.4 2.2-1.4 1.5L6.2 6.8l5.6-5.5 1.4 1.5-2.4 2.2v4.2h7.4v5z"/>',
    'sharp-right': '<path d="M5.8 14.2h7.4V8.6L10.8 10.8l1.4 1.5 5.6-5.5-5.6-5.5-1.4 1.5 2.4 2.2v4.2H5.8v5z"/>',
    uturn: '<path d="M8.2 20.2V11c0-2.6 1.8-4.4 4.6-4.4 2.5 0 4.2 1.5 4.2 3.8h-2.4c0-1-.7-1.6-1.8-1.6-1.3 0-2.1.8-2.1 2.2v9.2H8.2zm6.2-6.2 3.8-3.4-3.8-3.4v2.2h-1.2v2.4h1.2v2.2z"/>',
    elevator: '<path d="M7 3.5h10v17H7v-17zm2.2 2.2v12.6h5.6V5.7H9.2zm1.2 2.1 1.6-1.8 1.6 1.8h-3.2zm0 6.4h3.2l-1.6 1.8-1.6-1.8z"/>',
    escalator: '<path d="M3.5 18.5h5.2l3.2-4.2h3.6l3.4-4.6H21v2.2h-1.2l-3.2 4.4h-3.8l-3.2 4.2H3.5v-2zm11.2-8.8 1.5-1.6 2.2 2.1-1.5 1.6-2.2-2.1z"/>',
    stair: '<path d="M4 19.5h5.2v-4.2h4.2V11h4.6V6.8H20V4.6h-4.2v4.2h-4.2v4.3H7V17.3H4v2.2z"/>',
    arrive: '<path d="M6.5 20.5V4.2h1.8v2.2h8.2l-1.6 3.3 1.6 3.3H8.3v7.5H6.5z"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="currentColor">' + (icons[action] || up) + '</svg>';
}

function highlightStep(index) {
  state.step = index;
  document.querySelectorAll('#route-steps .step-btn').forEach((btn, i) => {
    const on = i === index;
    btn.classList.toggle('active', on);
    if (on) btn.scrollIntoView({ block: 'nearest' });
  });
}

function goToStep(index) {
  const step = state.route && state.route.steps[index];
  if (!step) return;
  if (scene3d.isPlaying()) scene3d.pause();
  hideRideCaption();
  state.follow = false;
  highlightStep(index);
  if (step.level_id && step.level_id !== state.levelId) {
    state.levelId = step.level_id;
    applyFilters();
    syncFloorUi();
    refreshLabels();
  }
  updateStatus();
  if (step.focus) flyTo(step.focus, Math.max(map.getZoom(), 19.8), step.level_id);
}

function updateStatus() {
  document.getElementById('stat-floor').textContent = floorName(state.levelId);
  const selected = featureById(state.selectedId);
  document.getElementById('stat-place').textContent = selected ? selected.properties.name : '—';
  if (!state.route) {
    document.getElementById('stat-route').textContent = '—';
    return;
  }
  const modes = new Set(state.route.steps.filter((s) => s.kind === 'transition').map((s) => s.mode));
  const viaNames = ['escalator', 'elevator', 'stair'].filter((mode) => modes.has(mode));
  const via = viaNames.length ? ' · ' + viaNames.join(' and ') : '';
  document.getElementById('stat-route').textContent = Math.round(state.route.walkMeters) + ' m' + via;
}

function syncTools() {
  document.querySelectorAll('[data-dock]').forEach((btn) => {
    const on = state.dockOpen && state.dock === btn.dataset.dock;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  });
}

function openDock(name, keepOpen) {
  const dock = document.getElementById('dock');
  if (state.dockOpen && state.dock === name && !keepOpen) {
    closeDock();
    return;
  }
  state.dockOpen = true;
  state.dock = name;
  dock.classList.add('open');
  document.getElementById('dock-title').textContent = DOCK_TITLES[name] || 'Indoor';
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === 'panel-' + name);
  });
  syncTools();
  syncGlass();
}

function closeDock() {
  state.dockOpen = false;
  setTool(null);
  document.getElementById('dock').classList.remove('open');
  syncTools();
}

function setTiltControls(on) {
  if (on) {
    map.dragRotate.enable();
    map.touchPitch.enable();
    map.touchZoomRotate.enableRotation();
    if (map.keyboard && map.keyboard.enableRotation) map.keyboard.enableRotation();
  } else {
    map.dragRotate.disable();
    map.touchPitch.disable();
    map.touchZoomRotate.disableRotation();
    if (map.keyboard && map.keyboard.disableRotation) map.keyboard.disableRotation();
  }
}

function easeFlat() {
  const elev = levelElev(state.levelId);
  const center = map.getCenter();
  const ground = cameraCenter([center.lng, center.lat], -(state._lastElev == null ? elev : state._lastElev), map.getPitch(), map.getBearing());
  state._lastElev = elev;
  map.easeTo({
    center: cameraCenter(ground, elev, 0, 0),
    pitch: 0,
    bearing: 0,
    duration: motion(800)
  });
}

function set3d(on) {
  state.is3d = on;
  pitchToken += 1;
  const token = pitchToken;
  const btn = document.getElementById('btn-3d');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  setTiltControls(on);
  if (scene3d) scene3d.setSolid(on);
  if (on) {
    showExtrudedBuildings();
    settleThenPitch(token);
    return;
  }
  showFlatBuildings();
  if (map.getTerrain()) map.setTerrain(null);
  map.setCenterClampedToGround(true);
  if (scene3d) seatBuilding();
  easeFlat();
}

function schematicUrl(feature) {
  if (panoCache.has(feature.id)) return panoCache.get(feature.id);
  const cat = categoryMeta(feature.properties.category);
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const g = canvas.getContext('2d');
  g.fillStyle = '#F4F7FA';
  g.fillRect(0, 0, 2048, 390);
  g.fillStyle = cat.fill;
  g.fillRect(0, 390, 2048, 250);
  g.fillStyle = '#D7DEE8';
  g.fillRect(0, 640, 2048, 384);
  const windows = feature.properties.category === 'hall' ? 6 : 4;
  const gap = 2048 / windows;
  for (let i = 0; i < windows; i++) {
    const x = gap * i + gap * 0.28;
    g.fillStyle = '#FFFFFF';
    g.fillRect(x, 430, gap * 0.28, 120);
    g.fillStyle = cat.line;
    g.fillRect(x, 430, gap * 0.28, 8);
  }
  g.fillStyle = '#1B2A4A';
  g.fillRect(160, 430, 86, 180);
  g.font = '600 64px "Noto Sans", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText(feature.properties.name || '', 1120, 530);
  g.font = '500 32px "Noto Sans", "Segoe UI", sans-serif';
  g.fillStyle = '#2F4A6D';
  g.fillText(feature.properties.level_name || '', 1120, 590);
  const url = canvas.toDataURL('image/jpeg', 0.86);
  panoCache.set(feature.id, url);
  return url;
}

function openPano(feature) {
  if (!hasPano(feature)) {
    IndoorUI.toast('No 360 image for this place.');
    return;
  }
  document.getElementById('pano-modal').classList.add('open');
  const src = feature.properties.image || schematicUrl(feature);
  requestAnimationFrame(() => {
    if (state.viewer) {
      state.viewer.destroy();
      state.viewer = null;
    }
    state.viewer = pannellum.viewer('pano-view', {
      type: 'equirectangular',
      panorama: src,
      autoLoad: true,
      compass: false,
      hfov: 90,
      minHfov: 30,
      maxHfov: 110,
      minPitch: -80,
      maxPitch: 80,
      pitch: 0,
      showControls: false,
      showZoomCtrl: false,
      showFullscreenCtrl: false,
      mouseZoom: true,
      doubleClickZoom: true,
      draggable: true,
      friction: 0.08,
      backgroundColor: [20, 32, 56]
    });
    state.viewer.resize();
  });
}

function closePano() {
  document.getElementById('pano-modal').classList.remove('open');
  if (state.viewer) {
    state.viewer.destroy();
    state.viewer = null;
  }
}

function panoPlaces(levelId) {
  return collection.features.filter((f) => f.properties.feature_type === 'unit' && hasPano(f) && (!levelId || f.properties.level_id === levelId));
}

function renderPanoMenu() {
  const host = document.getElementById('pano-list');
  host.innerHTML = '';
  const onFloor = panoPlaces(state.levelId);
  const list = onFloor.length ? onFloor : panoPlaces(null);
  if (!list.length) {
    host.innerHTML = '<div class="muted" style="padding:12px;">No 360 images in this plan.</div>';
    return;
  }
  list.forEach((f) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'flyout-item' + (String(f.id) === String(state.selectedId) ? ' active' : '');
    row.innerHTML = '<span>' + esc(f.properties.name) + '</span><span class="hit-kind">' + esc((f.properties.building ? f.properties.building + ' · ' : '') + (f.properties.level_name || '')) + '</span>';
    row.addEventListener('click', () => {
      IndoorUI.closeFlyouts();
      selectFeature(f, true);
      openPano(f);
    });
    host.appendChild(row);
  });
}

function readGeoJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const fc = JSON.parse(reader.result);
      if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
        IndoorUI.toast('That file is not a GeoJSON FeatureCollection.');
        return;
      }
      loadCollection(fc, true);
      document.getElementById('data-file-name').textContent = file.name;
      IndoorUI.toast('Loaded ' + (fc.name || file.name));
      IndoorUI.closeFlyouts();
    } catch (err) {
      IndoorUI.toast('Could not read that GeoJSON file.');
    }
  };
  reader.readAsText(file);
}

function onSearch(query) {
  const host = document.getElementById('search-results');
  host.innerHTML = '';
  const q = query.trim().toLowerCase();
  if (!q || !collection) return;
  const hits = collection.features.filter((f) => {
    if (f.properties.feature_type !== 'unit') return false;
    const blob = (f.properties.name + ' ' + f.properties.category + ' ' + (f.properties.level_name || '') + ' ' + (f.properties.building || '')).toLowerCase();
    return blob.includes(q);
  }).slice(0, 8);
  if (!hits.length) {
    host.innerHTML = '<div class="muted" style="padding:8px;">No places match.</div>';
    return;
  }
  hits.forEach((f) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'flyout-item';
    const where = (f.properties.building || 'Building') + ' · ' + (f.properties.level_name || '');
    row.innerHTML = '<span>' + esc(f.properties.name) + '</span><span class="hit-kind">' + esc(where) + '</span>';
    row.addEventListener('click', () => {
      selectFeature(f, true);
      IndoorUI.closeFlyouts();
    });
    host.appendChild(row);
  });
}

function setHover(id) {
  if (String(id) === String(state.hoverId)) return;
  state.hoverId = id;
  if (scene3d) scene3d.setUnitTone(state.selectedId, state.hoverId);
}

function bindMap() {
  map.on('click', (event) => {
    IndoorUI.closeFlyouts();
    hidePlaceResults();
    if (!collection) return;
    if (state.tool) {
      const ep = endpointFromEvent(event);
      if (!ep) {
        IndoorUI.toast('Click a place on this floor.');
        return;
      }
      if (state.tool === 'from') {
        setEndpoint('from', ep);
        setTool(null);
        focusEndpoint(ep);
        return;
      }
      if (state.tool === 'to') {
        setEndpoint('to', ep);
        setTool(null);
        focusEndpoint(ep);
        return;
      }
      if (!state.drawPhase) {
        setEndpoint('to', null, { skipRoute: true });
        setEndpoint('from', ep, { skipRoute: true });
        clearRoute();
        scene3d.setDraft({ level: ep.level_id, xy: scene3d.toScene(ep.focus), elev: levelElev(ep.level_id) });
        state.drawPhase = 1;
        IndoorUI.toast('Click the destination.');
        focusEndpoint(ep);
        return;
      }
      setEndpoint('to', ep);
      state.drawPhase = 0;
      setTool(null);
      return;
    }
    const hit = unitAt(floorPoint(event), false);
    if (hit) selectFeature(hit, true);
  });

  map.on('mousemove', (event) => {
    if (!collection || !layersReady) return;
    const lonlat = floorPoint(event);
    const meters = spatial.toMeters(lonlat[0], lonlat[1]);
    document.getElementById('stat-coords').textContent = meters[0].toFixed(1) + ' m, ' + meters[1].toFixed(1) + ' m';
    const hit = unitAt(lonlat, false);
    const id = hit ? hit.id : null;
    map.getCanvas().style.cursor = state.tool ? 'crosshair' : (id != null ? 'pointer' : '');
    setHover(id);
  });

  map.on('mouseout', () => {
    if (layersReady) setHover(null);
  });

  map.on('dragstart', () => {
    if (scene3d.isPlaying()) state.follow = false;
  });

  map.on('zoom', () => {
    document.getElementById('stat-zoom').textContent = map.getZoom().toFixed(1);
  });
  map.on('zoomend', refreshLabels);
}

function bindChrome() {
  document.querySelectorAll('[data-dock]').forEach((btn) => {
    btn.addEventListener('click', () => openDock(btn.dataset.dock));
  });
  document.getElementById('btn-close-dock').addEventListener('click', closeDock);
  document.getElementById('btn-legend').addEventListener('click', () => {
    const legend = document.getElementById('map-legend');
    const open = !legend.classList.contains('open');
    legend.classList.toggle('open', open);
    document.getElementById('btn-legend').classList.toggle('active', open);
    document.getElementById('btn-legend').setAttribute('aria-pressed', open ? 'true' : 'false');
  });
  document.getElementById('btn-search').addEventListener('click', () => IndoorUI.setFlyoutOpen('search-menu'));
  document.getElementById('btn-data').addEventListener('click', () => IndoorUI.setFlyoutOpen('data-menu'));
  document.getElementById('btn-pano').addEventListener('click', () => {
    closePano();
    renderPanoMenu();
    IndoorUI.setFlyoutOpen('pano-menu');
  });
  document.getElementById('btn-home').addEventListener('click', () => fitFloor(true));
  document.getElementById('btn-3d').addEventListener('click', () => set3d(!state.is3d));
  document.getElementById('btn-basemap').addEventListener('click', () => {
    renderBasemaps();
    IndoorUI.setFlyoutOpen('basemap-menu');
  });
  document.getElementById('btn-zoom-in').addEventListener('click', () => map.zoomIn({ duration: motion(250) }));
  document.getElementById('btn-zoom-out').addEventListener('click', () => map.zoomOut({ duration: motion(250) }));
  document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.getElementById('app').requestFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    document.getElementById('btn-fullscreen').classList.toggle('active', on);
    document.getElementById('btn-fullscreen').setAttribute('aria-pressed', on ? 'true' : 'false');
    setTimeout(() => map.resize(), 60);
  });
  document.getElementById('btn-scale').addEventListener('click', () => {
    const off = document.body.classList.toggle('scale-off');
    document.getElementById('btn-scale').classList.toggle('active', !off);
    document.getElementById('btn-scale').setAttribute('aria-pressed', off ? 'false' : 'true');
  });
  document.getElementById('btn-theme').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'glass' ? 'light' : 'glass';
    IndoorUI.applyTheme(next);
  });
  document.getElementById('btn-close-detail').addEventListener('click', closeDetail);
  document.getElementById('btn-pano-back').addEventListener('click', () => {
    closePano();
    renderPanoMenu();
    IndoorUI.setFlyoutOpen('pano-menu', true);
  });
  document.getElementById('btn-pano-clear').addEventListener('click', closePano);
  document.getElementById('search-input').addEventListener('input', (event) => onSearch(event.target.value));
  bindPlaceSearch('from');
  bindPlaceSearch('to');
  document.querySelectorAll('[data-vertical]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.vertical = btn.dataset.vertical;
      document.querySelectorAll('[data-vertical]').forEach((item) => {
        const on = item === btn;
        item.classList.toggle('active', on);
        item.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (state.endpoints.from && state.endpoints.to) calculate();
    });
  });
  document.getElementById('btn-route').addEventListener('click', () => {
    if (!state.endpoints.from || !state.endpoints.to) {
      IndoorUI.toast('Choose a start and a destination.');
      return;
    }
    calculate();
  });
  document.getElementById('btn-swap').addEventListener('click', () => {
    const from = state.endpoints.from;
    state.endpoints.from = state.endpoints.to;
    state.endpoints.to = from;
    syncEndpointUi('from');
    syncEndpointUi('to');
    maybeRoute();
  });
  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });
  document.getElementById('btn-replay').addEventListener('click', () => {
    if (!state.route) {
      IndoorUI.toast('Get directions first.');
      return;
    }
    startPlayback();
  });
  document.getElementById('btn-clear-route').addEventListener('click', () => {
    setTool(null);
    setEndpoint('from', null, { skipRoute: true });
    setEndpoint('to', null, { skipRoute: true });
    clearRoute();
  });

  document.getElementById('data-file').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) readGeoJSONFile(file);
    event.target.value = '';
  });

  const wrap = document.getElementById('map-wrap');
  wrap.addEventListener('dragover', (event) => {
    if ([].some.call(event.dataTransfer.types, (type) => type === 'Files')) event.preventDefault();
  });
  wrap.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    event.preventDefault();
    readGeoJSONFile(file);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.getElementById('pano-modal').classList.contains('open')) {
      event.preventDefault();
      closePano();
      return;
    }
    if (document.querySelector('.flyout.open')) {
      IndoorUI.closeFlyouts();
      return;
    }
    if (document.getElementById('detail-panel').classList.contains('open')) {
      closeDetail();
      return;
    }
    if (state.dockOpen) closeDock();
  });

  window.addEventListener('resize', () => {
    IndoorUI.FLYOUTS.forEach((f) => {
      const menu = document.getElementById(f.menu);
      const btn = document.getElementById(f.btn);
      if (menu && menu.classList.contains('open')) IndoorUI.positionFlyout(menu, btn);
    });
  });
}

function rasterStyle(id, tiles, attribution, overlay) {
  const sources = {
    [id]: { type: 'raster', tiles: tiles, tileSize: 256, attribution: attribution }
  };
  const layers = [{ id: id, type: 'raster', source: id }];
  if (overlay) {
    sources.places = { type: 'raster', tiles: overlay.tiles, tileSize: 256, attribution: overlay.attribution };
    layers.push({ id: 'places', type: 'raster', source: 'places' });
  }
  return { version: 8, sources: sources, layers: layers };
}

const ESRI = 'Esri, Maxar, Earthstar Geographics, and the GIS User Community';

const BASEMAPS = [
  { id: 'positron', name: 'Light', style: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'bright', name: 'Bright', style: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'liberty', name: 'Liberty', style: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'dark', name: 'Dark', style: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'fiord', name: 'Fiord', style: 'https://tiles.openfreemap.org/styles/fiord' },
  { id: 'streets', name: 'Streets', style: rasterStyle('streets', ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'], 'Esri, HERE, Garmin, OpenStreetMap') },
  { id: 'topo', name: 'Topographic', style: rasterStyle('topo', ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'], 'Esri, HERE, Garmin, USGS, NGA, EPA, USDA') },
  { id: 'gray', name: 'Gray', style: rasterStyle('gray', ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'], 'Esri, HERE, Garmin') },
  { id: 'night', name: 'Night', style: rasterStyle('night', ['https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png'], 'CARTO, OpenStreetMap') },
  { id: 'osm', name: 'OpenStreetMap', style: rasterStyle('osm', ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], 'OpenStreetMap') },
  { id: 'satellite', name: 'Satellite', style: rasterStyle('satellite', ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], ESRI) },
  { id: 'hybrid', name: 'Hybrid', style: rasterStyle('satellite', ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], ESRI, { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], attribution: 'Esri' }) }
];

let basemapId = 'positron';
let styleToken = 0;
let pitchToken = 0;

function renderBasemaps() {
  const host = document.getElementById('basemap-menu');
  host.innerHTML = '';
  BASEMAPS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flyout-item' + (item.id === basemapId ? ' active' : '');
    btn.textContent = item.name;
    btn.addEventListener('click', () => {
      IndoorUI.closeFlyouts();
      useBasemap(item.id);
    });
    host.appendChild(btn);
  });
}

function numberize(expr) {
  if (!Array.isArray(expr)) return expr;
  const op = expr[0];
  const args = expr.slice(1).map(numberize);
  if (op === '<' || op === '>' || op === '<=' || op === '>=') {
    return [op].concat(args.map((arg) => {
      if (typeof arg === 'number') return arg;
      if (Array.isArray(arg) && (arg[0] === 'get' || arg[0] === 'to-number' || arg[0] === 'length')) {
        return ['to-number', arg, 0];
      }
      return arg;
    }));
  }
  return [op].concat(args);
}

function sanitizeStyle(style) {
  const copy = JSON.parse(JSON.stringify(style));
  (copy.layers || []).forEach((layer) => {
    if (layer.filter) layer.filter = numberize(layer.filter);
    ['paint', 'layout'].forEach((key) => {
      if (!layer[key]) return;
      Object.keys(layer[key]).forEach((prop) => {
        if (Array.isArray(layer[key][prop])) layer[key][prop] = numberize(layer[key][prop]);
      });
    });
  });
  return copy;
}

function prepareStyle(style) {
  if (style && typeof style === 'object') return Promise.resolve(sanitizeStyle(style));
  return fetch(style).then((res) => {
    if (!res.ok) throw new Error('basemap');
    return res.json();
  }).then(sanitizeStyle);
}

function attachIndoor(token) {
  if (token != null && token !== styleToken) return;
  map.setProjection({ type: 'globe' });
  if (state.is3d) showExtrudedBuildings();
  ensureLayers();
  if (!collection) return;
  scene3d.setShell(shellParts());
  scene3d.setSite(siteFeatures());
  scene3d.setPathways(pathwayLines());
  scene3d.setNetwork(networkLines());
  scene3d.setSolid(state.is3d);
  applyFilters();
  refreshLabels();
}

function useBasemap(id) {
  const item = BASEMAPS.find((entry) => entry.id === id);
  if (!item || item.id === basemapId) return;
  const previous = basemapId;
  basemapId = item.id;
  const token = ++styleToken;
  prepareStyle(item.style).then((style) => {
    if (token !== styleToken) return;
    layersReady = false;
    map.setStyle(style, { diff: false });
    map.once('style.load', () => setTimeout(() => attachIndoor(token), 0));
  }).catch(() => {
    if (token !== styleToken) return;
    basemapId = previous;
    IndoorUI.toast('That basemap could not be loaded.');
  });
}

function showFlatBuildings() {
  if (map.getLayer('building-3d')) map.setLayoutProperty('building-3d', 'visibility', 'none');
  if (map.getLayer('building-flat')) map.setLayoutProperty('building-flat', 'visibility', 'visible');
  else if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'visible');
}

function showExtrudedBuildings() {
  map.setProjection({ type: 'globe' });
  if (!map.getSource('terrain-dem')) {
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 15,
      attribution: 'Terrain: AWS Terrain Tiles'
    });
  }
  map.setTerrain({ source: 'terrain-dem', exaggeration: 1 });
  if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none');
  if (map.getLayer('building-flat')) map.setLayoutProperty('building-flat', 'visibility', 'none');
  if (map.getSource('openmaptiles') && !map.getLayer('building-3d')) {
    map.addLayer({
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': '#EAEAE5',
        'fill-extrusion-height': ['max', ['to-number', ['get', 'render_height'], 0], 3],
        'fill-extrusion-base': ['max', ['to-number', ['get', 'render_min_height'], 0], 0],
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-vertical-gradient': false
      }
    });
  } else if (map.getLayer('building-3d')) {
    map.setLayoutProperty('building-3d', 'visibility', 'visible');
  }
}

function settleThenPitch(token) {
  const origin = spatial ? [spatial.origin.lon, spatial.origin.lat] : null;
  let pitched = false;
  let previous = null;
  let terrainReady = false;
  const finish = () => {
    if (pitched || token !== pitchToken || !state.is3d) return;
    pitched = true;
    map.off('idle', onIdle);
    map.off('sourcedata', onSource);
    clearTimeout(giveUp);
    if (origin) {
      let height = null;
      try { height = map.queryTerrainElevation(origin); } catch (err) { height = null; }
      if (height != null && isFinite(height)) {
        state.ground = height;
        scene3d.setOrigin(origin, height);
        seatBuilding();
      }
    }
    const elev = levelElev(state.levelId);
    const center = map.getCenter();
    const ground = cameraCenter([center.lng, center.lat], -(state._lastElev == null ? 0 : state._lastElev), map.getPitch(), map.getBearing());
    state._lastElev = elev;
    map.easeTo({
      center: cameraCenter(ground, elev, PITCH_3D, BEARING_3D),
      pitch: PITCH_3D,
      bearing: BEARING_3D,
      duration: motion(800)
    });
    map.once('moveend', () => {
      if (token === pitchToken && state.is3d) map.setCenterClampedToGround(false);
    });
  };
  const onSource = (event) => {
    if (event.sourceId === 'terrain-dem' && event.isSourceLoaded) terrainReady = true;
  };
  const onIdle = () => {
    if (!terrainReady || !origin) return;
    let height = null;
    try { height = map.queryTerrainElevation(origin); } catch (err) { return; }
    if (height == null || !isFinite(height)) return;
    if (previous != null && Math.abs(height - previous) < 0.5) finish();
    previous = height;
  };
  if (map.getSource('terrain-dem') && map.isSourceLoaded('terrain-dem')) terrainReady = true;
  map.on('sourcedata', onSource);
  map.on('idle', onIdle);
  const giveUp = setTimeout(finish, 3000);
}

function cameraLog(label) {
  const center = map.getCenter();
  let elevation = null;
  try { elevation = map.getCenterElevation(); } catch (err) { elevation = null; }
  console.log(label, {
    lng: +center.lng.toFixed(6),
    lat: +center.lat.toFixed(6),
    zoom: +map.getZoom().toFixed(2),
    pitch: +map.getPitch().toFixed(1),
    elevation
  });
}

function frameBuilding() {
  if (!spatial) return;
  cameraLog('frame start');
  fitFloor(true);
  map.once('moveend', () => cameraLog('frame end'));
}

function syncGround() {
  if (!spatial || typeof map.queryTerrainElevation !== 'function') return;
  let height = null;
  try {
    height = map.queryTerrainElevation([spatial.origin.lon, spatial.origin.lat]);
  } catch (err) {
    return;
  }
  if (height == null || !isFinite(height) || Math.abs(height - state.ground) < 0.25) return;
  state.ground = height;
  scene3d.setOrigin([spatial.origin.lon, spatial.origin.lat], height);
  seatBuilding();
}

function boot() {
  IndoorUI.bootTheme();
  prepareStyle(BASEMAPS[0].style).catch(() => BASEMAPS[0].style).then(startMap);
}

function startMap(style) {
  map = new maplibregl.Map({
    container: 'viewDiv',
    style: style,
    center: [31.4048344, 31.0570927],
    zoom: 18,
    pitch: 0,
    bearing: 0,
    minZoom: 0,
    maxPitch: 70,
    dragRotate: { around: 'pointer' },
    touchZoomRotate: { around: 'pointer' },
    touchPitch: { around: 'pointer' },
    attributionControl: { compact: true },
    fadeDuration: 0,
    boxZoom: false,
    canvasContextAttributes: { antialias: true }
  });
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');
  setTiltControls(false);

  scene3d = createScene3D(map, {
    labelHost: document.getElementById('label-layer'),
    onLevel: (levelId) => {
      setFloor(levelId, false);
      if (!scene3d.isPlaying() || reducedMotion()) return;
      const left = Math.max(900, DRAW_MS - (performance.now() - routeStarted));
      frameRoute(levelId, left);
    },
    onStep: (index) => {
      highlightStep(index);
      const step = state.route && state.route.steps[index];
      if (step && step.kind === 'transition' && scene3d.isPlaying() && !reducedMotion()) showRideCaption(step);
      else hideRideCaption(900);
    },
    onMove: followCamera,
    onDone: (info) => {
      hideRideCaption();
      if (!info.skipped && state.route) IndoorUI.toast('Arrived at ' + state.route.to.name);
    }
  });

  bindChrome();
  bindMap();

  map.on('style.load', () => map.setProjection({ type: 'globe' }));
  map.on('idle', syncGround);
  const ready = new Promise((resolve) => map.on('load', () => resolve()));
  const data = fetch('data/indoor.geojson').then((res) => {
    if (!res.ok) throw new Error('missing');
    return res.json();
  });
  Promise.all([ready, data]).then((pair) => {
    loadCollection(pair[1], false);
    frameBuilding();
  }).catch((err) => {
    console.error(err);
    showLoaderError('Could not load the indoor plan.');
  });
}

boot();
