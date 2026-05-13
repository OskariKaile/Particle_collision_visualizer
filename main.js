// ----- Constants ---------------------------------------------
const B_FIELD = 3.8;
const DETECTOR = {
  beampipe: 0.06,
  tracker:  { inner: 0.06, outer: 1.20 },
  ecal:     { inner: 1.29, outer: 1.77 },
  hcal:     { inner: 1.77, outer: 2.95 },
  solenoid: { inner: 2.95, outer: 3.80 },
  muon:     { inner: 4.00, outer: 7.00 },
  halfLen:  6.5
};

// Particle catalog
const P = {
  electron:  { id:'electron', name:'electron',     sym:'e⁻',  mass:0.000511, charge:-1, color:0x00ffcc, kind:'electron' },
  positron:  { id:'positron', name:'positron',     sym:'e⁺',  mass:0.000511, charge:+1, color:0x00ffcc, kind:'electron' },
  muminus:   { id:'muminus',  name:'muon',         sym:'μ⁻',  mass:0.10566,  charge:-1, color:0xff4f88, kind:'muon' },
  muplus:    { id:'muplus',   name:'antimuon',     sym:'μ⁺',  mass:0.10566,  charge:+1, color:0xff4f88, kind:'muon' },
  photon:    { id:'photon',   name:'photon',       sym:'γ',   mass:0,        charge:0,  color:0xffe066, kind:'photon' },
  piplus:    { id:'piplus',   name:'pion',         sym:'π⁺',  mass:0.13957,  charge:+1, color:0x6effa6, kind:'chad' },
  piminus:   { id:'piminus',  name:'pion',         sym:'π⁻',  mass:0.13957,  charge:-1, color:0x6effa6, kind:'chad' },
  kplus:     { id:'kplus',    name:'kaon',         sym:'K⁺',  mass:0.49368,  charge:+1, color:0x9effa6, kind:'chad' },
  kminus:    { id:'kminus',   name:'kaon',         sym:'K⁻',  mass:0.49368,  charge:-1, color:0x9effa6, kind:'chad' },
  proton:    { id:'proton',   name:'proton',       sym:'p',   mass:0.93827,  charge:+1, color:0xfd7a33, kind:'chad' },
  apron:     { id:'apron',    name:'antiproton',   sym:'p̄',   mass:0.93827,  charge:-1, color:0xfd7a33, kind:'chad' },
  neutron:   { id:'neutron',  name:'neutron',      sym:'n',   mass:0.93957,  charge:0,  color:0xaebbcc, kind:'nhad' },
  klong:     { id:'klong',    name:'K-long',       sym:'K⁰',  mass:0.49761,  charge:0,  color:0xaebbcc, kind:'nhad' }
};

// ----- Three.js bootstrap ------------------------------------
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020610, 0.018);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(11, 6, 11);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// ----- Minimal orbit controls (no external dep) --------------
class OrbitCam {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 0, 0);
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.scale = 1;
    this.panOffset = new THREE.Vector3();
    this.minDistance = 3;
    this.maxDistance = 60;
    this.minPolar = 0.05;
    this.maxPolar = Math.PI - 0.05;
    this.dampingFactor = 0.08;
    this.rotateSpeed = 1;
    this.zoomSpeed = 0.95;
    this.panSpeed = 1;
    this.autoRotate = true;
    this.autoRotateSpeed = 0.0008;
    this._state = 'NONE';
    this._mouseStart = new THREE.Vector2();
    this._mouseEnd = new THREE.Vector2();
    this._panStart = new THREE.Vector2();
    this._panEnd = new THREE.Vector2();
    this._bind();
  }
  _bind() {
    this.dom.addEventListener('contextmenu', e => e.preventDefault());
    this.dom.addEventListener('pointerdown', e => this._onDown(e));
    this.dom.addEventListener('wheel', e => this._onWheel(e), { passive: false });
    this.dom.addEventListener('pointermove', e => this._onMove(e));
    window.addEventListener('pointerup', () => this._state = 'NONE');
  }
  _onDown(e) {
    if (e.shiftKey || e.button === 2) {
      this._state = 'PAN';
      this._panStart.set(e.clientX, e.clientY);
    } else {
      this._state = 'ROTATE';
      this._mouseStart.set(e.clientX, e.clientY);
      this.autoRotate = false;
    }
  }
  _onMove(e) {
    if (this._state === 'ROTATE') {
      this._mouseEnd.set(e.clientX, e.clientY);
      const dx = this._mouseEnd.x - this._mouseStart.x;
      const dy = this._mouseEnd.y - this._mouseStart.y;
      this.sphericalDelta.theta -= 2 * Math.PI * dx / this.dom.clientHeight * this.rotateSpeed;
      this.sphericalDelta.phi -= 2 * Math.PI * dy / this.dom.clientHeight * this.rotateSpeed;
      this._mouseStart.copy(this._mouseEnd);
    } else if (this._state === 'PAN') {
      this._panEnd.set(e.clientX, e.clientY);
      const dx = this._panEnd.x - this._panStart.x;
      const dy = this._panEnd.y - this._panStart.y;
      this._pan(dx, dy);
      this._panStart.copy(this._panEnd);
    }
  }
  _onWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0) this.scale /= this.zoomSpeed;
    else this.scale *= this.zoomSpeed;
  }
  _pan(dx, dy) {
    const offset = new THREE.Vector3();
    offset.copy(this.camera.position).sub(this.target);
    const dist = offset.length();
    const factor = 2 * Math.tan(this.camera.fov / 2 * Math.PI / 180) * dist / this.dom.clientHeight;
    const v = new THREE.Vector3();
    v.setFromMatrixColumn(this.camera.matrix, 0); v.multiplyScalar(-dx * factor * this.panSpeed);
    this.panOffset.add(v);
    v.setFromMatrixColumn(this.camera.matrix, 1); v.multiplyScalar(dy * factor * this.panSpeed);
    this.panOffset.add(v);
  }
  setFromCamera() {
    const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
    this.spherical.setFromVector3(offset);
  }
  update() {
    const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
    this.spherical.setFromVector3(offset);
    if (this.autoRotate) this.sphericalDelta.theta -= this.autoRotateSpeed;
    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;
    this.spherical.phi = Math.max(this.minPolar, Math.min(this.maxPolar, this.spherical.phi));
    this.spherical.radius *= this.scale;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
    this.target.add(this.panOffset);
    offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    this.sphericalDelta.theta *= 1 - this.dampingFactor;
    this.sphericalDelta.phi *= 1 - this.dampingFactor;
    this.scale = 1 + (this.scale - 1) * (1 - this.dampingFactor);
    this.panOffset.multiplyScalar(1 - this.dampingFactor);
  }
}

