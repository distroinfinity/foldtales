import { AdditiveBlending, CapsuleGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, ShaderMaterial, SphereGeometry, Vector3, type Object3D, type Texture } from '@iwsdk/core';

/**
 * The first-run lesson for the ribbon, shown and not told (docs/plans/2026-11-16-hands-and-controls.md):
 * a pale ghost of a hand comes down, touches the ribbon's tail, and lifts away, a few times, then rests.
 * It plays until the first time you use the ribbon. No words.
 *
 * The hand is the "point" pose from IWER's hand library (MIT, Meta Platforms), drawn as soft capsules
 * between its joints, once, with a light rim like tracing paper held to a lamp.
 */

/** Joint positions (metres, the pose's own frame) and radii: IWER `pointHandPose`, iwer@2.8.0, MIT. */
const JOINTS: Record<string, [number, number, number, number]> = {
  wrist: [-0.0579, 0.0167, 0.1118, 0.0215],
  'thumb-metacarpal': [-0.0165, 0.0127, 0.0886, 0.0194],
  'thumb-phalanx-proximal': [0.0131, 0.0125, 0.0752, 0.0123],
  'thumb-phalanx-distal': [0.0415, 0.016, 0.0572, 0.0098],
  'thumb-tip': [0.0655, 0.0168, 0.0517, 0.0088],
  'index-finger-metacarpal': [-0.0259, 0.02, 0.0848, 0.0212],
  'index-finger-phalanx-proximal': [-0.0016, 0.0431, 0.0347, 0.0103],
  'index-finger-phalanx-intermediate': [0.014, 0.0528, 0.0015, 0.0085],
  'index-finger-phalanx-distal': [0.0235, 0.0563, -0.0206, 0.0076],
  'index-finger-tip': [0.031, 0.0628, -0.0407, 0.0066],
  'middle-finger-metacarpal': [-0.0418, 0.0225, 0.0818, 0.0212],
  'middle-finger-phalanx-proximal': [-0.0221, 0.0504, 0.0297, 0.0112],
  'middle-finger-phalanx-intermediate': [-0.0172, 0.0226, -0.0027, 0.008],
  'middle-finger-phalanx-distal': [-0.0217, -0.0006, 0.0115, 0.0076],
  'middle-finger-tip': [-0.0244, -0.0027, 0.0363, 0.0066],
  'ring-finger-metacarpal': [-0.0594, 0.0265, 0.0748, 0.0191],
  'ring-finger-phalanx-proximal': [-0.0425, 0.0467, 0.0277, 0.0099],
  'ring-finger-phalanx-intermediate': [-0.0375, 0.0163, 0.0039, 0.0076],
  'ring-finger-phalanx-distal': [-0.0381, -0.0021, 0.0231, 0.0072],
  'ring-finger-tip': [-0.0391, 0.0042, 0.0467, 0.0062],
  'pinky-finger-metacarpal': [-0.0672, 0.0242, 0.0714, 0.0181],
  'pinky-finger-phalanx-proximal': [-0.0627, 0.0386, 0.0283, 0.0085],
  'pinky-finger-phalanx-intermediate': [-0.0543, 0.0139, 0.0121, 0.0068],
  'pinky-finger-phalanx-distal': [-0.0517, 0.0014, 0.0279, 0.0064],
  'pinky-finger-tip': [-0.051, 0.0085, 0.0487, 0.0054],
};
const CHAINS = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'].map((f) =>
  f === 'thumb'
    ? ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
    : ['wrist', `${f}-metacarpal`, `${f}-phalanx-proximal`, `${f}-phalanx-intermediate`, `${f}-phalanx-distal`, `${f}-tip`],
);
/** Across the palm, so it reads as one hand and not five sticks. */
const PALM = [
  ['index-finger-phalanx-proximal', 'middle-finger-phalanx-proximal'],
  ['middle-finger-phalanx-proximal', 'ring-finger-phalanx-proximal'],
  ['ring-finger-phalanx-proximal', 'pinky-finger-phalanx-proximal'],
  ['index-finger-metacarpal', 'pinky-finger-metacarpal'],
  ['thumb-metacarpal', 'index-finger-phalanx-proximal'],
];

