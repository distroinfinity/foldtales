/**
 * The book on its table in CSS 3D, drawn from the real art (client/public/web, made by tools/web-art.ts)
 * and the sets' own geometry. One number drives it: `p`, how far you've scrolled through the story.
 * Stage space follows the sets: metres, origin at the spine on the table, +z toward the reader.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import shore from '../../../art/sets/shore-path/set.json';
import lamp from '../../../art/sets/the-lamp/set.json';
import { BOOK_TITLE } from './library.ts';

const W = 0.21;
const D = 0.315;
const THICK = 0.012;
const PIP_H = 0.172;
/** Where Pip's feet sit across the composed image (printed by tools/web-art.ts). */
const PIP_FEET = 0.406;
const PIP_ASPECT = 0.64;
const LANTERN_H = 0.052;

const art = (file: string) => `./web/${file}`;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (v: number) => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2);
/** A pop-up's landing: a slight overshoot, as real card does. */
const pop = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : 1 + 2.2 * Math.pow(v - 1, 3) + 1.2 * Math.pow(v - 1, 2));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The story's moments, as shares of the scroll. Text in story.tsx uses the same marks. */
export const MARKS = {
  tilt: [0.02, 0.12],
  cover: [0.09, 0.24],
  rise: [0.2, 0.34],
  gust: 0.42,
  lookUp: 0.47,
  lift: [0.49, 0.56],
  back: [0.56, 0.61],
  fold: [0.66, 0.72],
  turn: [0.7, 0.79],
  lampRise: [0.77, 0.86],
  lit: 0.87,
  sweep: [0.87, 1.0],
} as const;

type Layer = { id: string; file: string; sizeM: number[]; hinge: number[][] };

function useStageScale(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1400);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setK(Math.max(400, Math.min(el.clientWidth * 0.74 / (2 * W), el.clientHeight * 0.66 / 0.36)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, k];
}

