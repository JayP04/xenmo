'use client';
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

// ── City database ──
const CDB = {
  'kansas city': { lat: 39.0997, lng: -94.5786, l: 'Kansas City' },
  'new york': { lat: 40.7128, lng: -74.006, l: 'New York' },
  'los angeles': { lat: 34.0522, lng: -118.2437, l: 'Los Angeles' },
  'chicago': { lat: 41.8781, lng: -87.6298, l: 'Chicago' },
  'san francisco': { lat: 37.7749, lng: -122.4194, l: 'San Francisco' },
  'miami': { lat: 25.7617, lng: -80.1918, l: 'Miami' },
  'seattle': { lat: 47.6062, lng: -122.3321, l: 'Seattle' },
  'houston': { lat: 29.7604, lng: -95.3698, l: 'Houston' },
  'dallas': { lat: 32.7767, lng: -96.797, l: 'Dallas' },
  'new delhi': { lat: 28.6139, lng: 77.209, l: 'New Delhi' },
  'mumbai': { lat: 19.076, lng: 72.8777, l: 'Mumbai' },
  'bangalore': { lat: 12.9716, lng: 77.5946, l: 'Bangalore' },
  'hyderabad': { lat: 17.385, lng: 78.4867, l: 'Hyderabad' },
  'chennai': { lat: 13.0827, lng: 80.2707, l: 'Chennai' },
  'kolkata': { lat: 22.5726, lng: 88.3639, l: 'Kolkata' },
  'london': { lat: 51.5074, lng: -0.1278, l: 'London' },
  'manchester': { lat: 53.4808, lng: -2.2426, l: 'Manchester' },
  'lagos': { lat: 6.5244, lng: 3.3792, l: 'Lagos' },
  'abuja': { lat: 9.0579, lng: 7.4951, l: 'Abuja' },
  'tokyo': { lat: 35.6762, lng: 139.6503, l: 'Tokyo' },
  'osaka': { lat: 34.6937, lng: 135.5023, l: 'Osaka' },
  'sao paulo': { lat: -23.5505, lng: -46.6333, l: 'São Paulo' },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729, l: 'Rio de Janeiro' },
  'sydney': { lat: -33.8688, lng: 151.2093, l: 'Sydney' },
  'melbourne': { lat: -37.8136, lng: 144.9631, l: 'Melbourne' },
  'manila': { lat: 14.5995, lng: 120.9842, l: 'Manila' },
  'dubai': { lat: 25.2048, lng: 55.2708, l: 'Dubai' },
  'karachi': { lat: 24.8607, lng: 67.0011, l: 'Karachi' },
  'islamabad': { lat: 33.6844, lng: 73.0479, l: 'Islamabad' },
  'toronto': { lat: 43.6532, lng: -79.3832, l: 'Toronto' },
  'vancouver': { lat: 49.2827, lng: -123.1207, l: 'Vancouver' },
  'mexico city': { lat: 19.4326, lng: -99.1332, l: 'Mexico City' },
  'paris': { lat: 48.8566, lng: 2.3522, l: 'Paris' },
  'berlin': { lat: 52.52, lng: 13.405, l: 'Berlin' },
  'rome': { lat: 41.9028, lng: 12.4964, l: 'Rome' },
  'amsterdam': { lat: 52.3676, lng: 4.9041, l: 'Amsterdam' },
  'nairobi': { lat: -1.2921, lng: 36.8219, l: 'Nairobi' },
  'cairo': { lat: 30.0444, lng: 31.2357, l: 'Cairo' },
  'johannesburg': { lat: -26.2041, lng: 28.0473, l: 'Johannesburg' },
  'singapore': { lat: 1.3521, lng: 103.8198, l: 'Singapore' },
  'beijing': { lat: 39.9042, lng: 116.4074, l: 'Beijing' },
  'shanghai': { lat: 31.2304, lng: 121.4737, l: 'Shanghai' },
  'hong kong': { lat: 22.3193, lng: 114.1694, l: 'Hong Kong' },
  'seoul': { lat: 37.5665, lng: 126.978, l: 'Seoul' },
  'bangkok': { lat: 13.7563, lng: 100.5018, l: 'Bangkok' },
  'jakarta': { lat: -6.2088, lng: 106.8456, l: 'Jakarta' },
  'riyadh': { lat: 24.7136, lng: 46.6753, l: 'Riyadh' },
  'istanbul': { lat: 41.0082, lng: 28.9784, l: 'Istanbul' },
};