const controls = new OrbitCam(camera, renderer.domElement);

// ----- Helper: build a cylinder shell wireframe --------------
function makeShell(rInner, rOuter, halfLen, color, opacity, segments = 48) {
  const group = new THREE.Group();
  const ringMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  for (const r of [rInner, rOuter]) {
    for (const z of [-halfLen, halfLen]) {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(g, ringMat));
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    for (const r of [rOuter]) {
      const pts = [
        new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), -halfLen),
        new THREE.Vector3(r * Math.cos(a), r * Math.sin(a),  halfLen)
      ];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(g, ringMat));
    }
  }
  return group;
}

// ----- Build detector geometry -------------------------------
function buildDetector() {
  const root = new THREE.Group();

  const gridMat = new THREE.LineBasicMaterial({ color: 0x0a2030, transparent: true, opacity: 0.25, depthWrite: false });
  for (let r = 1; r <= 7; r++) {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    root.add(new THREE.Line(g, gridMat));
  }

  const bp = new THREE.Mesh(
    new THREE.CylinderGeometry(DETECTOR.beampipe, DETECTOR.beampipe, DETECTOR.halfLen * 2, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  );
  bp.rotation.x = Math.PI / 2;
  root.add(bp);

  root.add(makeShell(DETECTOR.tracker.inner, DETECTOR.tracker.outer, DETECTOR.halfLen * 0.7, 0x1a4060, 0.5, 48));

  const ecalMat = new THREE.MeshBasicMaterial({
    color: 0x1a6080, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false
  });
  const ecalGeo = new THREE.CylinderGeometry(DETECTOR.ecal.outer, DETECTOR.ecal.outer, DETECTOR.halfLen * 1.4, 64, 1, true);
  const ecal = new THREE.Mesh(ecalGeo, ecalMat);
  ecal.rotation.x = Math.PI / 2;
  root.add(ecal);
  root.add(makeShell(DETECTOR.ecal.inner, DETECTOR.ecal.outer, DETECTOR.halfLen * 0.85, 0x2a7090, 0.35, 64));

  root.add(makeShell(DETECTOR.hcal.inner, DETECTOR.hcal.outer, DETECTOR.halfLen * 1.0, 0x1a4060, 0.25, 32));
  root.add(makeShell(DETECTOR.muon.inner, DETECTOR.muon.outer, DETECTOR.halfLen * 1.2, 0x40557a, 0.18, 24));

  const ecMat = new THREE.LineBasicMaterial({ color: 0x2a7090, transparent: true, opacity: 0.2, depthWrite: false });
  for (const z of [-DETECTOR.halfLen, DETECTOR.halfLen]) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const pts = [
        new THREE.Vector3(DETECTOR.tracker.outer * Math.cos(a), DETECTOR.tracker.outer * Math.sin(a), z),
        new THREE.Vector3(DETECTOR.muon.outer * Math.cos(a), DETECTOR.muon.outer * Math.sin(a), z)
      ];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      root.add(new THREE.Line(g, ecMat));
    }
  }

  const beamMat = new THREE.LineDashedMaterial({
    color: 0x00ffcc, transparent: true, opacity: 0.35, dashSize: 0.15, gapSize: 0.1
  });
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -DETECTOR.halfLen * 1.4),
    new THREE.Vector3(0, 0,  DETECTOR.halfLen * 1.4)
  ]);
  const beamLine = new THREE.Line(beamGeo, beamMat);
  beamLine.computeLineDistances();
  root.add(beamLine);

  return root;
}

