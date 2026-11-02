// THROWAWAY SPIKE. Answers: can IWSDK on Quest 3 hold frame rate with paper puppets over
// passthrough, does air drawing feel right, is the table found, does the mic work in session,
// and do strokes become a moving puppet in about 2 s? Results are posted to the dev server.
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  createSystem,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from '@iwsdk/core';

const MAX_BONES = 8;
const INK_WIDTH = 0.005;
const STEP_FPS = 10; // Stop-motion stepping for all puppet motion.

type Hand = 'left' | 'right';
type Joint = { id: number; part: string; x: number; y: number; parent: number };
type Read = { label?: string; locomotion?: string; name?: string; joints?: Joint[]; role?: string };

function report(kind: string, data: Record<string, unknown> = {}): void {
  void fetch('/api/telemetry', {
    method: 'POST',
    body: JSON.stringify({ kind, t: Math.round(performance.now()), ...data }),
  }).catch(() => undefined);
}

// One Euro filter: steady when slow, responsive when fast.
class OneEuro {
  private x = new Vector3();
  private dx = new Vector3();
  private ready = false;
  private next = new Vector3();
  constructor(
    private minCutoff = 1.4,
    private beta = 6,
  ) {}
  private alpha(cutoff: number, dt: number): number {
    return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  }
  reset(): void {
    this.ready = false;
  }
  filter(p: Vector3, dt: number): Vector3 {
    if (!this.ready) {
      this.x.copy(p);
      this.dx.set(0, 0, 0);
      this.ready = true;
      return this.x;
    }
    this.next.copy(p).sub(this.x).divideScalar(Math.max(dt, 1e-3));
    this.dx.lerp(this.next, this.alpha(1, dt));
    this.x.lerp(p, this.alpha(this.minCutoff + this.beta * this.dx.length(), dt));
    return this.x;
  }
}

const inkMaterial = (color: number): ShaderMaterial =>
  new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      bones: { value: Array.from({ length: MAX_BONES }, () => new Matrix4()) },
      color: { value: new Color(color) },
    },
    vertexShader: `
      uniform mat4 bones[${MAX_BONES}];
      attribute vec2 boneIdx;
      attribute vec2 boneWgt;
      attribute float edge;
      varying float vEdge;
      void main() {
        mat4 skin = bones[int(boneIdx.x)] * boneWgt.x + bones[int(boneIdx.y)] * boneWgt.y;
        vEdge = edge;
        gl_Position = projectionMatrix * modelViewMatrix * skin * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 color;
      varying float vEdge;
      void main() {
        if (abs(vEdge) > 0.92) discard;
        gl_FragColor = vec4(color, 1.0);
      }`,
  });

// Strokes in a puppet's local plane, as ribbons skinned to up to MAX_BONES bones.
class Puppet {
  readonly group = new Group();
  readonly material: ShaderMaterial;
  private geometry = new BufferGeometry();
  private flat: Float32Array;
  private strokeEnds: number[];
  private joints: Joint[] = [];
  private rest: Vector3[] = [];
  private world: Matrix4[] = [];
  private phase = Math.random() * 10;
  locomotion = 'hop';
  state: 'idle' | 'gait' | 'rigged' = 'idle';
  private home = new Vector3();
  private tmpA = new Matrix4();
  private tmpB = new Matrix4();
  private tmpC = new Matrix4();