// Demo transfer routes
const DEMO_ROUTES = [
  { from: 'kansas city', to: 'new delhi', amt: '$1,200', cur: 'USD → INR' },
  { from: 'london', to: 'lagos', amt: '£800', cur: 'GBP → NGN' },
  { from: 'tokyo', to: 'sao paulo', amt: '¥50,000', cur: 'JPY → BRL' },
  { from: 'sydney', to: 'manila', amt: 'A$600', cur: 'AUD → PHP' },
  { from: 'dubai', to: 'karachi', amt: 'AED 2,000', cur: 'AED → PKR' },
  { from: 'toronto', to: 'mexico city', amt: 'C$750', cur: 'CAD → MXN' },
  { from: 'new york', to: 'london', amt: '$3,500', cur: 'USD → GBP' },
  { from: 'paris', to: 'nairobi', amt: '€1,800', cur: 'EUR → KES' },
  { from: 'singapore', to: 'mumbai', amt: 'S$950', cur: 'SGD → INR' },
  { from: 'berlin', to: 'istanbul', amt: '€600', cur: 'EUR → TRY' },
  { from: 'seoul', to: 'jakarta', amt: '₩500,000', cur: 'KRW → IDR' },
  { from: 'miami', to: 'rio de janeiro', amt: '$2,100', cur: 'USD → BRL' },
  { from: 'hong kong', to: 'sydney', amt: 'HK$8,000', cur: 'HKD → AUD' },
  { from: 'cairo', to: 'johannesburg', amt: 'E£15,000', cur: 'EGP → ZAR' },
  { from: 'chicago', to: 'bangalore', amt: '$4,200', cur: 'USD → INR' },
];