function Div({ className = '', style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

/** A pop-up card standing on its hinge. a = -180 lies flat toward the reader; -90 stands. */
function Card({ k, x, z, w, h, img, a, opacity = 1, pos = '0 0', size = '100% 100%', children }: { k: number; x: number; z: number; w: number; h: number; img: string; a: number; opacity?: number; pos?: string; size?: string; children?: ReactNode }) {
  return (
    <Div
      className="p3"
      style={{ left: x * k, top: z * k - h * k, width: w * k, height: h * k, transformOrigin: 'bottom center', transform: `rotateX(${a}deg)`, opacity, visibility: opacity <= 0.01 ? 'hidden' : 'visible' }}
    >
      <Div className="face" style={{ backgroundImage: `url(${img})`, backgroundSize: size, backgroundPosition: pos }}>
        {children}
      </Div>
      <Div
        className="face back"
        style={{ background: '#efe6d4', WebkitMaskImage: `url(${img})`, maskImage: `url(${img})`, WebkitMaskSize: size, maskSize: size, WebkitMaskPosition: pos, maskPosition: pos, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }}
      />
    </Div>
  );
}

function layerAngle(v: number): number {
  return -180 + 90 * pop(v);
}

/** A card lying flat is tucked into the page, as in the real book: fade it with its angle. */
function standing(a: number): number {
  return clamp((a + 178) / 22);
}

export function BookStage({ p, className = '', onLamp }: { p: number; className?: string; onLamp?: (x: number, y: number) => void }) {
  const [ref, k] = useStageScale();
  const lampMarker = useRef<HTMLDivElement>(null);

  const open = ease(span(p, ...MARKS.cover));
  const tilt = mix(24, 54, ease(span(p, ...MARKS.tilt)));
  const lift = mix(0.035, 0, ease(span(p, ...MARKS.tilt)));
  // Closed, the book's middle is its cover's middle; open, it's the spine.
  const shift = -W / 2 * (1 - open);
  const zoom = mix(1.22, 1, ease(span(p, ...MARKS.tilt)));

  // Shore: rise, then fold away for the page turn.
  const shoreOut = ease(span(p, ...MARKS.fold));
  const shoreOrder = shore.stack.topToBottom;
  const rise = (id: string, from: number, to: number, order: string[]) => {
    const i = order.indexOf(id);
    const n = order.length;
    const step = (to - from) / (n + 1.2);
    return span(p, from + i * step, from + i * step + step * 2.2);
  };
  const shoreAngle = (id: string) => (shoreOut > 0 ? mix(-90, -180, shoreOut) : layerAngle(rise(id, ...MARKS.rise, shoreOrder)));
  const turn = ease(span(p, ...MARKS.turn));
  const lampAngle = (id: string) => layerAngle(rise(id, ...MARKS.lampRise, lamp.stack.topToBottom));

  // Pip and the lantern.
  const gustOut = p >= MARKS.gust;
  const lookedUp = p >= MARKS.lookUp;
  const liftT = ease(span(p, ...MARKS.lift));
  const backT = ease(span(p, ...MARKS.back));
  const relit = p >= MARKS.back[1] - 0.004;
  const pipFace = !gustOut || relit ? 'pip-lit' : lookedUp ? 'pip-up' : 'pip-scared';
  const pipW = PIP_H * PIP_ASPECT;
  const shoreMark = shore.marks[0]!.position;
  const lampMark = lamp.marks[0]!.position;
  const smoke = gustOut && !lookedUp ? span(p, MARKS.gust, MARKS.lookUp) : 0;
  // The lantern: lying by Pip's feet, lifted toward you, then back in his paw.
  const lanternVisible = lookedUp && !relit;
  const lx = mix(mix(shoreMark[0]! - 0.05, 0.0, liftT), shoreMark[0]! + 0.012, backT);
  const ly = mix(mix(shoreMark[2]! + 0.03, 0.13, liftT), shoreMark[2]!, backT);
  const lup = mix(mix(0, 0.12, liftT), 0.07, backT);
  const lscale = mix(mix(1, 1.9, liftT), 1, backT);
  const lanternLit = liftT > 0.55;

  // The lamp, the beam, and the room's dim.
  const lit = p >= MARKS.lit;
  const dim = Math.min(0.78, 0.55 * span(p, 0.1, 0.25) + 0.23 * span(p, MARKS.turn[0], MARKS.lampRise[1]));

  const lastLamp = useRef('');
  useLayoutEffect(() => {
    if (!onLamp || !lampMarker.current || !ref.current) return;
    const a = lampMarker.current.getBoundingClientRect();
    const b = ref.current.getBoundingClientRect();
    const x = (a.left + a.width / 2 - b.left) / b.width;
    const y = (a.top + a.height / 2 - b.top) / b.height;
    // Report only a real move, or the parent's update would loop back here.
    const key = `${x.toFixed(3)},${y.toFixed(3)}`;
    if (key === lastLamp.current) return;
    lastLamp.current = key;
    onLamp(x, y);
  });

  const lampRoom = lamp.layers.find((l) => l.id === 'lamp-room')!;
  const litEffect = lamp.effects['lamp-lit'];
  const litX = -W + litEffect.px[0]! / lamp.pxPerM;
  const anchor = lamp.anchors.lighthouseLamp.position;

  return (
    <div ref={ref} className={`stage3d relative overflow-visible ${className}`} style={{ '--persp': `${0.66 * k}px` } as CSSProperties}>
      {/* The room dims around the book, as the house lights go down. */}
      <div aria-hidden className="pointer-events-none absolute -inset-[20%] rounded-full" style={{ background: `radial-gradient(ellipse 34% 30% at 50% 58%, rgba(212,162,62,${0.2 - dim * 0.12}), rgba(212,162,62,0) 70%)` }} />
      <Div className="p3" style={{ left: '50%', top: '54%', width: 0, height: 0, transform: `translateY(${-lift * k}px) scale(${zoom}) rotateX(${tilt}deg)` }}>
        {/* Contact shadow on the table. */}
        <Div style={{ position: 'absolute', left: (-W * 1.2 + shift) * k, top: -D * 0.66 * k, width: W * 2.4 * k, height: D * 1.32 * k, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(4,6,14,.7), rgba(4,6,14,0) 68%)' }} />
        <Div className="p3" style={{ left: shift * k, top: 0, transform: `translateZ(${THICK * k}px)` }}>
          {/* The page block's edge, toward the reader. */}
          <Div className="face" style={{ left: 0, top: (D / 2) * k, width: W * k, height: THICK * k, transformOrigin: 'top', transform: 'rotateX(-90deg)', backgroundImage: `url(${art('cover.webp')})`, backgroundSize: '100% 100%', filter: 'brightness(.55)' }} />
          {/* The right page: the shore, then the lamp once the leaf has turned. */}
          <Div className="face" style={{ left: 0, top: (-D / 2) * k, width: W * k, height: D * k, backgroundImage: `url(${art(turn > 0.5 ? 'lamp-ground.webp' : 'shore-ground.webp')})`, backgroundSize: '200% 100%', backgroundPosition: '100% 0' }} />

          {/* The leaf that turns from the shore to the lamp. */}
          <Div className="p3" style={{ left: 0, top: (-D / 2) * k, width: W * k, height: D * k, transformOrigin: 'left center', transform: `translateZ(${1 + turn}px) rotateY(${-180 * turn}deg)`, visibility: turn > 0 && turn < 1 ? 'visible' : 'hidden' }}>
            <Div className="face" style={{ backgroundImage: `url(${art('shore-ground.webp')})`, backgroundSize: '200% 100%', backgroundPosition: '100% 0', filter: `brightness(${1 - turn * 0.3})` }} />
            <Div className="face back" style={{ backgroundImage: `url(${art('lamp-ground.webp')})`, backgroundSize: '200% 100%', backgroundPosition: '0 0' }} />
          </Div>

          {/* The cover swings about the spine. Inside, the left half of the spread. */}
          <Div className="p3" style={{ left: 0, top: (-D / 2) * k, width: W * k, height: D * k, transformOrigin: 'left center', transform: `translateZ(${2 + turn * 2}px) rotateY(${-180 * open}deg)` }}>
            <Div className="face overflow-hidden rounded-r-[6px]" style={{ backgroundImage: `url(${art('cover.webp')})`, backgroundSize: '100% 100%' }}>
              <p className="display absolute inset-x-[17%] top-[9.5%] grid h-[22%] place-items-center text-center leading-[1.04] text-navy" style={{ fontSize: Math.max(10, W * k * 0.088), textWrap: 'balance' }}>
                {BOOK_TITLE}
              </p>
            </Div>
            <Div className="face back" style={{ backgroundImage: `url(${art(turn >= 1 ? 'lamp-ground.webp' : 'shore-ground.webp')})`, backgroundSize: '200% 100%', backgroundPosition: '0 0' }} />
          </Div>

          {/* The shore's pop-ups. */}
          {open > 0.85 &&
            (shore.layers as Layer[]).map((l) => (
              <Card key={l.id} k={k} x={-W} z={l.hinge[0]![2]!} w={2 * W} h={l.sizeM[1]!} img={art(`shore-${l.file.replace('.png', '.webp')}`)} a={shoreAngle(l.id)} opacity={turn >= 1 ? 0 : shoreOut > 0 ? clamp(1 - shoreOut * 2.2) : standing(shoreAngle(l.id))} />
            ))}
          {open > 0.85 && turn < 1 && (
            <Card k={k} x={shoreMark[0]! - pipW * PIP_FEET} z={shoreMark[2]!} w={pipW} h={PIP_H} img={art(`${pipFace}.webp`)} a={shoreAngle('pip')} opacity={shoreOut > 0 ? clamp(1 - shoreOut * 2.2) : standing(shoreAngle('pip'))}>
              {/* The lantern's glow, when it's lit. */}
              <div aria-hidden className="absolute rounded-full mix-blend-screen" style={{ left: '38%', top: '47%', width: '90%', aspectRatio: '1', transform: 'translate(-50%,-50%)', opacity: pipFace === 'pip-lit' ? 0.95 : 0, transition: 'opacity .35s', background: 'radial-gradient(circle, rgba(255,214,130,.65), rgba(255,200,110,.2) 45%, rgba(255,190,90,0) 70%)' }} />
              <div aria-hidden className="absolute" style={{ left: '42%', bottom: '58%', width: '22%', height: '40%', backgroundImage: `url(${art('smoke.webp')})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', opacity: smoke > 0 ? 1 - smoke : 0, transform: `translateY(${-smoke * 40}%) scale(${0.7 + smoke * 0.5})` }} />
            </Card>
          )}
          {/* The lantern in your hand: lifted off the page toward you, then back to Pip. */}
          {lanternVisible && (
            <Div className="p3" style={{ left: lx * k - (LANTERN_H * 0.62 * k) / 2, top: ly * k - LANTERN_H * k, width: LANTERN_H * 0.62 * k, height: LANTERN_H * k, transformOrigin: 'bottom center', transform: `translateZ(${lup * k}px) rotateX(-90deg) scale(${lscale})` }}>
              <Div className="face" style={{ backgroundImage: `url(${art(lanternLit ? 'lantern-lit.webp' : 'lantern-out.webp')})`, backgroundSize: 'contain', backgroundPosition: 'center bottom', filter: 'drop-shadow(0 6px 8px rgba(5,7,16,.5))' }} />
              {lanternLit && <div aria-hidden className="absolute -inset-[120%] rounded-full mix-blend-screen" style={{ background: 'radial-gradient(circle, rgba(255,214,130,.6), rgba(255,200,110,0) 60%)' }} />}
            </Div>
          )}

          {/* The lamp spread. */}
          {turn > 0.95 &&
            (lamp.layers as Layer[]).map((l) => (
              <Card key={l.id} k={k} x={-W} z={l.hinge[0]![2]!} w={2 * W} h={l.sizeM[1]!} img={art(`lamp-${l.file.replace('.png', '.webp')}`)} a={lampAngle(l.id)} opacity={standing(lampAngle(l.id))}>
                {l.id === lampRoom.id && (
                  <>
                    <div aria-hidden className="absolute top-0 h-full transition-opacity duration-700" style={{ left: `${((litX + W) / (2 * W)) * 100}%`, width: `${(litEffect.sizeM[0]! / (2 * W)) * 100}%`, backgroundImage: `url(${art('lamp-lamp-lit.webp')})`, backgroundSize: '100% 100%', opacity: lit ? 1 : 0 }} />
                    <div ref={lampMarker} aria-hidden className="absolute size-px" style={{ left: `${((anchor[0]! + W) / (2 * W)) * 100}%`, bottom: `${(anchor[1]! / l.sizeM[1]!) * 100}%` }} />
                  </>
                )}
              </Card>
            ))}
          {turn > 0.95 && <Card k={k} x={lampMark[0]! - pipW * PIP_FEET} z={lampMark[2]!} w={pipW} h={PIP_H} img={art('pip-lit.webp')} a={lampAngle('pip')} opacity={standing(lampAngle('pip'))} />}
        </Div>
      </Div>
    </div>
  );
}