  // points: local xy, stroke by stroke.
  constructor(strokes: number[][], color = 0x1c1a17) {
    this.material = inkMaterial(color);
    const total = strokes.reduce((n, s) => n + s.length / 2, 0);
    const pos = new Float32Array(total * 2 * 3);
    const edge = new Float32Array(total * 2);
    const idx: number[] = [];
    this.flat = new Float32Array(total * 2);
    this.strokeEnds = [];
    let v = 0;
    for (const s of strokes) {
      const n = s.length / 2;
      for (let i = 0; i < n; i++) {
        const a = Math.max(i - 1, 0);
        const b = Math.min(i + 1, n - 1);
        let tx = s[b * 2] - s[a * 2];
        let ty = s[b * 2 + 1] - s[a * 2 + 1];
        const len = Math.hypot(tx, ty) || 1;
        tx /= len;
        ty /= len;
        const x = s[i * 2];
        const y = s[i * 2 + 1];
        this.flat[v * 2] = x;
        this.flat[v * 2 + 1] = y;
        pos.set([x - ty * INK_WIDTH, y + tx * INK_WIDTH, 0, x + ty * INK_WIDTH, y - tx * INK_WIDTH, 0], v * 6);
        edge[v * 2] = -1;
        edge[v * 2 + 1] = 1;
        if (i < n - 1) {
          const p = v * 2;
          idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
        }
        v++;
      }
      this.strokeEnds.push(v);
    }
    this.geometry.setAttribute('position', new BufferAttribute(pos, 3));
    this.geometry.setAttribute('edge', new BufferAttribute(edge, 1));
    this.geometry.setAttribute('boneIdx', new BufferAttribute(new Float32Array(total * 4), 2));
    const wgt = new Float32Array(total * 4);
    for (let i = 0; i < total * 2; i++) wgt[i * 2] = 1;
    this.geometry.setAttribute('boneWgt', new BufferAttribute(wgt, 2));
    this.geometry.setIndex(idx);
    const mesh = new Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  setHome(p: Vector3): void {
    this.home.copy(p);
  }

  // Bones are drawn from joint to parent. Each vertex takes the nearest two, softly.
  setRig(joints: Joint[], toLocal: (x: number, y: number) => [number, number]): void {
    const usable = joints.slice(0, MAX_BONES);
    const ids = new Map(usable.map((j, i) => [j.id, i]));
    this.joints = usable.map((j) => ({ ...j, parent: ids.get(j.parent) ?? -1 }));
    this.rest = usable.map((j) => {
      const [x, y] = toLocal(j.x, j.y);
      return this.snapToInk(x, y);
    });
    this.world = usable.map(() => new Matrix4());
    const n = this.flat.length / 2;
    const idx = this.geometry.getAttribute('boneIdx') as BufferAttribute;
    const wgt = this.geometry.getAttribute('boneWgt') as BufferAttribute;
    for (let v = 0; v < n; v++) {
      const x = this.flat[v * 2];
      const y = this.flat[v * 2 + 1];
      let b0 = 0;
      let d0 = Infinity;
      let b1 = 0;
      let d1 = Infinity;
      for (let j = 0; j < this.joints.length; j++) {
        const d = this.boneDistance(j, x, y);
        if (d < d0) {
          b1 = b0;
          d1 = d0;
          b0 = j;
          d0 = d;
        } else if (d < d1) {
          b1 = j;
          d1 = d;
        }
      }
      const w0 = d1 === Infinity ? 1 : Math.pow(d1, 2) / (Math.pow(d0, 2) + Math.pow(d1, 2) + 1e-9);
      for (const k of [v * 2, v * 2 + 1]) {
        idx.setXY(k, b0, b1);
        wgt.setXY(k, w0, 1 - w0);
      }
    }
    idx.needsUpdate = true;
    wgt.needsUpdate = true;
    this.state = 'rigged';
  }

  private snapToInk(x: number, y: number): Vector3 {
    let best = 0;
    let bestD = Infinity;
    for (let v = 0; v < this.flat.length / 2; v += 2) {
      const d = (this.flat[v * 2] - x) ** 2 + (this.flat[v * 2 + 1] - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return new Vector3(this.flat[best * 2], this.flat[best * 2 + 1], 0);
  }

  private boneDistance(j: number, x: number, y: number): number {
    const a = this.rest[j];
    const p = this.joints[j].parent;
    if (p < 0) return Math.hypot(x - a.x, y - a.y) * 1.5;
    const b = this.rest[p];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy + 1e-9)));
    return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
  }

  update(time: number, camera: Vector3): void {
    const t = Math.floor(time * STEP_FPS) / STEP_FPS + this.phase;
    const g = this.group;
    const loco = this.locomotion;
    let x = 0;
    let y = 0;
    if (loco === 'fly') {
      x = Math.sin(t * 0.7) * 0.08;
      y = 0.14 + Math.sin(t * 1.9) * 0.03;
    } else if (loco === 'hop') {
      y = Math.abs(Math.sin(t * 3)) * 0.05;
    } else if (loco === 'walk') {
      x = Math.sin(t * 0.5) * 0.08;
      y = Math.abs(Math.sin(t * 5)) * 0.008;
    } else if (loco === 'slither') {
      x = Math.sin(t * 0.5) * 0.08;
    } else if (loco === 'roll') {
      x = Math.sin(t * 0.6) * 0.1;
    } else if (loco === 'sail') {
      x = Math.sin(t * 0.4) * 0.08;
      y = Math.sin(t * 1.3) * 0.006;
    }
    g.position.set(this.home.x + x, this.home.y + y, this.home.z);
    // Paper-theater cutout: yaw toward the viewer, stay upright.
    g.rotation.set(0, Math.atan2(camera.x - g.position.x, camera.z - g.position.z), 0);
    if (loco === 'sway' || loco === 'static') g.rotation.z = Math.sin(t * 1.4) * (loco === 'sway' ? 0.05 : 0.015);
    else g.rotation.z = Math.sin(t * 5) * 0.03;
    const bones = this.material.uniforms.bones.value as Matrix4[];
    if (this.state !== 'rigged') {
      for (const b of bones) b.identity();
      return;
    }
    for (let i = 0; i < this.joints.length; i++) {
      const j = this.joints[i];
      const p = this.rest[i];
      this.tmpA.makeTranslation(p.x, p.y, 0);
      this.tmpB.makeRotationZ(this.angle(j.part, i, t));
      this.tmpC.makeTranslation(-p.x, -p.y, 0);
      const m = this.world[i].copy(this.tmpA).multiply(this.tmpB).multiply(this.tmpC);
      if (j.parent >= 0 && j.parent < i) m.premultiply(this.world[j.parent]);
      bones[i].copy(m);
    }
  }

  private angle(part: string, i: number, t: number): number {
    const side = i % 2 === 0 ? 1 : -1;
    switch (part) {
      case 'wing': return Math.sin(t * 7) * 0.55 * side;
      case 'leg': return Math.sin(t * 7 + i * Math.PI) * 0.45;
      case 'arm': return Math.sin(t * 4 + i) * 0.3;
      case 'tail': return Math.sin(t * 4 + i) * 0.35;
      case 'head': case 'neck': return Math.sin(t * 1.7) * 0.12;
      case 'jaw': return Math.max(0, Math.sin(t * 3)) * 0.25;
      case 'spine': return this.locomotion === 'slither' ? Math.sin(t * 4 + i * 1.2) * 0.3 : Math.sin(t * 2 + i) * 0.04;
      default: return Math.sin(t * 2 + i) * 0.05;
    }
  }