const C = {
  base: 0x161618, fill: 0x1c1c1e, border: 0x0a84ff,
  atmo: 0x0a84ff, grid: 0x2c2c2e,
  node: 0x3388cc, nodeGlow: 0x55aaee,
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

export default function Globe({ onTransfer }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef({
    scene: null, camera: null, renderer: null, GG: null,
    transfers: [], tObjs: [], bursts: [],
    tgtY: 0.5, tgtX: 0.1, curY: 0.5, curX: 0.1,
    autoRot: true, drag: false, lp: { x: 0, y: 0 }, at: null,
    lt: 0, animId: null, landPoints: [], routeIdx: 0,
    demoInterval: null, mounted: true,
  });

  const initGlobe = useCallback(async () => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 3.2;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);

    const GG = new THREE.Group();
    scene.add(GG);

    scene.add(new THREE.AmbientLight(0x334477, 0.5));
    const dl = new THREE.DirectionalLight(0x88bbff, 0.9);
    dl.position.set(5, 3, 5);
    scene.add(dl);
    const rl = new THREE.DirectionalLight(0x0a84ff, 0.2);
    rl.position.set(-3, -1, -3);
    scene.add(rl);

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
    GG.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x0d47a1, transparent: true, opacity: 0.035, side: THREE.BackSide })
    ));

    // Grid
    const gridGrp = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({ color: C.grid, transparent: true, opacity: 0.1 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (90 - lat) * Math.PI / 180, pts = [];
      for (let lng = 0; lng <= 360; lng += 4) {
        const t = lng * Math.PI / 180, r = 1.001;
        pts.push(new THREE.Vector3(-r * Math.sin(phi) * Math.cos(t), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(t)));
      }
      gridGrp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (let lng = 0; lng < 360; lng += 30) {
      const t = lng * Math.PI / 180, pts = [];
      for (let lat = -90; lat <= 90; lat += 4) {
        const phi = (90 - lat) * Math.PI / 180, r = 1.001;
        pts.push(new THREE.Vector3(-r * Math.sin(phi) * Math.cos(t), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(t)));
      }
      gridGrp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    GG.add(gridGrp);

    Object.assign(s, { scene, camera, renderer, GG, lt: performance.now() });

    // Load countries
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      const topo = await res.json();
      const geo = decodeTopo(topo, 'countries');
      GG.add(buildCountries(geo, s));
      GG.add(createLandNodes(s));
    } catch (e) { console.warn('Globe data load failed:', e); }

    // Resize
    function resize() {
      if (!container || !s.mounted) return;
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.position.z = camera.aspect < 0.7 ? 3.6 : camera.aspect < 1 ? 3.4 : 3.2;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    s._ro = ro;

    // Input handlers
    function pd(e) {
      e.preventDefault(); s.drag = true; s.autoRot = false;
      if (s.at) clearTimeout(s.at);
      const p = e.touches ? e.touches[0] : e;
      s.lp = { x: p.clientX, y: p.clientY };
    }
    function pm(e) {
      if (!s.drag) return; e.preventDefault();
      const p = e.touches ? e.touches[0] : e;
      s.tgtY += (p.clientX - s.lp.x) * 0.005;
      s.tgtX += (p.clientY - s.lp.y) * 0.003;
      s.tgtX = Math.max(-1.2, Math.min(1.2, s.tgtX));
      s.lp = { x: p.clientX, y: p.clientY };
    }
    function pu() {
      s.drag = false;
      s.at = setTimeout(() => { if (!s.drag) s.autoRot = true; }, 3000);
    }
    canvas.addEventListener('mousedown', pd, { passive: false });
    window.addEventListener('mousemove', pm, { passive: false });
    window.addEventListener('mouseup', pu);
    canvas.addEventListener('touchstart', pd, { passive: false });
    canvas.addEventListener('touchmove', pm, { passive: false });
    canvas.addEventListener('touchend', pu);
    canvas.addEventListener('touchcancel', pu);
    s._cleanup = () => {
      canvas.removeEventListener('mousedown', pd);
      window.removeEventListener('mousemove', pm);
      window.removeEventListener('mouseup', pu);
      canvas.removeEventListener('touchstart', pd);
      canvas.removeEventListener('touchmove', pm);
      canvas.removeEventListener('touchend', pu);
      canvas.removeEventListener('touchcancel', pu);
    };

    // Animation loop
    function anim() {
      if (!s.mounted) return;
      s.animId = requestAnimationFrame(anim);
      const now = performance.now(), dt = Math.min((now - s.lt) / 1000, 0.05);
      s.lt = now;
      if (s.autoRot) s.tgtY += dt * 0.12;
      s.curY += (s.tgtY - s.curY) * 0.05;
      s.curX += (s.tgtX - s.curX) * 0.05;
      GG.rotation.y = s.curY;
      GG.rotation.x = s.curX;
      updateTransfers(dt, s);
      updateFX(s);
      updateBursts(dt, s);
      renderer.render(scene, camera);
    }
    anim();

    // Start demo transfers
    launchDemoTransfer(s);
    s.demoInterval = setInterval(() => {
      if (s.mounted) launchDemoTransfer(s);
    }, 3500);
  }, [onTransfer]);

  useEffect(() => {
    const s = stateRef.current;
    s.mounted = true;
    s.onTransfer = onTransfer;
    initGlobe();
    return () => {
      s.mounted = false;
      if (s.animId) cancelAnimationFrame(s.animId);
      if (s.demoInterval) clearInterval(s.demoInterval);
      if (s._ro) s._ro.disconnect();
      if (s._cleanup) s._cleanup();
      if (s.renderer) s.renderer.dispose();
    };
  }, [initGlobe]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0">
      <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none' }} />
    </div>
  );
}

