'use client';
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

// Currency → representative cities
const CURRENCY_CITIES = {
  USD: [
    { lat: 40.7128, lng: -74.006, l: 'New York' },
    { lat: 34.0522, lng: -118.2437, l: 'Los Angeles' },
    { lat: 41.8781, lng: -87.6298, l: 'Chicago' },
    { lat: 37.7749, lng: -122.4194, l: 'San Francisco' },
    { lat: 25.7617, lng: -80.1918, l: 'Miami' },
  ],
  INR: [
    { lat: 28.6139, lng: 77.209, l: 'New Delhi' },
    { lat: 19.076, lng: 72.8777, l: 'Mumbai' },
    { lat: 12.9716, lng: 77.5946, l: 'Bangalore' },
    { lat: 17.385, lng: 78.4867, l: 'Hyderabad' },
  ],
  EUR: [
    { lat: 48.8566, lng: 2.3522, l: 'Paris' },
    { lat: 52.52, lng: 13.405, l: 'Berlin' },
    { lat: 52.3676, lng: 4.9041, l: 'Amsterdam' },
    { lat: 41.9028, lng: 12.4964, l: 'Rome' },
  ],
  NGN: [
    { lat: 6.5244, lng: 3.3792, l: 'Lagos' },
    { lat: 9.0579, lng: 7.4951, l: 'Abuja' },
  ],
  XRP: [
    { lat: 37.7749, lng: -122.4194, l: 'San Francisco' },
  ],
};

function pickCity(currency) {
  const cities = CURRENCY_CITIES[currency] || CURRENCY_CITIES.USD;
  return cities[Math.floor(Math.random() * cities.length)];
}

const C = {
  base: 0x161618, fill: 0x1c1c1e, border: 0x0a84ff,
  atmo: 0x0a84ff, grid: 0x2c2c2e,
  arcCyan: 0x0a84ff, arcOrange: 0xff9f0a,
  trailHead: 0xf5f5f7, trailMid: 0x0a84ff, trailTail: 0x063d7a,
  pulse: 0x0a84ff, particle: 0x0a84ff,
};

function ll2v(lat, lng, r = 1.005) {
  const p = (90 - lat) * Math.PI / 180;
  const t = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
}

function decodeTopo(top, name) {
  const obj = top.objects[name], arcs = top.arcs, tr = top.transform;
  function da(ai) {
    const rev = ai < 0, idx = rev ? ~ai : ai, arc = arcs[idx], co = [];
    let x = 0, y = 0;
    for (const [dx, dy] of arc) { x += dx; y += dy; co.push(tr ? [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]] : [x, y]); }
    return rev ? co.reverse() : co;
  }
  function dr(ids) { let co = []; for (const i of ids) { const d = da(i); co = co.concat(co.length ? d.slice(1) : d); } return co; }
  function dg(g) {
    if (g.type === 'GeometryCollection') return { type: 'FeatureCollection', features: g.geometries.map(dg) };
    if (g.type === 'Polygon') return { type: 'Feature', geometry: { type: 'Polygon', coordinates: g.arcs.map(r => dr(r)) }, properties: g.properties || {} };
    if (g.type === 'MultiPolygon') return { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: g.arcs.map(p => p.map(r => dr(r))) }, properties: g.properties || {} };
    return { type: 'Feature', geometry: { type: g.type, coordinates: g.coordinates || [] }, properties: g.properties || {} };
  }
  const r = dg(obj);
  return r.type === 'FeatureCollection' ? r : { type: 'FeatureCollection', features: [r] };
}