  get vertexCount(): number {
    return this.flat.length;
  }
}

// A synthetic scribble with a rig, using the same path as a real doodle, for load testing.
function loadPuppet(): Puppet {
  const strokes: number[][] = [];
  for (let s = 0; s < 6; s++) {
    const pts: number[] = [];
    const cx = (Math.random() - 0.5) * 0.08;
    const cy = (Math.random() - 0.5) * 0.08;
    for (let i = 0; i < 160; i++) {
      const a = i * 0.12 + s;
      const r = 0.015 + 0.04 * Math.abs(Math.sin(a * 1.3 + s));
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    strokes.push(pts);
  }
  const p = new Puppet(strokes, 0x2b2622);
  p.locomotion = ['walk', 'fly', 'hop', 'slither'][Math.floor(Math.random() * 4)];
  p.setRig(
    [
      { id: 0, part: 'root', x: 0.5, y: 0.5, parent: -1 },
      { id: 1, part: 'head', x: 0.5, y: 0.2, parent: 0 },
      { id: 2, part: 'wing', x: 0.2, y: 0.4, parent: 0 },
      { id: 3, part: 'wing', x: 0.8, y: 0.4, parent: 0 },
      { id: 4, part: 'leg', x: 0.35, y: 0.85, parent: 0 },
      { id: 5, part: 'leg', x: 0.65, y: 0.85, parent: 0 },
      { id: 6, part: 'tail', x: 0.95, y: 0.7, parent: 0 },
    ],
    (x, y) => [(x - 0.5) * 0.14, (0.5 - y) * 0.14],
  );
  return p;
}

// Paper set pieces and a book, standing in for the real stage.
function paperTexture(tint: string, label: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = tint;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(90,70,40,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 3, 1);
  }
  g.fillStyle = '#3a2f25';
  g.font = '28px serif';
  g.fillText(label, 12, 40);
  return new CanvasTexture(c);
}

class Hud {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 340;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.mesh = new Mesh(new PlaneGeometry(0.3, 0.2), new MeshBasicMaterial({ map: this.texture, transparent: true, side: DoubleSide }));
  }
  draw(lines: string[]): void {
    const g = this.ctx;
    g.clearRect(0, 0, 512, 340);
    g.fillStyle = 'rgba(250,244,230,0.94)';
    g.fillRect(0, 0, 512, 340);
    g.fillStyle = '#231c15';
    g.font = '21px sans-serif';
    lines.forEach((l, i) => g.fillText(l.slice(0, 46), 12, 28 + i * 25));
    this.texture.needsUpdate = true;
  }
}

class Button {
  readonly mesh: Mesh;
  private cooldown = 0;
  constructor(
    label: string,
    readonly action: () => void,
    color: string,
  ) {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 100;
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    g.fillRect(0, 0, 200, 100);
    g.fillStyle = '#fff';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.fillText(label, 100, 62);
    this.mesh = new Mesh(new PlaneGeometry(0.07, 0.035), new MeshBasicMaterial({ map: new CanvasTexture(c), side: DoubleSide }));
  }
  private world = new Vector3();
  poke(tips: Vector3[], now: number): void {
    this.mesh.getWorldPosition(this.world);
    if (now < this.cooldown) return;
    for (const t of tips) {
      if (t.distanceTo(this.world) < 0.028) {
        this.cooldown = now + 0.8;
        this.action();
        return;
      }
    }
  }
}

export class SpikeSystem extends createSystem({}) {
  private root = new Group();
  private stage = new Group();
  private load = new Group();
  private loadPuppets: Puppet[] = [];
  private puppets: Puppet[] = [];
  private hud = new Hud();
  private buttons: Button[] = [];
  private loadLevel = 0;
  private tips: Vector3[] = [new Vector3(), new Vector3()];
  private camPos = new Vector3();

  // Drawing.
  private drawing: Record<Hand, boolean> = { left: false, right: false };
  private filters: Record<Hand, OneEuro> = { left: new OneEuro(), right: new OneEuro() };
  private strokes: Vector3[][] = [];
  private live?: { mesh: Mesh; pos: Float32Array; count: number; hand: Hand; last: Vector3 };
  private liveMeshes: Mesh[] = [];
  private inkLive = new MeshBasicMaterial({ color: 0x1c1a17, side: DoubleSide });
  private finishTimer = 0;
  private pendingDoodle = false;
  private thumb = new Vector3();
  private stageCam = new Vector3();
  private doodleStatus = 'draw: pinch and trace, then open hand';

  // Metrics.
  private frames = 0;
  private windowStart = 0;
  private worst = 0;
  private fps = 0;
  private over14 = 0;
  private lastHud = 0;
  private lastSend = 0;
  private lastT = 0;

  // Environment.
  private planesSeen = 0;
  private meshesSeen = 0;
  private labels: string[] = [];
  private placedBy = 'none';
  private lastPlacedBy = '';
  private frameErrors = 0;
  private sessionAt = 0;
  private handTips: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  private grabHand: Hand | null = null;
  private grabOffset = new Vector3();
  private spineLocal = new Vector3();
  private placed = false;
  private fan: Array<{ source: XRHitTestSource }> = [];
  private fanHits: Vector3[] = [];
  private fanStarted = false;