// ── Build countries ──
function buildCountries(geo, s) {
  const grp = new THREE.Group();
  const bMat = new THREE.LineBasicMaterial({ color: C.border, transparent: true, opacity: 0.45 });
  const fMat = new THREE.MeshBasicMaterial({ color: C.fill, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
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
          segs[segs.length - 1].push(ll2v(lat, lng, 1.0025));
        }
        for (const seg of segs) if (seg.length > 1) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(seg), bMat));
        if (ri === 0 && ring.length >= 4) {
          let cross = false;
          for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 90) { cross = true; break; }
          if (cross) continue;
          let cLat = 0, cLng = 0;
          for (const [lng, lat] of ring) { cLat += lat; cLng += lng; }
          cLat /= ring.length; cLng /= ring.length;
          const ctr = ll2v(cLat, cLng, 1.002), verts = [];
          for (let i = 0; i < ring.length - 1; i++) {
            const v1 = ll2v(ring[i][1], ring[i][0], 1.002), v2 = ll2v(ring[i + 1][1], ring[i + 1][0], 1.002);
            verts.push(ctr.x, ctr.y, ctr.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
          }
          if (verts.length) {
            const fg = new THREE.BufferGeometry();
            fg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            fg.computeVertexNormals();
            grp.add(new THREE.Mesh(fg, fMat));
          }
          s.landPoints.push({ lat: cLat, lng: cLng });
          let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
          for (const [lng, lat] of ring) { if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat; if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng; }
          const area = (maxLat - minLat) * (maxLng - minLng);
          const count = Math.min(Math.max(Math.floor(area / 80), 1), 8);
          for (let i = 0; i < count; i++) {
            s.landPoints.push({ lat: minLat + Math.random() * (maxLat - minLat), lng: minLng + Math.random() * (maxLng - minLng) });
          }
        }
      }
    }
  }
  return grp;
}

function createLandNodes(s) {
  const grp = new THREE.Group();
  if (!s.landPoints.length) return grp;
  const bigCount = Math.min(s.landPoints.length, 600);
  const bigPos = new Float32Array(bigCount * 3);
  for (let i = 0; i < bigCount; i++) {
    const lp = s.landPoints[i % s.landPoints.length];
    const v = ll2v(lp.lat, lp.lng, 1.004);
    bigPos[i * 3] = v.x; bigPos[i * 3 + 1] = v.y; bigPos[i * 3 + 2] = v.z;
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bigPos, 3));
  grp.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: C.node, transparent: true, opacity: 0.55, size: 0.007, sizeAttenuation: true })));
  const hiCount = Math.min(Math.floor(bigCount / 4), 150);
  const hiPos = new Float32Array(hiCount * 3);
  for (let i = 0; i < hiCount; i++) {
    const lp = s.landPoints[Math.floor(Math.random() * s.landPoints.length)];
    const v = ll2v(lp.lat, lp.lng, 1.005);
    hiPos[i * 3] = v.x; hiPos[i * 3 + 1] = v.y; hiPos[i * 3 + 2] = v.z;
  }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(hiPos, 3));
  grp.add(new THREE.Points(hg, new THREE.PointsMaterial({ color: C.nodeGlow, transparent: true, opacity: 0.7, size: 0.011, sizeAttenuation: true })));
  grp.add(new THREE.Points(hg.clone(), new THREE.PointsMaterial({ color: C.nodeGlow, transparent: true, opacity: 0.15, size: 0.025, sizeAttenuation: true })));
  return grp;
}

// ── Markers, arcs, particles ──
function mkMarker(lat, lng, color) {
  const g = new THREE.Group(), pos = ll2v(lat, lng, 1.006), dir = pos.clone().normalize();
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.02 + i * 0.018, 0.025 + i * 0.018, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 - i * 0.12, side: THREE.DoubleSide })
    );
    ring.position.copy(pos); ring.lookAt(new THREE.Vector3(0, 0, 0));
    ring.userData = { isPulse: true, pulsePhase: i * 2, pulseIdx: i };
    g.add(ring);
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 12), new THREE.MeshBasicMaterial({ color }));
  dot.position.copy(pos); g.add(dot);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0025, 0.0025, 0.16, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 })
  );
  beam.position.copy(pos.clone().add(dir.clone().multiplyScalar(0.08)));
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(beam);
  const diam = new THREE.Mesh(new THREE.OctahedronGeometry(0.011, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  diam.position.copy(pos.clone().add(dir.clone().multiplyScalar(0.17)));
  diam.userData = { isFloat: true, floatBase: diam.position.clone(), floatDir: dir.clone() };
  g.add(diam);
  return g;
}

function mkArcPath(a, b, n = 250) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = new THREE.Vector3().copy(a).lerp(b, t).normalize();
    p.multiplyScalar(1.005 + Math.sin(t * Math.PI) * 0.35);
    pts.push(p);
  }
  return pts;
}

