'use strict';

(function (root) {
  var SNAP_M = 0.5;
  var UNIT_SNAP_M = 20;
  var LINK_M = 8;

  function spatial(fc) {
    var origin = fc && fc.origin;
    if (!origin || typeof origin.lon !== 'number' || typeof origin.lat !== 'number') {
      var c = firstCoordinate(fc) || [0, 0];
      origin = { lon: c[0], lat: c[1] };
    }
    var latScale = 110540;
    var lonScale = 111320 * Math.cos((origin.lat * Math.PI) / 180);
    return {
      origin: origin,
      latScale: latScale,
      lonScale: lonScale,
      toMeters: function (lon, lat) {
        return [(lon - origin.lon) * lonScale, (lat - origin.lat) * latScale];
      },
      toLonLat: function (x, y) {
        return [origin.lon + x / lonScale, origin.lat + y / latScale];
      }
    };
  }

  function firstCoordinate(fc) {
    var features = (fc && fc.features) || [];
    for (var i = 0; i < features.length; i++) {
      var found = dig(features[i].geometry);
      if (found) return found;
    }
    return null;
  }

  function dig(geometry) {
    if (!geometry) return null;
    var coords = geometry.coordinates;
    if (!coords) return null;
    if (typeof coords[0] === 'number') return coords;
    return dig({ coordinates: coords[0] });
  }

  function polygonsOf(feature) {
    var g = feature.geometry;
    if (!g) return [];
    if (g.type === 'Polygon') return [g.coordinates[0]];
    if (g.type === 'MultiPolygon') return g.coordinates.map(function (p) { return p[0]; });
    return [];
  }

  function linesOf(feature) {
    var g = feature.geometry;
    if (!g) return [];
    if (g.type === 'LineString') return [g.coordinates];
    if (g.type === 'MultiLineString') return g.coordinates;
    return [];
  }

  function pointOf(feature) {
    var g = feature.geometry;
    if (g && g.type === 'Point') return g.coordinates;
    return null;
  }

  function ringMetrics(spatialObj, ring) {
    var area2 = 0;
    var cx = 0;
    var cy = 0;
    var meters = [];
    for (var i = 0; i < ring.length; i++) meters.push(spatialObj.toMeters(ring[i][0], ring[i][1]));
    var n = meters.length;
    if (n > 1 && meters[0][0] === meters[n - 1][0] && meters[0][1] === meters[n - 1][1]) n -= 1;
    for (var j = 0; j < n; j++) {
      var a = meters[j];
      var b = meters[(j + 1) % n];
      var cross = a[0] * b[1] - b[0] * a[1];
      area2 += cross;
      cx += (a[0] + b[0]) * cross;
      cy += (a[1] + b[1]) * cross;
    }
    var area = area2 / 2;
    if (Math.abs(area) < 1e-6) {
      return { area: 0, anchor: meters[0] || [0, 0] };
    }
    return { area: Math.abs(area), anchor: [cx / (6 * area), cy / (6 * area)] };
  }

  function describe(spatialObj, feature) {
    var rings = polygonsOf(feature);
    var area = 0;
    var best = null;
    rings.forEach(function (ring) {
      var m = ringMetrics(spatialObj, ring);
      area += m.area;
      if (!best || m.area > best.area) best = m;
    });
    var centroid = best ? best.anchor : [0, 0];
    if (!best && pointOf(feature)) centroid = spatialObj.toMeters(pointOf(feature)[0], pointOf(feature)[1]);
    return {
      area: area,
      centroidMeters: centroid,
      centroidLonLat: spatialObj.toLonLat(centroid[0], centroid[1]),
      anchorMeters: anchorMeters(spatialObj, feature)
    };
  }

  function anchorMeters(spatialObj, feature) {
    var a = feature.properties && feature.properties.anchor;
    if (Array.isArray(a) && a.length >= 2 && isFinite(a[0]) && isFinite(a[1])) return [Number(a[0]), Number(a[1])];
    return describeCentroid(spatialObj, feature);
  }

  function describeCentroid(spatialObj, feature) {
    var rings = polygonsOf(feature);
    if (!rings.length) {
      var pt = pointOf(feature);
      if (pt) return spatialObj.toMeters(pt[0], pt[1]);
      var lines = linesOf(feature);
      if (lines.length && lines[0].length) return spatialObj.toMeters(lines[0][0][0], lines[0][0][1]);
      return [0, 0];
    }
    var best = null;
    rings.forEach(function (ring) {
      var m = ringMetrics(spatialObj, ring);
      if (!best || m.area > best.area) best = m;
    });
    return best.anchor;
  }

  function nodeKey(levelId, x, y) {
    return levelId + '|' + (Math.round(x / SNAP_M) * SNAP_M) + '|' + (Math.round(y / SNAP_M) * SNAP_M);
  }

  function levelMeta(fc) {
    var ordinal = new Map();
    var name = new Map();
    (fc.features || []).forEach(function (f) {
      var p = f.properties || {};
      if (!p.level_id) return;
      if (!name.has(p.level_id) && (p.level_name || (p.feature_type === 'level' && p.name))) {
        name.set(p.level_id, p.level_name || p.name);
      }
      if (p.ordinal != null && !ordinal.has(p.level_id)) ordinal.set(p.level_id, Number(p.ordinal));
    });
    return { ordinal: ordinal, name: name };
  }

  function buildGraph(spatialObj, fc) {
    var meta = levelMeta(fc);
    var nodes = new Map();
    var adj = new Map();
    var seen = new Set();

    function ordinalOf(levelId) {
      return meta.ordinal.has(levelId) ? meta.ordinal.get(levelId) : 0;
    }

    function ensure(levelId, x, y, lonlat) {
      var rx = Math.round(x / SNAP_M) * SNAP_M;
      var ry = Math.round(y / SNAP_M) * SNAP_M;
      var id = nodeKey(levelId, rx, ry);
      if (!nodes.has(id)) {
        nodes.set(id, {
          id: id,
          x: rx,
          y: ry,
          lonlat: lonlat || spatialObj.toLonLat(rx, ry),
          level_id: levelId,
          ordinal: ordinalOf(levelId),
          group: null,
          kind: null,
          tname: null
        });
        adj.set(id, []);
      }
      return nodes.get(id);
    }

    function link(a, b, weight, transition, outdoor) {
      if (!a || !b || a.id === b.id) return;
      if (!(weight > 0)) return;
      var k = a.id + '>' + b.id + (transition ? transition.group : '');
      if (seen.has(k)) return;
      seen.add(k);
      adj.get(a.id).push({ to: b.id, w: weight, transition: transition || null, outdoor: !!outdoor });
    }

    (fc.features || []).forEach(function (f) {
      var p = f.properties || {};
      if (p.feature_type !== 'pathway' || !p.level_id) return;
      linesOf(f).forEach(function (line) {
        for (var i = 1; i < line.length; i++) {
          var m0 = spatialObj.toMeters(line[i - 1][0], line[i - 1][1]);
          var m1 = spatialObj.toMeters(line[i][0], line[i][1]);
          var n0 = ensure(p.level_id, m0[0], m0[1], line[i - 1]);
          var n1 = ensure(p.level_id, m1[0], m1[1], line[i]);
          var w = Math.hypot(n0.x - n1.x, n0.y - n1.y);
          link(n0, n1, w, null, !!p.outdoor);
          link(n1, n0, w, null, !!p.outdoor);
        }
      });
    });

    function tag(levelId, x, y, group, kind, tname) {
      if (!group) return;
      var nearest = nearestNode(graphStub(), levelId, x, y);
      var node = nearest && nearest.d <= LINK_M ? nearest.node : ensure(levelId, x, y, spatialObj.toLonLat(x, y));
      if (nearest && nearest.node !== node && nearest.d > 0.05 && nearest.d <= LINK_M) {
        link(node, nearest.node, nearest.d, null);
        link(nearest.node, node, nearest.d, null);
      }
      node.group = group;
      node.kind = kind || 'elevator';
      node.tname = tname || (node.kind === 'stair' ? 'Stair' : 'Elevator');
    }

    function graphStub() {
      return { nodes: nodes };
    }

    (fc.features || []).forEach(function (f) {
      var p = f.properties || {};
      if (p.feature_type === 'unit' && p.transition_group && p.level_id) {
        var a = anchorMeters(spatialObj, f);
        tag(p.level_id, a[0], a[1], p.transition_group, p.transition_kind, p.name);
      }
      if (p.feature_type === 'transition' && p.level_id && (p.group || p.transition_group)) {
        var pt = pointOf(f);
        var m = pt ? spatialObj.toMeters(pt[0], pt[1]) : anchorMeters(spatialObj, f);
        tag(p.level_id, m[0], m[1], p.group || p.transition_group, p.kind || p.transition_kind, p.name);
      }
    });

    var groups = new Map();
    nodes.forEach(function (node) {
      if (!node.group) return;
      if (!groups.has(node.group)) groups.set(node.group, []);
      groups.get(node.group).push(node);
    });
    groups.forEach(function (list) {
      list.sort(function (a, b) { return a.ordinal - b.ordinal; });
      for (var i = 1; i < list.length; i++) {
        var a = list[i - 1];
        var b = list[i];
        var floors = Math.max(1, Math.abs(b.ordinal - a.ordinal));
        var kind = b.kind || a.kind || 'elevator';
        var w = kind === 'stair' ? 14 + 8 * floors : (kind === 'escalator' ? 6 + 4 * floors : 8 + 6 * floors);
        var name = b.tname || a.tname || (kind === 'stair' ? 'Stair' : 'Elevator');
        var spec = { group: b.group, kind: kind, name: name };
        link(a, b, w, spec);
        link(b, a, w, spec);
      }
    });

    return { nodes: nodes, adj: adj, meta: meta };
  }

  function nearest(graph, levelId, x, y) {
    var best = null;
    var bestD = Infinity;
    graph.nodes.forEach(function (node) {
      if (node.level_id !== levelId) return;
      var d = Math.hypot(node.x - x, node.y - y);
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    });
    if (!best) return null;
    return { node: best, d: bestD };
  }

  function nearestNode(graph, levelId, x, y) {
    return nearest(graph, levelId, x, y);
  }

  function astar(graph, startId, goalId, vertical) {
    if (startId === goalId) return [startId];
    var dist = new Map();
    var prev = new Map();
    var open = new Set([startId]);
    var closed = new Set();
    dist.set(startId, 0);
    var goal = graph.nodes.get(goalId);

    function h(id) {
      var n = graph.nodes.get(id);
      return Math.hypot(n.x - goal.x, n.y - goal.y) + Math.abs(n.ordinal - goal.ordinal) * 8;
    }

    function allowed(edge) {
      if (!edge.transition || !vertical || vertical === 'either') return true;
      return edge.transition.kind === vertical;
    }

    while (open.size) {
      var current = null;
      var bestF = Infinity;
      open.forEach(function (id) {
        var f = dist.get(id) + h(id);
        if (f < bestF) {
          bestF = f;
          current = id;
        }
      });
      if (current === goalId) break;
      open.delete(current);
      if (closed.has(current)) continue;
      closed.add(current);
      var edges = graph.adj.get(current) || [];
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (closed.has(e.to) || !allowed(e)) continue;
        var nd = dist.get(current) + e.w;
        if (nd < (dist.has(e.to) ? dist.get(e.to) : Infinity)) {
          dist.set(e.to, nd);
          prev.set(e.to, current);
          open.add(e.to);
        }
      }
    }

    if (!prev.has(goalId) && startId !== goalId) return null;
    var chain = [goalId];
    while (chain[0] !== startId) {
      var p = prev.get(chain[0]);
      if (!p) return null;
      chain.unshift(p);
    }
    return chain;
  }

  function edgeBetween(graph, a, b) {
    var edges = graph.adj.get(a) || [];
    for (var i = 0; i < edges.length; i++) {
      if (edges[i].to === b) return edges[i];
    }
    return null;
  }

  function featureById(fc, id) {
    var features = fc.features || [];
    for (var i = 0; i < features.length; i++) {
      if (String(features[i].id) === String(id)) return features[i];
    }
    return null;
  }

  function endpoint(spatialObj, graph, fc, ref) {
    if (ref == null) return { error: 'Choose a start and a destination.' };
    if (typeof ref === 'string' || typeof ref === 'number') {
      var feature = featureById(fc, ref);
      if (!feature) return { error: 'That place is not on the map.' };
      ref = feature;
    }
    if (ref.type === 'Feature' || (ref.properties && ref.geometry)) {
      var p = ref.properties || {};
      var anchor = anchorMeters(spatialObj, ref);
      var hit = nearest(graph, p.level_id, anchor[0], anchor[1]);
      if (!hit || hit.d > UNIT_SNAP_M) {
        return { error: (p.name || 'That place') + ' is not connected to the walk network.' };
      }
      return {
        id: ref.id,
        name: p.name || 'Place',
        level_id: p.level_id,
        level_name: p.level_name || graph.meta.name.get(p.level_id) || p.level_id,
        node: hit.node
      };
    }
    var levelId = ref.level_id;
    var hit2 = nearest(graph, levelId, ref.x, ref.y);
    if (!hit2 || hit2.d > UNIT_SNAP_M) return { error: 'That point is not on the walk network.' };
    return {
      id: ref.id || null,
      name: ref.name || 'Map point',
      level_id: levelId,
      level_name: ref.level_name || graph.meta.name.get(levelId) || levelId,
      node: hit2.node
    };
  }

  function levelName(graph, levelId, fallback) {
    return graph.meta.name.get(levelId) || fallback || levelId;
  }

  function bearing(a, b) {
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  }

  function turnDelta(from, to) {
    var d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function compass(angle) {
    var names = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    var wrapped = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return names[Math.round(wrapped / (Math.PI / 4)) % 8];
  }

  function turnAction(delta) {
    var deg = Math.abs(delta) * 180 / Math.PI;
    var right = delta > 0;
    if (deg < 22) return null;
    if (deg < 50) return right ? 'slight-right' : 'slight-left';
    if (deg < 120) return right ? 'right' : 'left';
    if (deg < 160) return right ? 'sharp-right' : 'sharp-left';
    return 'uturn';
  }

  function instruction(action, angle) {
    if (action === 'depart') return 'Head ' + compass(angle);
    if (action === 'left') return 'Turn left';
    if (action === 'right') return 'Turn right';
    if (action === 'slight-left') return 'Bear left';
    if (action === 'slight-right') return 'Bear right';
    if (action === 'sharp-left') return 'Turn sharp left';
    if (action === 'sharp-right') return 'Turn sharp right';
    if (action === 'uturn') return 'Make a U-turn';
    return 'Continue';
  }

  function maneuverSteps(spatialObj, walk) {
    var coords = walk.coords;
    var meters = coords.map(function (c) { return spatialObj.toMeters(c[0], c[1]); });
    var keep = [0];
    for (var i = 1; i < meters.length - 1; i++) {
      var prev = meters[keep[keep.length - 1]];
      var dist = Math.hypot(meters[i][0] - prev[0], meters[i][1] - prev[1]);
      var bend = Math.abs(turnDelta(bearing(prev, meters[i]), bearing(meters[i], meters[i + 1])));
      if (dist >= 1.6 && bend > 0.38) keep.push(i);
    }
    keep.push(meters.length - 1);

    var out = [];
    var startK = 0;
    var action = 'depart';
    var head = bearing(meters[keep[0]], meters[keep[Math.min(1, keep.length - 1)]]);

    function emit(endK) {
      var a = keep[startK];
      var b = keep[endK];
      if (b <= a) return;
      var length = 0;
      for (var k = a + 1; k <= b; k++) {
        length += Math.hypot(meters[k][0] - meters[k - 1][0], meters[k][1] - meters[k - 1][1]);
      }
      if (length < 0.5) return;
      var slice = coords.slice(a, b + 1);
      out.push({
        kind: 'walk',
        action: walk.outdoor && action === 'depart' ? 'outside' : action,
        text: walk.outdoor && action === 'depart' ? 'Walk outside' : instruction(action, head),
        detail: Math.max(1, Math.round(length)) + ' m',
        level_id: walk.level_id,
        level_name: walk.level_name,
        meters: length,
        focus: slice[Math.floor(slice.length / 2)],
        coordinates: slice
      });
    }

    for (var k = 1; k < keep.length - 1; k++) {
      var h0 = bearing(meters[keep[k - 1]], meters[keep[k]]);
      var h1 = bearing(meters[keep[k]], meters[keep[k + 1]]);
      var turn = turnAction(turnDelta(h0, h1));
      if (!turn) continue;
      emit(k);
      startK = k;
      action = turn;
      head = h1;
    }
    emit(keep.length - 1);
    if (!out.length) {
      out.push({
        kind: 'walk',
        action: 'depart',
        text: 'Head ' + compass(head),
        detail: Math.max(1, Math.round(walk.meters)) + ' m',
        level_id: walk.level_id,
        level_name: walk.level_name,
        meters: walk.meters,
        focus: coords[Math.floor(coords.length / 2)],
        coordinates: coords.slice()
      });
    }
    return out;
  }

  function rideText(kind) {
    if (kind === 'stair') return 'Take the stairs';
    if (kind === 'escalator') return 'Take the escalator';
    return 'Take the elevator';
  }

  function rideAction(kind) {
    if (kind === 'stair' || kind === 'escalator') return kind;
    return 'elevator';
  }

  function route(spatialObj, graph, fc, fromRef, toRef, options) {
    var from = endpoint(spatialObj, graph, fc, fromRef);
    var to = endpoint(spatialObj, graph, fc, toRef);
    if (from.error) return { error: from.error };
    if (to.error) return { error: to.error };
    if (from.id && to.id && String(from.id) === String(to.id)) {
      return { error: 'Choose two different places.' };
    }
    var vertical = options && options.vertical ? options.vertical : 'either';
    var chain = astar(graph, from.node.id, to.node.id, vertical);
    if (!chain) {
      if (vertical === 'elevator') return { error: 'No route uses only the elevator.' };
      if (vertical === 'stair') return { error: 'No route uses only the stairs.' };
      return { error: 'No indoor route connects these places.' };
    }

    var steps = [];
    var segments = [];
    var walk = null;

    function flushWalk() {
      if (!walk || walk.meters < 0.5) {
        walk = null;
        return;
      }
      segments.push({ level_id: walk.level_id, coordinates: walk.coords.slice() });
      maneuverSteps(spatialObj, walk).forEach(function (step) { steps.push(step); });
      walk = null;
    }

    for (var i = 1; i < chain.length; i++) {
      var a = graph.nodes.get(chain[i - 1]);
      var b = graph.nodes.get(chain[i]);
      var edge = edgeBetween(graph, a.id, b.id);
      if (edge && edge.transition) {
        flushWalk();
        var destName = levelName(graph, b.level_id, b.level_id);
        var prev = steps[steps.length - 1];
        if (prev && prev.kind === 'transition' && prev.group === edge.transition.group) {
          prev.toLevel = b.level_id;
          prev.level_id = b.level_id;
          prev.level_name = destName;
          prev.toFocus = b.lonlat;
          prev.focus = b.lonlat;
          prev.detail = 'to ' + destName;
          prev.text = rideText(prev.mode);
        } else {
          steps.push({
            kind: 'transition',
            action: rideAction(edge.transition.kind),
            group: edge.transition.group,
            mode: edge.transition.kind,
            name: edge.transition.name,
            text: rideText(edge.transition.kind),
            detail: 'to ' + destName,
            fromLevel: a.level_id,
            toLevel: b.level_id,
            level_id: b.level_id,
            level_name: destName,
            fromFocus: a.lonlat,
            toFocus: b.lonlat,
            focus: b.lonlat
          });
        }
      } else {
        var w = edge ? edge.w : Math.hypot(a.x - b.x, a.y - b.y);
        var outside = !!(edge && edge.outdoor);
        if (!walk || walk.level_id !== a.level_id || !!walk.outdoor !== outside) {
          flushWalk();
          walk = {
            level_id: a.level_id,
            level_name: levelName(graph, a.level_id, a.level_id),
            meters: 0,
            coords: [a.lonlat],
            outdoor: outside
          };
        }
        walk.meters += w;
        walk.coords.push(b.lonlat);
      }
    }
    flushWalk();

    steps.push({
      kind: 'arrive',
      action: 'arrive',
      text: 'Arrive',
      detail: to.name,
      level_id: to.level_id,
      level_name: to.level_name,
      focus: to.node.lonlat,
      name: to.name
    });

    var walkMeters = 0;
    var transitions = 0;
    steps.forEach(function (s) {
      if (s.kind === 'walk') walkMeters += s.meters;
      if (s.kind === 'transition') transitions += 1;
    });

    return {
      walkMeters: walkMeters,
      transitions: transitions,
      steps: steps,
      segments: segments,
      from: { name: from.name, level_id: from.level_id, level_name: from.level_name, lonlat: from.node.lonlat },
      to: { name: to.name, level_id: to.level_id, level_name: to.level_name, lonlat: to.node.lonlat }
    };
  }

  root.IndoorRoute = {
    spatial: spatial,
    buildGraph: buildGraph,
    describe: describe,
    anchorMeters: anchorMeters,
    nearest: nearest,
    route: route,
    UNIT_SNAP_M: UNIT_SNAP_M
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