scene.add(buildDetector());

// ----- Background star/dust field ----------------------------
(function makeStarfield() {
  const N = 600;
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 30 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3+2] = r * Math.cos(phi);
    const b = 0.3 + Math.random() * 0.7;
    colors[i*3] = b * 0.4;
    colors[i*3+1] = b * 0.7;
    colors[i*3+2] = b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.05, transparent: true, opacity: 0.6, vertexColors: true,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(geo, mat));
})();

// ----- Track generation (helical in B-field) -----------------
function generateHelixPoints(p, vertex, maxRadius, numSteps = 220) {
  const { pT, eta, phi, charge } = p;
  const tanLambda = Math.sinh(eta);
  const R = pT > 0.05 ? pT / (0.3 * B_FIELD) : 1e6;
  const sign = charge >= 0 ? 1 : -1;
  const cx = vertex.x + sign * R * Math.sin(phi);
  const cy = vertex.y - sign * R * Math.cos(phi);
  const alpha0 = Math.atan2(vertex.y - cy, vertex.x - cx);
  const points = [];
  const maxArc = Math.min(R * Math.PI * 1.8, 25);

  for (let i = 0; i <= numSteps; i++) {
    const s = (i / numSteps) * maxArc;
    const alpha = alpha0 - sign * s / R;
    const x = cx + R * Math.cos(alpha);
    const y = cy + R * Math.sin(alpha);
    const z = vertex.z + s * tanLambda;
    const r = Math.hypot(x, y);
    if (r > maxRadius) {
      if (points.length > 0) {
        const prev = points[points.length - 1];
        const pr = Math.hypot(prev.x, prev.y);
        const t = (maxRadius - pr) / (r - pr);
        points.push(new THREE.Vector3(
          prev.x + t * (x - prev.x),
          prev.y + t * (y - prev.y),
          prev.z + t * (z - prev.z)
        ));
      }
      break;
    }
    if (Math.abs(z) > DETECTOR.halfLen * 1.4) break;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

// Straight line for neutrals
function generateStraightPoints(p, vertex, maxRadius) {
  const { eta, phi } = p;
  const theta = 2 * Math.atan(Math.exp(-eta));
  const dir = new THREE.Vector3(
    Math.sin(theta) * Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(theta)
  );
  const dxy = Math.hypot(dir.x, dir.y);
  let tCyl = Infinity, tEnd = Infinity;
  if (dxy > 1e-6) {
    const a = dir.x*dir.x + dir.y*dir.y;
    const b = 2 * (vertex.x*dir.x + vertex.y*dir.y);
    const c = vertex.x*vertex.x + vertex.y*vertex.y - maxRadius*maxRadius;
    const disc = b*b - 4*a*c;
    if (disc > 0) tCyl = (-b + Math.sqrt(disc)) / (2*a);
  }
  if (Math.abs(dir.z) > 1e-6) {
    const zMax = Math.sign(dir.z) * DETECTOR.halfLen * 1.4;
    tEnd = (zMax - vertex.z) / dir.z;
  }
  const t = Math.min(tCyl, tEnd);
  const end = new THREE.Vector3(
    vertex.x + t * dir.x,
    vertex.y + t * dir.y,
    vertex.z + t * dir.z
  );
  return [vertex.clone(), end];
}

// ----- Event generators (LHC physics-inspired) ---------------
function rand(min, max) { return min + Math.random() * (max - min); }
function randn() {
  const u1 = Math.max(1e-9, Math.random());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random());
}
function randEta(maxEta) { return rand(-maxEta, maxEta); }
function randPhi() { return Math.random() * Math.PI * 2; }

function genJet(centralPt, centralEta, centralPhi, vertex) {
  const particles = [];
  const nProng = Math.min(18, Math.max(4, Math.round(rand(4, 12))));
  const coneR = 0.15;
  let totalPt = 0;
  for (let i = 0; i < nProng; i++) {
    const dEta = randn() * coneR * 0.5;
    const dPhi = randn() * coneR * 0.5;
    const frac = Math.pow(Math.random(), 1.5);
    const pt = centralPt * frac * (1 / nProng) * rand(0.5, 2.5);
    if (pt < 0.4) continue;
    totalPt += pt;
    const r = Math.random();
    let type;
    if (r < 0.55) type = Math.random() < 0.5 ? P.piplus : P.piminus;
    else if (r < 0.70) type = Math.random() < 0.5 ? P.kplus : P.kminus;
    else if (r < 0.92) type = P.photon;
    else type = Math.random() < 0.5 ? P.neutron : P.klong;
    particles.push({
      type, pT: pt, eta: centralEta + dEta, phi: centralPhi + dPhi,
      charge: type.charge, jet: true, vertex: vertex.clone()
    });
  }
  return { particles, jetPt: centralPt, jetEta: centralEta, jetPhi: centralPhi };
}

const EVENT_TYPES = [
  {
    id: 'higgs4l',
    label: 'H → ZZ → 4ℓ',
    sub: 'Higgs boson candidate',
    generate() {
      const vertex = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.4, 0.4));
      const particles = [];
      const z1phi = randPhi();
      const z1eta = randn() * 1.0;
      particles.push({ type: P.electron, pT: rand(35, 70), eta: z1eta + randn()*0.4, phi: z1phi + rand(-0.4, 0.4), charge: -1, vertex: vertex.clone() });
      particles.push({ type: P.positron, pT: rand(20, 45), eta: z1eta + randn()*0.4, phi: z1phi + Math.PI + rand(-0.4, 0.4), charge: +1, vertex: vertex.clone() });
      const z2phi = z1phi + Math.PI + rand(-0.6, 0.6);
      const z2eta = randn() * 1.0;
      particles.push({ type: P.muminus, pT: rand(20, 50), eta: z2eta + randn()*0.4, phi: z2phi + rand(-0.4, 0.4), charge: -1, vertex: vertex.clone() });
      particles.push({ type: P.muplus,  pT: rand(15, 35), eta: z2eta + randn()*0.4, phi: z2phi + Math.PI + rand(-0.4, 0.4), charge: +1, vertex: vertex.clone() });
      addPileup(particles, vertex, 35);
      return { particles, jets: [], met: { pT: rand(2, 12), phi: randPhi() }, vertex, name: 'H → ZZ* → 4ℓ', sub: 'Golden channel candidate, mH ≈ 125 GeV' };
    }
  },
  {
    id: 'hgg',
    label: 'H → γγ',
    sub: 'diphoton Higgs candidate',
    generate() {
      const vertex = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.5, 0.5));
      const particles = [];
      const phi1 = randPhi();
      particles.push({ type: P.photon, pT: rand(45, 80), eta: randn() * 1.2, phi: phi1, charge: 0, vertex: vertex.clone() });
      particles.push({ type: P.photon, pT: rand(35, 65), eta: randn() * 1.2, phi: phi1 + Math.PI + rand(-0.3, 0.3), charge: 0, vertex: vertex.clone() });
      addPileup(particles, vertex, 50);
      return { particles, jets: [], met: { pT: rand(3, 10), phi: randPhi() }, vertex, name: 'H → γγ', sub: 'Diphoton resonance, mH ≈ 125 GeV' };
    }
  },
  {
    id: 'zmumu',
    label: 'Z → μμ',
    sub: 'Drell-Yan dimuon',
    generate() {
      const vertex = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.5, 0.5));
      const particles = [];
      const phi1 = randPhi();
      const eta1 = randn() * 0.8;
      particles.push({ type: P.muminus, pT: rand(40, 85), eta: eta1, phi: phi1, charge: -1, vertex: vertex.clone() });
      particles.push({ type: P.muplus,  pT: rand(40, 85), eta: -eta1 + randn()*0.3, phi: phi1 + Math.PI + rand(-0.1, 0.1), charge: +1, vertex: vertex.clone() });
      addPileup(particles, vertex, 45);
      return { particles, jets: [], met: { pT: rand(2, 8), phi: randPhi() }, vertex, name: 'Z → μ⁺μ⁻', sub: 'Drell-Yan, mZ ≈ 91 GeV' };
    }
  },
  {
    id: 'wenu',
    label: 'W → eν',
    sub: 'leptonic W decay',
    generate() {
      const vertex = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.5, 0.5));
      const particles = [];
      const elphi = randPhi();
      particles.push({ type: P.electron, pT: rand(35, 65), eta: randn() * 1.2, phi: elphi, charge: -1, vertex: vertex.clone() });
      addPileup(particles, vertex, 55);
      return { particles, jets: [], met: { pT: rand(30, 55), phi: elphi + Math.PI + rand(-0.1, 0.1) }, vertex, name: 'W⁻ → e⁻ν̄ₑ', sub: 'Single lepton + missing ET' };
    }
  },
  {
    id: 'ttbar',
    label: 't t̄ → ℓ+jets',
    sub: 'top-antitop production',
    generate() {
      const vertex = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.6, 0.6));
      const particles = [];
      const jets = [];
      const elphi = randPhi();
      particles.push({ type: P.muminus, pT: rand(30, 60), eta: randn() * 1.0, phi: elphi, charge: -1, vertex: vertex.clone() });
      const jetPhis = [];
      for (let i = 0; i < 4; i++) jetPhis.push(elphi + Math.PI * 0.5 + i * Math.PI * 0.5 + rand(-0.4, 0.4));
      const jetPts = [rand(70, 120), rand(50, 90), rand(40, 70), rand(35, 60)];
      for (let i = 0; i < 4; i++) {
        const jeta = randn() * 1.3;
        const jet = genJet(jetPts[i], jeta, jetPhis[i], vertex);
        particles.push(...jet.particles);
        jets.push(jet);
      }
      addPileup(particles, vertex, 60);
      return { particles, jets, met: { pT: rand(35, 55), phi: elphi + Math.PI + rand(-0.3, 0.3) }, vertex, name: 'tt̄ → ℓν + 4j', sub: 'Semileptonic top-antitop' };
    }
  },
  {
    id: 'dijet',
    label: 'QCD dijet',
    sub: 'back-to-back jets',
    generate() {
      const vertex = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.4, 0.4));
      const particles = [];
      const jets = [];
      const j1phi = randPhi();
      const j1eta = randn() * 1.5;
      const j1pt = rand(180, 320);
      const j1 = genJet(j1pt, j1eta, j1phi, vertex);
      const j2 = genJet(rand(150, 290), -j1eta + randn()*0.3, j1phi + Math.PI + rand(-0.05, 0.05), vertex);
      particles.push(...j1.particles, ...j2.particles);
      jets.push(j1, j2);
      if (Math.random() < 0.4) {
        const j3 = genJet(rand(40, 80), randn() * 1.2, randPhi(), vertex);
        particles.push(...j3.particles);
        jets.push(j3);
      }
      addPileup(particles, vertex, 40);
      return { particles, jets, met: { pT: rand(5, 18), phi: randPhi() }, vertex, name: 'QCD Dijet', sub: 'Hard-scattered partons → hadronic jets' };
    }
  },
  {
    id: 'jpsi',
    label: 'J/ψ → μμ',
    sub: 'low-mass dimuon',
    generate() {
      const vertex = new THREE.Vector3(rand(-0.05, 0.05), rand(-0.05, 0.05), rand(-1.0, 1.0));
      const particles = [];
      const phi1 = randPhi();
      const eta1 = randn() * 1.5;
      particles.push({ type: P.muminus, pT: rand(4, 12), eta: eta1, phi: phi1, charge: -1, vertex: vertex.clone() });
      particles.push({ type: P.muplus,  pT: rand(3, 10), eta: eta1 + randn()*0.5, phi: phi1 + rand(0.2, 1.4), charge: +1, vertex: vertex.clone() });
      addPileup(particles, vertex, 80);
      return { particles, jets: [], met: { pT: rand(1, 6), phi: randPhi() }, vertex, name: 'J/ψ → μ⁺μ⁻', sub: 'Low-pT dimuon, m ≈ 3.1 GeV' };
    }
  },
  {
    id: 'minbias',
    label: 'Minimum bias',
    sub: 'soft inelastic pp',
    generate() {
      const vertex = new THREE.Vector3(rand(-0.04, 0.04), rand(-0.04, 0.04), rand(-1.0, 1.0));
      const particles = [];
      addPileup(particles, vertex, 120);
      return { particles, jets: [], met: { pT: rand(1, 5), phi: randPhi() }, vertex, name: 'Min. Bias pp', sub: 'Soft inelastic scattering' };
    }
  }
];