const j = (name: string) => new Vector3(JOINTS[name]![0], JOINTS[name]![1], JOINTS[name]![2]);
const r = (name: string) => JOINTS[name]![3];

/** The loop, in ms: arrive, come down, touch, lift, fade, rest. */
const LOOP_MS = 3400;
const T = { in: 450, down: 1250, press: 1550, up: 2150, out: 2650 };
/** Played this many times in a row, then rests this long before showing again. */
const RUN = 3;
const REST_MS = 40000;
const FIRST_DELAY_MS = 7000;
const ORDER = 905;

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

export interface GhostHandDeps {
  scene: Object3D;
  /** A soft round glow, for the ripple where the finger touches. */
  glow: Texture;
  /** Review builds: loop without resting, from the start. */
  always?: boolean;
}

export function createGhostHand(deps: GhostHandDeps) {
  const root = new Group();
  root.name = 'ghost-hand';
  root.visible = false;
  root.renderOrder = ORDER;
  deps.scene.add(root);
  const hand = new Group();
  hand.renderOrder = ORDER;
  root.add(hand);

  // Two passes: depth first, then colour where it's nearest, so overlapping capsules don't darken.
  const depthOnly = new MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true });
  const ghost = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: { opacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.6);
        vec3 paper = vec3(0.93, 0.88, 0.80);
        vec3 lamp = vec3(0.98, 0.80, 0.45);
        gl_FragColor = vec4(mix(paper, lamp, rim * 0.7), opacity * (0.5 + 0.45 * rim));
      }`,
  });

  const pieces: Array<{ a: Vector3; b: Vector3; radius: number }> = [];
  for (const chain of CHAINS) for (let i = 1; i < chain.length; i++) pieces.push({ a: j(chain[i - 1]!), b: j(chain[i]!), radius: Math.min(r(chain[i - 1]!), r(chain[i]!) * 1.25) * 0.82 });
  for (const [a, b] of PALM) pieces.push({ a: j(a!), b: j(b!), radius: 0.012 });
  const up = new Vector3(0, 1, 0);
  for (const { a, b, radius } of pieces) {
    const length = a.distanceTo(b);
    const geometry = new CapsuleGeometry(radius, Math.max(0.001, length), 4, 10);
    const q = new Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    for (const [material, order] of [[depthOnly, ORDER], [ghost, ORDER + 1]] as const) {
      const mesh = new Mesh(geometry, material);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.copy(q);
      mesh.renderOrder = order;
      hand.add(mesh);
    }
  }
  const palmCentre = j('middle-finger-metacarpal').lerp(j('ring-finger-phalanx-proximal'), 0.5);
  for (const [material, order] of [[depthOnly, ORDER], [ghost, ORDER + 1]] as const) {
    const palm = new Mesh(new SphereGeometry(0.03, 14, 10), material);
    palm.position.copy(palmCentre);
    palm.scale.set(1.15, 0.55, 1.2);
    palm.renderOrder = order;
    hand.add(palm);
  }

  // The pose's own directions: the index finger's line, and the back of the hand.
  const tip = j('index-finger-tip');
  const finger = tip.clone().sub(j('index-finger-phalanx-proximal')).normalize();
  const across = j('index-finger-metacarpal').sub(j('pinky-finger-metacarpal')).normalize();
  const back = new Vector3().crossVectors(across, finger).normalize();
  const poseBasis = new Matrix4().makeBasis(finger, back, new Vector3().crossVectors(finger, back));

  // The ripple where the finger touches: a little lamp-light on the page.
  const ripple = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: deps.glow, color: '#F2C66B', transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: AdditiveBlending, toneMapped: false }));
  ripple.rotation.x = -Math.PI / 2;
  ripple.renderOrder = ORDER - 1;
  root.add(ripple);

  let wanted = false;
  /** Time into the current run of loops; null while resting or hidden. */
  let runMs: number | null = null;
  let restMs = 0;
  const contact = new Vector3();
  const towardYou = new Vector3();
  const worldBasis = new Matrix4();
  const rot = new Quaternion();

  /** Places the hand so its fingertip is `lift` metres back along its line from the contact point. */
  function pose(lift: number, scale: number): void {
    hand.quaternion.copy(rot);
    hand.scale.setScalar(scale);
    const tipWorld = tip.clone().multiplyScalar(scale).applyQuaternion(rot);
    const along = finger.clone().applyQuaternion(rot);
    hand.position.copy(contact).sub(tipWorld).addScaledVector(along, -lift);
  }

  return {
    /** Whether the lesson should be playing now (the story on, the book open, the ribbon never used). */
    set wanted(on: boolean) {
      if (on && !wanted) {
        // The first showing waits a few seconds, so the book's opening has the stage to itself.
        runMs = null;
        restMs = deps.always ? REST_MS : REST_MS - FIRST_DELAY_MS;
      }
      wanted = on;
    },
    get wanted() {
      return wanted;
    },
    get playing(): boolean {
      return root.visible;
    },
    /** Review builds: where its fingertip and wrist are now. */
    get debug() {
      hand.updateWorldMatrix(true, false);
      const r3 = (v: Vector3) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));
      return { tip: r3(hand.localToWorld(tip.clone())), wrist: r3(hand.localToWorld(j('wrist'))), opacity: +(ghost.uniforms.opacity!.value as number).toFixed(2) };
    },
    /**
     * `ribbon`: the ribbon's tail on the page; `head`: your eyes. The hand comes from your side, finger
     * angled down onto the ribbon, palm down, at the size of a hand.
     */
    frame(deltaMs: number, ribbon: Vector3, head: Vector3, bookScale: number): void {
      if (!wanted) {
        root.visible = false;
        return;
      }
      if (runMs === null) {
        restMs += deltaMs;
        if (restMs < REST_MS) {
          root.visible = false;
          return;
        }
        runMs = 0;
      }
      runMs += deltaMs;
      if (runMs >= RUN * LOOP_MS && !deps.always) {
        runMs = null;
        restMs = 0;
        root.visible = false;
        return;
      }
      root.visible = true;
      const t = runMs % LOOP_MS;
      // The finger comes from your side and a little to the right, angled 50° down.
      towardYou.set(head.x - ribbon.x, 0, head.z - ribbon.z).normalize();
      const right = new Vector3().crossVectors(up, towardYou).normalize();
      const fingerDir = towardYou.clone().multiplyScalar(-Math.cos(0.87)).addScaledVector(up, -Math.sin(0.87)).addScaledVector(right, -0.18).normalize();
      // The back of the hand faces up and toward you.
      const backDir = up.clone().sub(fingerDir.clone().multiplyScalar(up.dot(fingerDir))).normalize();
      worldBasis.makeBasis(fingerDir, backDir, new Vector3().crossVectors(fingerDir, backDir));
      rot.setFromRotationMatrix(worldBasis.multiply(poseBasis.clone().transpose()));
      // The joint sits a fingertip's radius above the paper it touches.
      contact.copy(ribbon).add(new Vector3(0, 0.007, 0));
      const lift = t < T.in ? 0.09 : t < T.down ? 0.09 * (1 - smooth((t - T.in) / (T.down - T.in))) : t < T.press ? -0.004 * Math.sin((Math.PI * (t - T.down)) / (T.press - T.down)) : t < T.up ? 0.09 * smooth((t - T.press) / (T.up - T.press)) : 0.09;
      pose(lift, 1);
      const fade = t < T.in ? smooth(t / T.in) : t < T.up ? 1 : t < T.out ? 1 - smooth((t - T.up) / (T.out - T.up)) : 0;
      ghost.uniforms.opacity!.value = fade * 0.9;
      // The touch: a small warm ripple on the page, growing and fading.
      const since = t - T.down;
      const k = since > 0 && since < 700 ? since / 700 : -1;
      ripple.visible = k >= 0;
      if (k >= 0) {
        ripple.position.copy(ribbon).add(new Vector3(0, 0.003, 0));
        ripple.scale.setScalar((0.03 + 0.05 * k) * bookScale);
        (ripple.material as MeshBasicMaterial).opacity = 0.7 * (1 - k);
      }
    },
    dispose(): void {
      deps.scene.remove(root);
    },
  };
}
export type GhostHand = ReturnType<typeof createGhostHand>;