function mkArcLine(path, color, opacity) {
  const pos = new Float32Array(path.length * 3);
  path.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setDrawRange(0, 0);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function mkArcSystem(fromPos, toPos) {
  const path = mkArcPath(fromPos, toPos, 250);
  const grp = new THREE.Group();
  const baseLine = mkArcLine(path, C.arcCyan, 0.6);
  baseLine.userData.fullPath = path;
  grp.add(baseLine);
  const glowLine = mkArcLine(path, C.arcCyan, 0.15);
  grp.add(glowLine);
  const gradLine = mkArcLine(path, C.arcOrange, 0.2);
  grp.add(gradLine);
  grp.userData = { baseLine, glowLine, gradLine, path };
  return grp;
}

function mkParticle() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 16), new THREE.MeshBasicMaterial({ color: C.trailHead })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), new THREE.MeshBasicMaterial({ color: C.particle, transparent: true, opacity: 0.25 })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), new THREE.MeshBasicMaterial({ color: C.particle, transparent: true, opacity: 0.08 })));
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
  const trail = new THREE.Points(tg, new THREE.PointsMaterial({ vertexColors: true, transparent: true, opacity: 0.8, size: 0.014, sizeAttenuation: true }));
  g.add(trail);
  const tg2 = new THREE.BufferGeometry();
  tg2.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(tc * 3), 3));
  const trail2 = new THREE.Points(tg2, new THREE.PointsMaterial({ color: C.trailMid, transparent: true, opacity: 0.15, size: 0.03, sizeAttenuation: true }));
  g.add(trail2);
  g.userData = { trail, trail2, history: [], tc };
  return g;
}

// ── Demo transfer launcher ──
function launchDemoTransfer(s) {
  const route = DEMO_ROUTES[s.routeIdx % DEMO_ROUTES.length];
  s.routeIdx++;
  const fc = CDB[route.from], tc = CDB[route.to];
  if (!fc || !tc) return;
  const fp = ll2v(fc.lat, fc.lng), tp = ll2v(tc.lat, tc.lng);

  const fm = mkMarker(fc.lat, fc.lng, C.arcCyan);
  const tm = mkMarker(tc.lat, tc.lng, C.arcOrange);
  s.GG.add(fm); s.GG.add(tm);

  const arcSys = mkArcSystem(fp, tp);
  s.GG.add(arcSys);

  const particle = mkParticle();
  s.GG.add(particle);

  const objs = [fm, tm, arcSys, particle];
  s.tObjs.push(...objs);

  const transfer = {
    fp, tp, arcSys, particle, path: arcSys.userData.path,
    progress: 0, phase: 'draw', fc, tc,
    amt: route.amt, cur: route.cur, objs, fadeOut: 0,
  };
  s.transfers.push(transfer);

  // Notify parent for floating card
  if (s.onTransfer) {
    s.onTransfer({ from: fc.l, to: tc.l, amt: route.amt, cur: route.cur, id: Date.now() + Math.random() });
  }
}