function addPileup(particles, vertex, count) {
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let type;
    if (r < 0.55) type = Math.random() < 0.5 ? P.piplus : P.piminus;
    else if (r < 0.70) type = Math.random() < 0.5 ? P.kplus : P.kminus;
    else if (r < 0.85) type = P.photon;
    else if (r < 0.93) type = Math.random() < 0.5 ? P.neutron : P.klong;
    else type = Math.random() < 0.5 ? P.proton : P.apron;
    const pt = Math.exp(rand(Math.log(0.3), Math.log(8)));
    particles.push({
      type, pT: pt, eta: randEta(2.4), phi: randPhi(),
      charge: type.charge, vertex: vertex.clone()
    });
  }
}

// ----- Render an event ---------------------------------------
const eventGroup = new THREE.Group();
scene.add(eventGroup);

let currentEvent = null;
let trackObjects = [];
let calorimeterObjects = [];
let jetObjects = [];
let metObject = null;
let vertexMarker = null;
let animationProgress = 0;
let animationDuration = 2.2;
let animationSpeed = 1.0;
let lastTime = performance.now();
let filterState = {
  electron: true, muon: true, photon: true,
  chad: true, nhad: true, jet: true, met: true
};

function clearEvent() {
  while (eventGroup.children.length) {
    const o = eventGroup.children[0];
    eventGroup.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  }
  trackObjects = [];
  calorimeterObjects = [];
  jetObjects = [];
  metObject = null;
  vertexMarker = null;
}