// Single transfer globe for payment flows
// Props: fromCurrency, toCurrency, onComplete, autoStart (default true)
export default function TransferGlobe({ fromCurrency = 'USD', toCurrency = 'INR', onComplete, autoStart = true }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef({ mounted: false });

  const initGlobe = useCallback(async () => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 3.0;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);

    const GG = new THREE.Group();
    scene.add(GG);

    scene.add(new THREE.AmbientLight(0x334477, 0.5));
    const dl = new THREE.DirectionalLight(0x88bbff, 0.9);
    dl.position.set(5, 3, 5);
    scene.add(dl);

    // Globe sphere
    GG.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({ color: C.base, emissive: 0x050d22, emissiveIntensity: 0.4, shininess: 15, transparent: true, opacity: 0.97 })
    ));
    // Atmosphere
    GG.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 64, 64),
      new THREE.MeshBasicMaterial({ color: C.atmo, transparent: true, opacity: 0.07, side: THREE.BackSide })
    ));

    // Grid
    const gridMat = new THREE.LineBasicMaterial({ color: C.grid, transparent: true, opacity: 0.1 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (90 - lat) * Math.PI / 180, pts = [];
      for (let lng = 0; lng <= 360; lng += 4) {
        const t = lng * Math.PI / 180, r = 1.001;
        pts.push(new THREE.Vector3(-r * Math.sin(phi) * Math.cos(t), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(t)));
      }
      GG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }

    Object.assign(s, { scene, camera, renderer, GG, transfer: null, bursts: [], tObjs: [] });

    // Load countries (borders only, lightweight)
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      const topo = await res.json();
      const geo = decodeTopo(topo, 'countries');
      GG.add(buildBorders(geo));
    } catch (e) { console.warn('Globe data load failed:', e); }

    // Resize
    function resize() {
      if (!container || !s.mounted) return;
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    s._ro = ro;

    // Pick cities based on currencies
    const fromCity = pickCity(fromCurrency);
    const toCity = pickCity(toCurrency);

    // Orient globe to show transfer midpoint
    const midLat = (fromCity.lat + toCity.lat) / 2;
    const midLng = (fromCity.lng + toCity.lng) / 2;
    const tgtY = -midLng * Math.PI / 180 + Math.PI;
    const tgtX = midLat * Math.PI / 180 * 0.3;
    GG.rotation.y = tgtY;
    GG.rotation.x = tgtX;

    s.lt = performance.now();
    s.fromCity = fromCity;
    s.toCity = toCity;
    s.transferLaunched = false;
    s.autoRotSpeed = 0.03;

    // Animation loop
    function anim() {
      if (!s.mounted) return;
      s.animId = requestAnimationFrame(anim);
      const now = performance.now(), dt = Math.min((now - s.lt) / 1000, 0.05);
      s.lt = now;

      GG.rotation.y += dt * s.autoRotSpeed;

      if (s.transfer) updateTransfer(dt, s);
      updateBursts(dt, s);
      renderer.render(scene, camera);
    }
    anim();

    // Auto-start the transfer after a brief delay
    if (autoStart) {
      setTimeout(() => {
        if (s.mounted) launchTransfer(s);
      }, 600);
    }
  }, [fromCurrency, toCurrency, autoStart, onComplete]);

  useEffect(() => {
    const s = stateRef.current;
    s.mounted = true;
    s.onComplete = onComplete;
    initGlobe();
    return () => {
      s.mounted = false;
      if (s.animId) cancelAnimationFrame(s.animId);
      if (s._ro) s._ro.disconnect();
      if (s.renderer) s.renderer.dispose();
    };
  }, [initGlobe]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none' }} />
    </div>
  );
}