// ── Update all active transfers ──
function updateTransfers(dt, s) {
  s.transfers = s.transfers.filter(a => {
    const path = a.path, len = path.length;
    const bl = a.arcSys.userData.baseLine;
    const gl = a.arcSys.userData.glowLine;
    const gdl = a.arcSys.userData.gradLine;

    if (a.phase === 'draw') {
      a.progress += dt * 0.85;
      if (a.progress >= 1) { a.progress = 0; a.phase = 'travel'; }
      const cnt = Math.floor(a.progress * len);
      bl.geometry.setDrawRange(0, cnt);
      gl.geometry.setDrawRange(0, cnt);
      gdl.geometry.setDrawRange(Math.floor(len * 0.6), Math.max(0, cnt - Math.floor(len * 0.6)));
    } else if (a.phase === 'travel') {
      a.progress += dt * 0.38;
      if (a.progress >= 1) { a.progress = 1; a.phase = 'arrive'; a.arriveT = 0; }
      bl.geometry.setDrawRange(0, len);
      gl.geometry.setDrawRange(0, len);
      gdl.geometry.setDrawRange(Math.floor(len * 0.6), len - Math.floor(len * 0.6));

      const ease = a.progress < 0.5 ? 4 * a.progress ** 3 : 1 - (-2 * a.progress + 2) ** 3 / 2;
      const idx = Math.min(Math.floor(ease * (len - 1)), len - 1);
      const pos = path[idx];
      a.particle.position.copy(pos);

      const hist = a.particle.userData.history;
      hist.unshift(pos.clone());
      if (hist.length > a.particle.userData.tc) hist.pop();
      const tArr = a.particle.userData.trail.geometry.attributes.position.array;
      const t2Arr = a.particle.userData.trail2.geometry.attributes.position.array;
      for (let i = 0; i < a.particle.userData.tc; i++) {
        if (i < hist.length) {
          tArr[i * 3] = hist[i].x; tArr[i * 3 + 1] = hist[i].y; tArr[i * 3 + 2] = hist[i].z;
          t2Arr[i * 3] = hist[i].x; t2Arr[i * 3 + 1] = hist[i].y; t2Arr[i * 3 + 2] = hist[i].z;
        }
      }
      a.particle.userData.trail.geometry.attributes.position.needsUpdate = true;
      a.particle.userData.trail2.geometry.attributes.position.needsUpdate = true;

      const p = 1 + Math.sin(performance.now() * 0.008) * 0.3;
      a.particle.children[0].scale.setScalar(p);
      a.particle.children[1].scale.setScalar(p * 1.3);
      a.particle.children[2].scale.setScalar(p * 1.6);
    } else if (a.phase === 'arrive') {
      a.arriveT += dt;
      bl.geometry.setDrawRange(0, len);
      gl.geometry.setDrawRange(0, len);
      gdl.geometry.setDrawRange(Math.floor(len * 0.6), len - Math.floor(len * 0.6));
      a.particle.children.forEach(c => { if (c.material && c.material.transparent) c.material.opacity *= 0.92; });
      if (a.arriveT > 0.8) {
        mkBurst(a.tp, s);
        a.phase = 'fade';
        a.fadeOut = 0;
      }
    } else if (a.phase === 'fade') {
      a.fadeOut += dt;
      // Fade everything out over 2 seconds
      const opacity = Math.max(0, 1 - a.fadeOut / 2);
      a.objs.forEach(o => o.traverse(c => {
        if (c.material) {
          if (c.material.transparent) c.material.opacity = Math.min(c.material.opacity, opacity);
          else { c.material.transparent = true; c.material.opacity = opacity; }
        }
      }));
      if (a.fadeOut > 2.5) {
        // Remove objects
        a.objs.forEach(o => {
          if (o.parent) o.parent.remove(o);
          o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        });
        s.tObjs = s.tObjs.filter(o => !a.objs.includes(o));
        return false;
      }
    }
    return true;
  });
}

function mkBurst(pos, s) {
  const vs = [], ps = [];
  for (let i = 0; i < 60; i++) {
    ps.push(pos.x, pos.y, pos.z);
    vs.push(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar(0.02 + Math.random() * 0.05));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  const b = new THREE.Points(g, new THREE.PointsMaterial({ color: C.pulse, size: 0.014, transparent: true, opacity: 1, sizeAttenuation: true }));
  b.userData = { vs, life: 1 };
  s.GG.add(b); s.bursts.push(b); s.tObjs.push(b);
}

function updateBursts(dt, s) {
  s.bursts = s.bursts.filter(b => {
    b.userData.life -= dt * 0.7;
    if (b.userData.life <= 0) { if (b.parent) b.parent.remove(b); return false; }
    b.material.opacity = b.userData.life;
    const p = b.geometry.attributes.position.array;
    b.userData.vs.forEach((v, i) => { p[i * 3] += v.x * dt; p[i * 3 + 1] += v.y * dt; p[i * 3 + 2] += v.z * dt; });
    b.geometry.attributes.position.needsUpdate = true;
    return true;
  });
}

function updateFX(s) {
  const time = performance.now() * 0.001;
  s.tObjs.forEach(o => o.traverse(c => {
    if (c.userData?.isPulse) {
      c.userData.pulsePhase += 0.04;
      const idx = c.userData.pulseIdx || 0;
      const sc = 1 + Math.sin(c.userData.pulsePhase) * (0.5 + idx * 0.3);
      c.scale.setScalar(sc);
      c.material.opacity = Math.max(0, 0.4 - idx * 0.1 - Math.sin(c.userData.pulsePhase) * 0.2);
    }
    if (c.userData?.isFloat) {
      c.position.copy(c.userData.floatBase.clone().add(c.userData.floatDir.clone().multiplyScalar(Math.sin(time * 2) * 0.008)));
      c.rotation.y = time * 1.5;
    }
  }));
}