function renderEvent(evt) {
  clearEvent();
  currentEvent = evt;
  animationProgress = 0;

  function outerR(p) {
    if (p.type.kind === 'muon') return DETECTOR.muon.outer;
    return DETECTOR.ecal.outer;
  }

  for (const p of evt.particles) {
    const k = p.type.kind;
    const r = outerR(p);
    let pts;
    if (Math.abs(p.charge) > 0 && p.pT > 0.2) {
      pts = generateHelixPoints(p, p.vertex, r);
    } else {
      pts = generateStraightPoints(p, p.vertex, r);
    }
    if (pts.length < 2) continue;

    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      positions[i*3] = pts[i].x;
      positions[i*3+1] = pts[i].y;
      positions[i*3+2] = pts[i].z;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setDrawRange(0, 0);

    const isJetTrack = !!p.jet;
    const isHighPt = p.pT > 15;
    const baseColor = new THREE.Color(p.type.color);
    const opacity = isJetTrack ? 0.55 : (isHighPt ? 1.0 : 0.85);

    const mat = new THREE.LineBasicMaterial({
      color: baseColor, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 1
    });
    const line = new THREE.Line(geom, mat);
    eventGroup.add(line);

    let glow = null;
    if (isHighPt && !isJetTrack && pts.length >= 4) {
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, Math.min(80, pts.length * 2), 0.018, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: baseColor, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      glow = new THREE.Mesh(tubeGeo, tubeMat);
      eventGroup.add(glow);
    }

    trackObjects.push({
      line, glow, particle: p, kind: k, points: pts,
      totalSegments: pts.length, charged: Math.abs(p.charge) > 0
    });

    const endpoint = pts[pts.length - 1];
    if (endpoint && (k === 'electron' || k === 'photon' || k === 'chad' || k === 'nhad')) {
      addCaloDeposit(endpoint, p);
    }
  }

  for (const jet of (evt.jets || [])) {
    const theta = 2 * Math.atan(Math.exp(-jet.jetEta));
    const dir = new THREE.Vector3(
      Math.sin(theta) * Math.cos(jet.jetPhi),
      Math.sin(theta) * Math.sin(jet.jetPhi),
      Math.cos(theta)
    );
    const length = Math.min(4.5, 1.5 + jet.jetPt / 60);
    const radius = 0.5 + jet.jetPt / 250;
    const coneGeo = new THREE.ConeGeometry(radius, length, 24, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfd7a33, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    const mid = dir.clone().multiplyScalar(length / 2);
    cone.position.copy(evt.vertex).add(mid);
    cone.lookAt(evt.vertex.clone().add(dir.clone().multiplyScalar(length)));
    cone.rotateX(Math.PI / 2);
    eventGroup.add(cone);

    const wireGeo = new THREE.ConeGeometry(radius, length, 16, 1, true);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xfd7a33, transparent: true, opacity: 0, depthWrite: false
    });
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(wireGeo), wireMat);
    wire.position.copy(cone.position);
    wire.rotation.copy(cone.rotation);
    eventGroup.add(wire);

    jetObjects.push({ cone, wire, data: jet });
  }

  if (evt.met && evt.met.pT > 5) {
    const dir = new THREE.Vector3(Math.cos(evt.met.phi), Math.sin(evt.met.phi), 0);
    const length = Math.min(6, 1 + evt.met.pT / 12);
    const start = evt.vertex.clone();
    const end = start.clone().add(dir.clone().multiplyScalar(length));

    const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xb894ff, transparent: true, opacity: 0,
      dashSize: 0.15, gapSize: 0.08, depthWrite: false
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    eventGroup.add(line);

    const headGeo = new THREE.ConeGeometry(0.15, 0.4, 12);
    const headMat = new THREE.MeshBasicMaterial({
      color: 0xb894ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.copy(end);
    head.lookAt(end.clone().add(dir));
    head.rotateX(Math.PI / 2);
    eventGroup.add(head);

    metObject = { line, head, data: evt.met };
  }

  const vGeo = new THREE.SphereGeometry(0.06, 16, 16);
  const vMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending
  });
  vertexMarker = new THREE.Mesh(vGeo, vMat);
  vertexMarker.position.copy(evt.vertex);
  eventGroup.add(vertexMarker);

  const vGlowGeo = new THREE.SphereGeometry(0.18, 16, 16);
  const vGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const vGlow = new THREE.Mesh(vGlowGeo, vGlowMat);
  vGlow.position.copy(evt.vertex);
  eventGroup.add(vGlow);

  updateInfoPanels(evt);
  applyFilters();
}