// Simplified border renderer
function buildBorders(geo) {
  const grp = new THREE.Group();
  const bMat = new THREE.LineBasicMaterial({ color: C.border, transparent: true, opacity: 0.35 });
  const fMat = new THREE.MeshBasicMaterial({ color: C.fill, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const feats = geo.features || [geo];
  for (const feat of feats) {
    const gm = feat.geometry; if (!gm) continue;
    let polys = [];
    if (gm.type === 'Polygon') polys = [gm.coordinates];
    else if (gm.type === 'MultiPolygon') polys = gm.coordinates;
    else continue;
    for (const poly of polys) {
      for (let ri = 0; ri < poly.length; ri++) {
        const ring = poly[ri]; if (!ring || ring.length < 3) continue;
        const segs = [[]];
        for (let i = 0; i < ring.length; i++) {
          const [lng, lat] = ring[i];
          if (i > 0 && Math.abs(lng - ring[i - 1][0]) > 90) segs.push([]);
          segs[segs.length - 1].push(ll2v(lat, lng, 1.002));
        }
        for (const seg of segs) if (seg.length > 1) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(seg), bMat));
        if (ri === 0 && ring.length >= 4) {
          let cross = false;
          for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 90) { cross = true; break; }
          if (cross) continue;
          let cLat = 0, cLng = 0;
          for (const [lng, lat] of ring) { cLat += lat; cLng += lng; }
          cLat /= ring.length; cLng /= ring.length;
          const ctr = ll2v(cLat, cLng, 1.001), verts = [];
          for (let i = 0; i < ring.length - 1; i++) {
            const v1 = ll2v(ring[i][1], ring[i][0], 1.001), v2 = ll2v(ring[i + 1][1], ring[i + 1][0], 1.001);
            verts.push(ctr.x, ctr.y, ctr.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
          }
          if (verts.length) {
            const fg = new THREE.BufferGeometry();
            fg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            fg.computeVertexNormals();
            grp.add(new THREE.Mesh(fg, fMat));
          }
        }
      }
    }
  }
  return grp;
}

// Markers
function mkMarker(lat, lng, color, GG) {
  const g = new THREE.Group(), pos = ll2v(lat, lng, 1.006), dir = pos.clone().normalize();
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.025 + i * 0.02, 0.03 + i * 0.02, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 - i * 0.15, side: THREE.DoubleSide })
    );
    ring.position.copy(pos); ring.lookAt(new THREE.Vector3(0, 0, 0));
    ring.userData = { isPulse: true, pulsePhase: i * 2, pulseIdx: i };
    g.add(ring);
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), new THREE.MeshBasicMaterial({ color }));
  dot.position.copy(pos); g.add(dot);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, 0.18, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 })
  );
  beam.position.copy(pos.clone().add(dir.clone().multiplyScalar(0.09)));
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(beam);
  GG.add(g);
  return g;
}

function mkArcPath(a, b, n = 200) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = new THREE.Vector3().copy(a).lerp(b, t).normalize();
    p.multiplyScalar(1.005 + Math.sin(t * Math.PI) * 0.35);
    pts.push(p);
  }
  return pts;
}

function mkParticle(GG) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), new THREE.MeshBasicMaterial({ color: C.trailHead })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: C.particle, transparent: true, opacity: 0.25 })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshBasicMaterial({ color: C.particle, transparent: true, opacity: 0.08 })));
  const tc = 60;
  const tp = new Float32Array(tc * 3);
  const tColors = new Float32Array(tc * 3);
  for (let i = 0; i < tc; i++) {
    const t = i / tc;
    const headCol = new THREE.Color(C.trailHead);
    const midCol = new THREE.Color(C.trailMid);
    const tailCol = new THREE.Color(C.trailTail);
    let col;
    if (t < 0.3) col = headCol.clone().lerp(midCol, t / 0.3);
    else col = midCol.clone().lerp(tailCol, (t - 0.3) / 0.7);
    tColors[i * 3] = col.r; tColors[i * 3 + 1] = col.g; tColors[i * 3 + 2] = col.b;
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  tg.setAttribute('color', new THREE.Float32BufferAttribute(tColors, 3));
  const trail = new THREE.Points(tg, new THREE.PointsMaterial({ vertexColors: true, transparent: true, opacity: 0.8, size: 0.016, sizeAttenuation: true }));
  g.add(trail);
  g.userData = { trail, history: [], tc };
  GG.add(g);
  return g;
}

function launchTransfer(s) {
  if (s.transferLaunched || !s.GG) return;
  s.transferLaunched = true;

  const fc = s.fromCity, tc = s.toCity;
  const fp = ll2v(fc.lat, fc.lng), tp = ll2v(tc.lat, tc.lng);

  const fm = mkMarker(fc.lat, fc.lng, C.arcCyan, s.GG);
  const tm = mkMarker(tc.lat, tc.lng, C.arcOrange, s.GG);

  const path = mkArcPath(fp, tp, 200);
  // Arc line
  const pos = new Float32Array(path.length * 3);
  path.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; });
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  arcGeo.setDrawRange(0, 0);
  const arcLine = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: C.arcCyan, transparent: true, opacity: 0.7 }));
  s.GG.add(arcLine);

  const particle = mkParticle(s.GG);

  s.transfer = {
    fp, tp, path, arcLine, particle, fm, tm,
    progress: 0, phase: 'draw', len: path.length,
  };
  s.autoRotSpeed = 0.015; // Slow rotation during transfer
}