  // Audio.
  private micState = 'off';
  private micLevel = 0;
  private micPeak = 0;
  private micRecording = false;
  private micClips = 0;
  private micClipStart = 0;
  private micLevels: number[] = [];
  private analyser?: AnalyserNode;
  private audio?: AudioContext;
  private micBuf = new Float32Array(1024);
  private hidden = 0;
  private sessionSeen = false;

  init(): void {
    this.scene.add(this.root);
    this.root.add(this.stage);
    this.stage.add(this.load);
    const bookL = new Mesh(new PlaneGeometry(0.22, 0.3), new MeshBasicMaterial({ map: paperTexture('#efe4cc', 'page'), side: DoubleSide }));
    bookL.rotation.x = -Math.PI / 2;
    bookL.position.x = -0.11;
    const bookR = bookL.clone();
    bookR.position.x = 0.11;
    const spine = new Mesh(new PlaneGeometry(0.035, 0.3), new MeshBasicMaterial({ color: 0x6b3f1f, side: DoubleSide }));
    spine.rotation.x = -Math.PI / 2;
    spine.position.y = 0.004;
    this.stage.add(bookL, bookR, spine);

    this.hud.mesh.position.set(0.36, 0.12, -0.02);
    this.hud.mesh.rotation.y = -0.45;
    this.stage.add(this.hud.mesh);

    const add = (label: string, action: () => void, color: string, x: number, y: number) => {
      const b = new Button(label, action, color);
      b.mesh.position.set(x, y, 0.08);
      b.mesh.rotation.x = -0.9;
      this.stage.add(b.mesh);
      this.buttons.push(b);
    };
    add('LOAD', () => this.cycleLoad(), '#7a4b2b', -0.18, 0.03);
    add('MIC', () => void this.toggleMic(), '#2b6a7a', -0.09, 0.03);
    add('TONE', () => this.tone(), '#556b2f', 0, 0.03);
    add('CLEAR', () => this.clear(), '#8a2b2b', 0.09, 0.03);
    add('MOVE', () => { this.placed = false; this.placeStage(); }, '#444', 0.18, 0.03);

    document.addEventListener('visibilitychange', () => report('page-visibility', { state: document.visibilityState }));
    window.addEventListener('error', (e) => report('error', { message: e.message }));
    window.addEventListener('unhandledrejection', (e) => report('rejection', { message: String(e.reason).slice(0, 300) }));
    report('boot', { ua: navigator.userAgent, sinceNav: Math.round(performance.now()) });
  }

  private onSession(session: XRSession): void {
    this.sessionSeen = true;
    this.sessionAt = performance.now();
    report('session-start', {
      sinceNav: Math.round(performance.now()),
      features: (session as unknown as { enabledFeatures?: string[] }).enabledFeatures ?? null,
      frameRate: session.frameRate ?? null,
      rates: session.supportedFrameRates ? Array.from(session.supportedFrameRates) : null,
    });
    session.addEventListener('visibilitychange', () => {
      if (session.visibilityState !== 'visible') this.hidden++;
      report('session-visibility', { state: session.visibilityState });
    });
    session.addEventListener('end', () => {
      report('session-end');
      this.sessionSeen = false;
      this.fan = [];
      this.fanStarted = false;
      this.placed = false;
    });
    session.addEventListener('selectstart', (e) => this.onSelect(e as XRInputSourceEvent, true));
    session.addEventListener('selectend', (e) => this.onSelect(e as XRInputSourceEvent, false));
    this.placeStage();
  }

  private onSelect(e: XRInputSourceEvent, down: boolean): void {
    const hand = e.inputSource.handedness;
    if (hand !== 'left' && hand !== 'right') return;
    if (e.inputSource.hand === undefined) return;
    if (down) {
      this.spineLocal.copy(this.handTips[hand]);
      this.stage.worldToLocal(this.spineLocal);
      if (Math.abs(this.spineLocal.x) < 0.05 && Math.abs(this.spineLocal.z) < 0.17 && Math.abs(this.spineLocal.y) < 0.08) {
        this.grabHand = hand;
        this.grabOffset.subVectors(this.stage.position, this.handTips[hand]);
        report('stage-grab');
        return;
      }
      if (this.live) return;
      this.beginStroke(hand);
    } else if (this.grabHand === hand) {
      this.grabHand = null;
      this.placed = true;
      this.placedBy = 'moved-by-hand';
      report('stage-moved', { position: this.stage.position.toArray().map((n) => +n.toFixed(3)) });
    } else if (this.live?.hand === hand) {
      this.endStroke(hand);
    }
  }