function addCaloDeposit(endpoint, p) {
  const isEM = p.type.kind === 'electron' || p.type.kind === 'photon';
  const isHad = p.type.kind === 'chad' || p.type.kind === 'nhad';
  if (!isEM && !isHad) return;

  const dir = endpoint.clone().normalize();
  const rIn = isEM ? DETECTOR.ecal.inner : DETECTOR.hcal.inner;
  const startR = Math.max(rIn, endpoint.length() - 0.05);

  const energy = p.pT * Math.cosh(p.eta);
  const height = Math.min(0.9, 0.05 + energy / 80);
  if (height < 0.04 && !p.jet) return;

  const start = dir.clone().multiplyScalar(startR);
  const end = dir.clone().multiplyScalar(startR + height);

  const towerWidth = isEM ? 0.04 : 0.07;
  const boxGeo = new THREE.BoxGeometry(towerWidth, towerWidth, height);
  const color = isEM ? (p.type.kind === 'photon' ? 0xffe066 : 0x00ffcc) : 0xfd7a33;
  const boxMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  boxMat.userData = { targetOpacity: 0.65 };
  const tower = new THREE.Mesh(boxGeo, boxMat);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  tower.position.copy(mid);
  tower.lookAt(end);
  eventGroup.add(tower);
  calorimeterObjects.push({ mesh: tower, particle: p });
}