function updateTransfer(dt, s) {
  const a = s.transfer;
  if (!a) return;
  const path = a.path, len = a.len;

  if (a.phase === 'draw') {
    a.progress += dt * 0.9;
    if (a.progress >= 1) { a.progress = 0; a.phase = 'travel'; }
    const cnt = Math.floor(a.progress * len);
    a.arcLine.geometry.setDrawRange(0, cnt);
  } else if (a.phase === 'travel') {
    a.progress += dt * 0.35;
    if (a.progress >= 1) { a.progress = 1; a.phase = 'arrive'; a.arriveT = 0; }
    a.arcLine.geometry.setDrawRange(0, len);

    const ease = a.progress < 0.5 ? 4 * a.progress ** 3 : 1 - (-2 * a.progress + 2) ** 3 / 2;
    const idx = Math.min(Math.floor(ease * (len - 1)), len - 1);
    const pos = path[idx];
    a.particle.position.copy(pos);

    const hist = a.particle.userData.history;
    hist.unshift(pos.clone());
    if (hist.length > a.particle.userData.tc) hist.pop();
    const tArr = a.particle.userData.trail.geometry.attributes.position.array;
    for (let i = 0; i < a.particle.userData.tc; i++) {
      if (i < hist.length) {
        tArr[i * 3] = hist[i].x; tArr[i * 3 + 1] = hist[i].y; tArr[i * 3 + 2] = hist[i].z;
      }
    }
    a.particle.userData.trail.geometry.attributes.position.needsUpdate = true;

    const p = 1 + Math.sin(performance.now() * 0.008) * 0.3;
    a.particle.children[0].scale.setScalar(p);
    a.particle.children[1].scale.setScalar(p * 1.3);
  } else if (a.phase === 'arrive') {
    a.arriveT += dt;
    a.particle.children.forEach(c => { if (c.material && c.material.transparent) c.material.opacity *= 0.92; });
    if (a.arriveT > 0.8) {
      mkBurst(a.tp, s);
      a.phase = 'done';
      s.autoRotSpeed = 0.03;
      if (s.onComplete) s.onComplete();
    }
  }

  // Pulse markers
  s.GG.traverse(c => {
    if (c.userData?.isPulse) {
      c.userData.pulsePhase += 0.04;
      const idx = c.userData.pulseIdx || 0;
      const sc = 1 + Math.sin(c.userData.pulsePhase) * (0.5 + idx * 0.3);
      c.scale.setScalar(sc);
      c.material.opacity = Math.max(0, 0.5 - idx * 0.1 - Math.sin(c.userData.pulsePhase) * 0.2);
    }
  });
}

function mkBurst(pos, s) {
  const vs = [], ps = [];
  for (let i = 0; i < 80; i++) {
    ps.push(pos.x, pos.y, pos.z);
    vs.push(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar(0.02 + Math.random() * 0.06));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  const b = new THREE.Points(g, new THREE.PointsMaterial({ color: C.pulse, size: 0.016, transparent: true, opacity: 1, sizeAttenuation: true }));
  b.userData = { vs, life: 1 };
  s.GG.add(b); s.bursts.push(b);
}

function updateBursts(dt, s) {
  s.bursts = s.bursts.filter(b => {
    b.userData.life -= dt * 0.6;
    if (b.userData.life <= 0) { if (b.parent) b.parent.remove(b); return false; }
    b.material.opacity = b.userData.life;
    const p = b.geometry.attributes.position.array;
    b.userData.vs.forEach((v, i) => { p[i * 3] += v.x * dt; p[i * 3 + 1] += v.y * dt; p[i * 3 + 2] += v.z * dt; });
    b.geometry.attributes.position.needsUpdate = true;
    return true;
  });
}