  // Prefer a table the room knows about; else a raycast hit; else in front of the viewer.
  private placeStage(): void {
    this.camera.getWorldPosition(this.camPos);
    const frame = this.renderer.xr.getFrame() as XRFrame & { detectedPlanes?: Set<XRPlane>; detectedMeshes?: Set<{ semanticLabel?: string; meshSpace: XRSpace }> };
    const space = this.renderer.xr.getReferenceSpace();
    let target: Vector3 | null = null;
    let by = 'fallback-in-front';
    const look = new Vector3(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(new Quaternion()));
    look.y = 0;
    look.normalize();
    const reachable = (x: number, z: number): boolean => {
      const dx = x - this.camPos.x;
      const dz = z - this.camPos.z;
      const d = Math.hypot(dx, dz);
      return d < 1.6 && (dx * look.x + dz * look.z) / (d || 1) > 0.3;
    };
    if (frame && space) {
      let best = Infinity;
      for (const m of frame.detectedMeshes ?? []) {
        if (m.semanticLabel !== 'table') continue;
        const pose = frame.getPose(m.meshSpace, space);
        if (!pose) continue;
        const p = pose.transform.position;
        const d = Math.hypot(p.x - this.camPos.x, p.z - this.camPos.z);
        if (d < best && reachable(p.x, p.z)) {
          best = d;
          target = new Vector3(p.x, p.y, p.z);
          by = 'mesh-table';
        }
      }
      if (!target) {
        for (const pl of frame.detectedPlanes ?? []) {
          const label = (pl as unknown as { semanticLabel?: string }).semanticLabel;
          if (pl.orientation !== 'horizontal' || label === 'floor' || label === 'ceiling') continue;
          const pose = frame.getPose(pl.planeSpace, space);
          if (!pose) continue;
          const p = pose.transform.position;
          if (p.y > this.camPos.y - 0.1) continue;
          const d = Math.hypot(p.x - this.camPos.x, p.z - this.camPos.z);
          if (d < best && reachable(p.x, p.z)) {
            best = d;
            target = new Vector3(p.x, p.y, p.z);
            by = `plane-${label ?? 'unlabelled'}`;
          }
        }
      }
    }
    const near = this.fanHits.filter((h) => Math.hypot(h.x - this.camPos.x, h.z - this.camPos.z) < 0.8 && h.y > 0.35 && h.y < this.camPos.y - 0.1);
    near.sort((a, b) => b.y - a.y);
    for (let i = 0; !target && i < near.length; i++) {
      const cluster = near.filter((h) => Math.abs(h.y - near[i].y) < 0.03);
      if (cluster.length < 3) continue;
      target = new Vector3();
      for (const h of cluster) target.add(h);
      target.divideScalar(cluster.length);
      by = 'hit-test-fan';
    }
    if (!target) {
      const forward = new Vector3(0, 0, -0.45).applyQuaternion(this.camera.getWorldQuaternion(new Quaternion()));
      target = new Vector3(this.camPos.x + forward.x, this.camPos.y - 0.4, this.camPos.z + forward.z);
    }
    this.stage.position.copy(target);
    this.stage.rotation.y = Math.atan2(this.camPos.x - target.x, this.camPos.z - target.z);
    this.placedBy = by;
    this.placed = by !== 'fallback-in-front';
    if (by === this.lastPlacedBy && by === 'fallback-in-front') return;
    this.lastPlacedBy = by;
    report('stage-placed', { by, position: target.toArray().map((n) => +n.toFixed(3)), headY: +this.camPos.y.toFixed(3) });
  }

  private startFan(session: XRSession): void {
    if (this.fanStarted) return;
    this.fanStarted = true;
    void session.requestReferenceSpace('viewer').then((viewer) => {
      const request = session.requestHitTestSource?.bind(session);
      if (!request) {
        report('hit-test', { supported: false });
        return;
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const ray = new XRRay({ x: 0, y: 0, z: 0 }, { x: Math.cos(a) * 0.25, y: -0.5 + Math.sin(a) * 0.12, z: -0.8 });
        void request({ space: viewer, offsetRay: ray })?.then((source) => this.fan.push({ source }));
      }
    }).catch((e) => report('hit-test', { error: String(e) }));
  }

  private sampleFan(frame: XRFrame, space: XRReferenceSpace): void {
    this.fanHits.length = 0;
    for (const { source } of this.fan) {
      const hit = frame.getHitTestResults(source)[0];
      const pose = hit?.getPose(space);
      if (pose) this.fanHits.push(new Vector3(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z));
    }
  }

  private cycleLoad(): void {
    this.loadLevel = (this.loadLevel + 1) % 4;
    for (const p of this.loadPuppets) {
      this.load.remove(p.group);
      p.material.dispose();
    }
    this.loadPuppets = [];
    this.load.clear();
    const flats = [0, 10, 24, 60][this.loadLevel];
    const count = [0, 4, 8, 24][this.loadLevel];
    for (let i = 0; i < flats; i++) {
      const m = new Mesh(new PlaneGeometry(0.05 + Math.random() * 0.06, 0.05 + Math.random() * 0.06), new MeshBasicMaterial({ map: paperTexture(['#dcd0b4', '#c9d6c2', '#d8c2b6'][i % 3], ''), side: DoubleSide }));
      m.position.set((Math.random() - 0.5) * 0.42, 0.04, (Math.random() - 0.5) * 0.25);
      this.load.add(m);
    }
    for (let i = 0; i < count; i++) {
      const p = loadPuppet();
      p.setHome(new Vector3((Math.random() - 0.5) * 0.4, 0.06, (Math.random() - 0.5) * 0.22));
      this.load.add(p.group);
      this.loadPuppets.push(p);
    }
    this.frames = 0;
    this.worst = 0;
    this.over14 = 0;
    this.windowStart = performance.now();
    report('load-level', { level: this.loadLevel, flats, puppets: count });
  }