// ----- UI update --------------------------------------------
function updateInfoPanels(evt) {
  const eta = evt.particles.reduce((s, p) => s + p.pT * Math.cosh(p.eta), 0);
  const counts = { electron:0, muon:0, photon:0, chad:0, nhad:0, jet:(evt.jets||[]).length, met: evt.met && evt.met.pT > 10 ? 1 : 0 };
  for (const p of evt.particles) {
    if (counts[p.type.kind] !== undefined) counts[p.type.kind]++;
  }

  document.getElementById('ei-title').textContent = evt.name;
  document.getElementById('ei-run').textContent = currentRun;
  document.getElementById('ei-evt').textContent = currentEvtId;
  document.getElementById('ei-set').innerHTML = `${eta.toFixed(1)}<span class="unit">GeV</span>`;
  document.getElementById('ei-met').innerHTML = `${(evt.met?evt.met.pT:0).toFixed(1)}<span class="unit">GeV</span>`;
  document.getElementById('ei-np').textContent = evt.particles.length;
  document.getElementById('ei-nj').textContent = (evt.jets||[]).length;
  document.getElementById('ei-nv').textContent = '1';

  for (const k of Object.keys(counts)) {
    const el = document.getElementById('lc-' + k);
    if (el) el.textContent = counts[k].toString().padStart(3, '0');
  }

  const sorted = [...evt.particles].sort((a, b) => b.pT - a.pT);
  const interesting = sorted.filter(p =>
    p.type.kind === 'electron' || p.type.kind === 'muon' ||
    (p.type.kind === 'photon' && p.pT > 10) ||
    p.pT > 5
  ).slice(0, 28);

  const body = document.getElementById('pl-body');
  body.innerHTML = '';
  for (const p of interesting) {
    const row = document.createElement('div');
    row.className = 'particle-row';
    const cssColor = '#' + p.type.color.toString(16).padStart(6, '0');
    row.innerHTML = `
      <span class="marker" style="background:${cssColor};color:${cssColor}"></span>
      <span class="name">${p.type.sym}</span>
      <span class="pt">${p.pT.toFixed(1)}</span>
      <span class="eta">${p.eta.toFixed(2)}</span>
    `;
    row.addEventListener('mouseenter', () => showTooltipForParticle(p));
    row.addEventListener('mouseleave', hideTooltip);
    body.appendChild(row);
  }
}

function applyFilters() {
  for (const t of trackObjects) {
    const visible = filterState[t.kind];
    t.line.visible = visible;
    if (t.glow) t.glow.visible = visible;
  }
  for (const c of calorimeterObjects) {
    c.mesh.visible = filterState[c.particle.type.kind];
  }
  for (const j of jetObjects) {
    j.cone.visible = filterState.jet;
    j.wire.visible = filterState.jet;
  }
  if (metObject) {
    metObject.line.visible = filterState.met;
    metObject.head.visible = filterState.met;
  }
}

// ----- Animate track draw -----------------------------------
function updateTrackAnimation(dt) {
  if (animationProgress >= 1) return;
  animationProgress = Math.min(1, animationProgress + (dt / animationDuration) * animationSpeed);
  const eased = 1 - Math.pow(1 - animationProgress, 3);
  for (const t of trackObjects) {
    const drawCount = Math.floor(t.totalSegments * eased);
    t.line.geometry.setDrawRange(0, Math.max(2, drawCount));
  }
  const fadeIn = Math.max(0, Math.min(1, (eased - 0.55) / 0.35));
  for (const c of calorimeterObjects) {
    c.mesh.material.opacity = fadeIn * (c.particle.jet ? 0.45 : 0.7);
  }
  const jetFade = Math.max(0, Math.min(1, (eased - 0.45) / 0.35));
  for (const j of jetObjects) {
    j.cone.material.opacity = jetFade * 0.06;
    j.wire.material.opacity = jetFade * 0.4;
  }
  if (metObject) {
    metObject.line.material.opacity = jetFade * 0.85;
    metObject.head.material.opacity = jetFade * 0.95;
  }
}

// ----- Event browser ----------------------------------------
let currentEventIndex = 0;
let currentRun = 297050;
let currentEvtId = 0;

function loadEventByIndex(idx) {
  currentEventIndex = (idx + EVENT_TYPES.length) % EVENT_TYPES.length;
  const def = EVENT_TYPES[currentEventIndex];
  currentRun = 297050 + Math.floor(Math.random() * 25);
  currentEvtId = 240000000 + Math.floor(Math.random() * 99999999);
  const evt = def.generate();
  renderEvent(evt);
  document.querySelectorAll('.pill').forEach((el, i) => {
    el.classList.toggle('active', i === currentEventIndex);
  });
}

// ----- UI bindings ------------------------------------------
function initUI() {
  const pillContainer = document.getElementById('event-pills');
  EVENT_TYPES.forEach((evt, i) => {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.innerHTML = `<div style="color:var(--text);font-weight:500">${evt.label}</div><div style="font-size:8px;color:var(--text-dim);margin-top:1px">${evt.sub}</div>`;
    btn.addEventListener('click', () => loadEventByIndex(i));
    pillContainer.appendChild(btn);
  });

  document.getElementById('btn-prev').addEventListener('click', () => loadEventByIndex(currentEventIndex - 1));
  document.getElementById('btn-next').addEventListener('click', () => loadEventByIndex(currentEventIndex + 1));
  document.getElementById('btn-replay').addEventListener('click', () => {
    animationProgress = 0;
    for (const t of trackObjects) t.line.geometry.setDrawRange(0, 0);
    for (const c of calorimeterObjects) c.mesh.material.opacity = 0;
    for (const j of jetObjects) {
      j.cone.material.opacity = 0;
      j.wire.material.opacity = 0;
    }
    if (metObject) {
      metObject.line.material.opacity = 0;
      metObject.head.material.opacity = 0;
    }
  });

  document.querySelectorAll('.legend-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.dataset.type;
      filterState[type] = !filterState[type];
      item.classList.toggle('muted', !filterState[type]);
      applyFilters();
    });
  });

  const slider = document.getElementById('speed-slider');
  const speedVal = document.getElementById('speed-val');
  slider.addEventListener('input', e => {
    animationSpeed = parseFloat(e.target.value);
    speedVal.textContent = animationSpeed.toFixed(1) + '×';
  });

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      controls.autoRotate = false;
      const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
      const dist = offset.length();
      if (v === '3d') {
        camera.position.set(11, 6, 11);
        controls.autoRotate = true;
      } else if (v === 'rphi') {
        camera.position.set(0, 0, dist);
      } else if (v === 'rz') {
        camera.position.set(0, dist * 0.9, 0.5);
      }
      camera.lookAt(controls.target);
      controls.setFromCamera();
    });
  });
}

// ----- Tooltip ----------------------------------------------
const tooltip = document.getElementById('tooltip');
function showTooltipForParticle(p) {
  tooltip.style.display = 'block';
  tooltip.querySelector('.ttype').textContent = `${p.type.sym}  (${p.type.name})`;
  tooltip.querySelector('.ttype').style.color = '#' + p.type.color.toString(16).padStart(6, '0');
  const rows = tooltip.querySelectorAll('.trow .v');
  rows[0].textContent = p.pT.toFixed(2) + ' GeV';
  rows[1].textContent = p.eta.toFixed(3);
  rows[2].textContent = p.phi.toFixed(3) + ' rad';
  rows[3].textContent = (p.pT * Math.cosh(p.eta)).toFixed(2) + ' GeV';
  rows[4].textContent = p.charge === 0 ? '0' : (p.charge > 0 ? '+1' : '−1');
}
function hideTooltip() {
  tooltip.style.display = 'none';
}
document.addEventListener('mousemove', e => {
  if (tooltip.style.display !== 'none') {
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top = (e.clientY + 14) + 'px';
  }
});

// ----- Resize handling --------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----- Main loop --------------------------------------------
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updateTrackAnimation(dt);
  controls.update();
  if (vertexMarker) {
    const s = 1 + 0.15 * Math.sin(now * 0.004);
    vertexMarker.scale.setScalar(s);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ----- Boot -------------------------------------------------
function boot() {
  initUI();
  loadEventByIndex(0);
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 800);
  loop();
}

boot();

// ----- Hint key lighting ------------------------------------
(function () {
  const kbdDrag   = document.getElementById('hint-drag');
  const kbdScroll = document.getElementById('hint-scroll');
  const kbdShift  = document.getElementById('hint-shift');
  let scrollTimer = null;

  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.shiftKey || e.button === 2) {
      kbdShift.classList.add('is-pressed');
    } else {
      kbdDrag.classList.add('is-pressed');
    }
  });

  window.addEventListener('pointerup', () => {
    kbdDrag.classList.remove('is-pressed');
    kbdShift.classList.remove('is-pressed');
  });

  renderer.domElement.addEventListener('wheel', () => {
    kbdScroll.classList.add('is-pressed');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => kbdScroll.classList.remove('is-pressed'), 350);
  }, { passive: true });
})();