  private clear(): void {
    for (const p of this.puppets) {
      this.stage.remove(p.group);
      p.material.dispose();
    }
    this.puppets = [];
    for (const m of this.liveMeshes) this.root.remove(m);
    this.liveMeshes = [];
    this.strokes = [];
    this.doodleStatus = 'cleared';
  }

  private tone(): void {
    this.audio ??= new AudioContext();
    void this.audio.resume();
    const o = this.audio.createOscillator();
    const g = this.audio.createGain();
    g.gain.value = 0.15;
    o.frequency.value = 523;
    o.connect(g).connect(this.audio.destination);
    o.start();
    o.stop(this.audio.currentTime + 0.25);
    report('tone', { contextState: this.audio.state });
  }

  private async toggleMic(): Promise<void> {
    if (this.micState === 'asking' || this.micRecording) return;
    this.micState = 'asking';
    const asked = performance.now();
    // A fresh stream per clip, since the old one failed after a pause. Alternate browser voice processing on and off.
    const processed = this.micClips++ % 2 === 0;
    report('mic-ask', { session: this.renderer.xr.getSession()?.visibilityState ?? null, processed });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: processed, noiseSuppression: processed, autoGainControl: processed },
      });
      this.micState = 'on';
      report('mic-granted', { ms: Math.round(performance.now() - asked), session: this.renderer.xr.getSession()?.visibilityState ?? null });
      this.audio ??= new AudioContext();
      await this.audio.resume();
      this.analyser = this.audio.createAnalyser();
      this.analyser.fftSize = 1024;
      this.audio.createMediaStreamSource(stream).connect(this.analyser);
      this.recordClip(stream, processed);
    } catch (e) {
      this.micState = `denied: ${String(e).slice(0, 26)}`;
      report('mic-failed', { error: String(e).slice(0, 200), ms: Math.round(performance.now() - asked) });
    }
  }

  private recordClip(stream: MediaStream, processed: boolean): void {
    const track = stream.getAudioTracks()[0];
    report('mic-track', { state: track?.readyState, muted: track?.muted, label: track?.label, settings: track?.getSettings() });
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      this.micRecording = false;
      this.analyser = undefined;
      for (const t of stream.getTracks()) t.stop();
      report('mic-level', {
        processed,
        peakRms: +this.micPeak.toFixed(4),
        levels: Array.from(this.micLevels, (v) => +(v ?? 0).toFixed(4)),
        session: this.renderer.xr.getSession()?.visibilityState ?? null,
      });
      void fetch('/api/mic', { method: 'POST', body: new Blob(chunks) });
    };
    rec.start();
    this.micRecording = true;
    this.micPeak = 0;
    this.micLevels = [];
    this.micClipStart = performance.now();
    setTimeout(() => rec.stop(), 6000);
  }

  private beginStroke(hand: Hand): void {
    clearTimeout(this.finishTimer);
    this.drawing[hand] = true;
    this.filters[hand].reset();
    const capacity = 1500;
    const pos = new Float32Array(capacity * 2 * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const idx = new Uint16Array((capacity - 1) * 6);
    for (let i = 0; i < capacity - 1; i++) {
      const p = i * 2;
      idx.set([p, p + 1, p + 2, p + 1, p + 3, p + 2], i * 6);
    }
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.setDrawRange(0, 0);
    const mesh = new Mesh(geo, this.inkLive);
    mesh.frustumCulled = false;
    this.root.add(mesh);
    this.liveMeshes.push(mesh);
    this.live = { mesh, pos, count: 0, hand, last: new Vector3() };
    this.strokes.push([]);
    this.doodleStatus = 'drawing...';
  }

  private endStroke(hand: Hand): void {
    this.drawing[hand] = false;
    if (this.live?.hand === hand) this.live = undefined;
    clearTimeout(this.finishTimer);
    this.pendingDoodle = true;
    this.finishTimer = window.setTimeout(() => void this.finishDoodle('pause'), 2500);
  }

  private appendInk(hand: Hand, tip: Vector3, dt: number): void {
    const live = this.live;
    if (!live || live.hand !== hand) return;
    const p = this.filters[hand].filter(tip, dt);
    if (live.count > 0 && p.distanceTo(live.last) < 0.002) return;
    if (live.count >= 1499) return;
    const side = new Vector3().subVectors(p, live.last).cross(new Vector3().subVectors(this.camPos, p)).normalize().multiplyScalar(INK_WIDTH * 0.9);
    const i = live.count * 6;
    live.pos.set([p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z], i);
    (live.mesh.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    live.count++;
    if (live.count > 1) live.mesh.geometry.setDrawRange(0, (live.count - 1) * 6);
    live.last.copy(p);
    this.strokes[this.strokes.length - 1].push(p.clone());
  }

  private async finishDoodle(by: string): Promise<void> {
    if (this.live) return;
    clearTimeout(this.finishTimer);
    this.pendingDoodle = false;
    const strokes = this.strokes.filter((s) => s.length > 2);
    this.strokes = [];
    if (strokes.length === 0) return;
    const finished = performance.now();
    const all = strokes.flat();

    // Fit a plane to the strokes, keeping the image upright for the viewer.
    const center = new Vector3();
    for (const p of all) center.add(p);
    center.divideScalar(all.length);
    const toViewer = new Vector3().subVectors(this.camPos, center).normalize();
    const normal = fitNormal(all, center, toViewer);
    const up = new Vector3(0, 1, 0).addScaledVector(normal, -normal.y);
    if (up.lengthSq() < 0.05) up.set(0, 0, -1).addScaledVector(normal, -normal.z);
    up.normalize();
    const right = new Vector3().crossVectors(up, normal).normalize();
    const flat = strokes.map((s) => s.flatMap((p) => {
      const d = new Vector3().subVectors(p, center);
      return [d.dot(right), d.dot(up)];
    }));

    // Render to a square PNG exactly as the model will see it.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of flat) for (let i = 0; i < s.length; i += 2) {
      minX = Math.min(minX, s[i]); maxX = Math.max(maxX, s[i]);
      minY = Math.min(minY, s[i + 1]); maxY = Math.max(maxY, s[i + 1]);
    }
    const span = Math.max(maxX - minX, maxY - minY, 0.03);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const margin = 30 / 324;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 384;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 384, 384);
    g.strokeStyle = '#000';
    g.lineWidth = 4;
    const toPx = (x: number, y: number): [number, number] => [(30 + ((x - cx) / span + 0.5) * 324), (30 + (0.5 - (y - cy) / span) * 324)];
    for (const s of flat) {
      g.beginPath();
      for (let i = 0; i < s.length; i += 2) {
        const [px, py] = toPx(s[i], s[i + 1]);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    const png = canvas.toDataURL('image/png').split(',')[1];
    void margin;

    // Alive at once: replace the live ink with a puppet in its own strokes.
    for (const m of this.liveMeshes) this.root.remove(m);
    this.liveMeshes = [];
    const puppet = new Puppet(flat);
    puppet.setHome(this.stage.worldToLocal(center.clone()));
    this.stage.add(puppet.group);
    this.puppets.push(puppet);
    const alive = performance.now() - finished;
    this.doodleStatus = `alive ${Math.round(alive)}ms; reading...`;

    const fromImage = (u: number, v: number): [number, number] => [
      ((u * 384 - 30) / 324 - 0.5) * span + cx,
      (0.5 - (v * 384 - 30) / 324) * span + cy,
    ];
    const sent = performance.now();
    let gaitAt = 0;
    let text = '';
    try {
      const res = await fetch('/api/doodle', { method: 'POST', body: png });
      const reader = res.body!.getReader();
      const decode = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decode.decode(value, { stream: true });
        if (!gaitAt) {
          const m = /"locomotion"\s*:\s*"([a-z]+)"/.exec(text);
          if (m) {
            gaitAt = performance.now();
            puppet.locomotion = m[1];
            puppet.state = 'gait';
            const label = /"label"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? '?';
            this.doodleStatus = `${label} / ${m[1]} in ${Math.round(gaitAt - finished)}ms`;
          }
        }
      }
      const read = JSON.parse(text) as Read;
      if (read.joints?.length) puppet.setRig(read.joints, fromImage);
      const riggedAt = performance.now();
      this.doodleStatus = `${read.label}: gait ${Math.round(gaitAt - finished)}ms, rig ${Math.round(riggedAt - finished)}ms`;
      report('doodle', {
        finishedBy: by, strokes: flat.length, verts: puppet.vertexCount,
        aliveMs: Math.round(alive), renderAndSendMs: Math.round(sent - finished),
        gaitMs: Math.round(gaitAt - finished), rigMs: Math.round(riggedAt - finished),
        label: read.label, locomotion: read.locomotion, joints: read.joints?.length, rig: read.joints, alternatives: (read as { alternatives?: string[] }).alternatives, name: read.name, png,
      });
    } catch (e) {
      this.doodleStatus = `read failed: still hopping`;
      report('doodle-failed', { error: String(e).slice(0, 200), textLength: text.length });
    }
  }

  update(delta: number): void {
    try {
      this.frame(delta);
    } catch (e) {
      if (this.frameErrors++ < 5) report('frame-error', { message: String(e).slice(0, 200) });
    }
  }

  private frame(delta: number): void {
    const now = performance.now();
    const time = now / 1000;
    const session = this.renderer.xr.getSession();
    if (session && !this.sessionSeen) this.onSession(session);
    this.camera.getWorldPosition(this.camPos);

    // Frame pacing.
    if (this.lastT) {
      const dt = now - this.lastT;
      this.worst = Math.max(this.worst, dt);
      if (dt > 14.5) this.over14++;
    }
    this.lastT = now;
    this.frames++;
    if (now - this.windowStart > 2000) {
      this.fps = (this.frames * 1000) / (now - this.windowStart);
      if (session) {
        const info = this.renderer.info.render;
        report('perf', {
          fps: +this.fps.toFixed(1), worstMs: +this.worst.toFixed(1), over14: this.over14,
          load: this.loadLevel, puppets: this.puppets.length + this.loadPuppets.length,
          calls: info.calls, tris: info.triangles, target: session.frameRate ?? null, vis: session.visibilityState,
        });
      }
      this.frames = 0;
      this.worst = 0;
      this.over14 = 0;
      this.windowStart = now;
    }

    if (session) {
      const frame = this.renderer.xr.getFrame() as XRFrame & { detectedPlanes?: Set<XRPlane>; detectedMeshes?: Set<{ semanticLabel?: string }> };
      const space = this.renderer.xr.getReferenceSpace();
      if (frame && space) {
        this.startFan(session);
        this.sampleFan(frame, space);
        const planes = frame.detectedPlanes?.size ?? 0;
        const meshes = frame.detectedMeshes?.size ?? 0;
        if (planes !== this.planesSeen || meshes !== this.meshesSeen) {
          this.planesSeen = planes;
          this.meshesSeen = meshes;
          const labels: string[] = [];
          for (const m of frame.detectedMeshes ?? []) labels.push(m.semanticLabel ?? 'none');
          for (const p of frame.detectedPlanes ?? []) labels.push(`p:${(p as unknown as { semanticLabel?: string }).semanticLabel ?? 'none'}`);
          this.labels = labels;
          report('room', { planes, meshes, labels });
          if (!this.placed) this.placeStage();
        }
        const settled = now - this.sessionAt > 1500;
        if (!this.placed && (this.fanHits.length > 5 || settled)) {
          this.placeStage();
          if (settled) this.placed = true;
        }

        let tipCount = 0;
        for (const source of session.inputSources) {
          const hand = source.handedness;
          if (!source.hand || (hand !== 'left' && hand !== 'right')) continue;
          const joint = source.hand.get('index-finger-tip');
          const pose = joint ? frame.getJointPose?.(joint, space) : undefined;
          if (!pose) continue;
          const p = pose.transform.position;
          this.tips[tipCount].set(p.x, p.y, p.z);
          this.handTips[hand].set(p.x, p.y, p.z);
          if (this.grabHand === hand) {
            this.stage.position.addVectors(this.handTips[hand], this.grabOffset);
            this.stage.rotation.y = Math.atan2(this.camPos.x - this.stage.position.x, this.camPos.z - this.stage.position.z);
          }
          if (this.pendingDoodle && !this.drawing.left && !this.drawing.right) {
            const thumbJoint = source.hand.get('thumb-tip');
            const thumbPose = thumbJoint ? frame.getJointPose?.(thumbJoint, space) : undefined;
            if (thumbPose) {
              const q = thumbPose.transform.position;
              this.thumb.set(q.x, q.y, q.z);
              if (this.thumb.distanceTo(this.tips[tipCount]) > 0.08) void this.finishDoodle('open-hand');
            }
          }
          if (this.drawing[hand]) this.appendInk(hand, this.tips[tipCount], delta);
          else tipCount++;
        }
        const tips = this.tips.slice(0, tipCount);
        for (const b of this.buttons) b.poke(tips, time);
      }
    }

    this.stageCam.copy(this.camPos);
    this.stage.worldToLocal(this.stageCam);
    for (const p of this.puppets) p.update(time, this.stageCam);
    for (const p of this.loadPuppets) p.update(time, this.stageCam);

    if (this.analyser) {
      this.analyser.getFloatTimeDomainData(this.micBuf);
      let sum = 0;
      for (let i = 0; i < this.micBuf.length; i++) sum += this.micBuf[i] * this.micBuf[i];
      this.micLevel = Math.sqrt(sum / this.micBuf.length);
      if (this.micRecording) {
        this.micPeak = Math.max(this.micPeak, this.micLevel);
        const slot = Math.floor((performance.now() - this.micClipStart) / 500);
        this.micLevels[slot] = Math.max(this.micLevels[slot] ?? 0, this.micLevel);
      }
    }

    if (now - this.lastHud > 400) {
      this.lastHud = now;
      const info = this.renderer.info.render;
      this.hud.draw([
        `fps ${this.fps.toFixed(0)}  target ${session?.frameRate ?? '?'}  worst ${this.worst.toFixed(0)}ms`,
        `load ${this.loadLevel}  puppets ${this.puppets.length + this.loadPuppets.length}`,
        `calls ${info.calls}  tris ${info.triangles}`,
        `stage: ${this.placedBy}`,
        `room: ${this.planesSeen} planes ${this.meshesSeen} meshes`,
        `  ${this.labels.slice(0, 5).join(',')}`,
        `hit-test fan: ${this.fanHits.length}/12`,
        `mic: ${this.micRecording ? 'RECORDING, TALK' : this.micState} ${this.micState === 'on' ? '#'.repeat(Math.min(20, Math.round(this.micLevel * 200))) : ''}`,
        `hidden count: ${this.hidden}`,
        this.doodleStatus,
        '',
        'Pinch brown spine = move book. Pinch air = draw.',
      ]);
    }
  }
}

// Power iteration on the covariance; the smallest axis is the plane normal.
function fitNormal(points: Vector3[], c: Vector3, toward: Vector3): Vector3 {
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const p of points) {
    const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z;
    xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z;
  }
  const mul = (v: Vector3) => new Vector3(xx * v.x + xy * v.y + xz * v.z, xy * v.x + yy * v.y + yz * v.z, xz * v.x + yz * v.y + zz * v.z);
  let a = new Vector3(1, 0.3, 0.2).normalize();
  for (let i = 0; i < 24; i++) a = mul(a).normalize();
  let b = new Vector3(-0.2, 1, 0.4);
  for (let i = 0; i < 24; i++) {
    b = mul(b);
    b.addScaledVector(a, -b.dot(a)).normalize();
  }
  const n = new Vector3().crossVectors(a, b);
  if (n.lengthSq() < 1e-6) return toward.clone();
  n.normalize();
  return n.dot(toward) < 0 ? n.negate() : n;
}
