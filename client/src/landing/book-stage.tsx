/**
 * The reading room at night, in CSS 3D, from the real art (client/public/web, made by tools/web-art.ts)
 * and the sets' own geometry. A closed book lies on the painted table in lamplight; one number, `p`
 * (how far you've scrolled), opens it, plays the lantern, turns the page, and sweeps the beam across
 * the room. Stage space follows the sets: metres, origin at the spine on the table, +z toward the reader.
 * Everything stays mounted from the start, so nothing loads or pops in while you scroll.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import shore from '../../../art/sets/shore-path/set.json';
import lamp from '../../../art/sets/the-lamp/set.json';
import { BOOK_TITLE } from './library.ts';
import content from './page-content.json';
import { art } from './preload.ts';

const W = 0.21;
const D = 0.315;
const THICK = 0.014;
const LEAD_H = 0.172;
/** Where the lead's feet sit across the composed image (printed by tools/web-art.ts). */
const LEAD_FEET = 0.406;
const LEAD_ASPECT = 0.64;
const LANTERN_H = 0.05;
/** The painted table around the book, in metres. */
const TABLE_W = 1.5;
const TABLE_D = 0.95;

export const clamp = (v: number) => Math.max(0, Math.min(1, v));
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
/** A pop-up's landing: a slight overshoot, as real card does. */
const pop = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : 1 + 2.2 * Math.pow(v - 1, 3) + 1.2 * Math.pow(v - 1, 2));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The story's moments, as shares of the scroll. The words in story.tsx use the same marks. */
export const MARKS = {
  settle: [0.0, 0.16],
  cover: [0.08, 0.24],
  rise: [0.2, 0.34],
  gust: 0.42,
  lookUp: 0.47,
  lift: [0.49, 0.56],
  back: [0.56, 0.61],
  fold: [0.66, 0.71],
  turn: [0.69, 0.78],
  lampRise: [0.77, 0.86],
  lit: 0.87,
  sweep: [0.87, 1.0],
} as const;

/** The beam's heading in degrees (0 points up, clockwise), for a given scroll. */
export const beamHeading = (p: number) => -40 + span(p, ...MARKS.sweep) * 520;

type Layer = { id: string; file: string; sizeM: number[]; hinge: number[][] };

function useViewport(): [React.RefObject<HTMLDivElement | null>, { w: number; h: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

function Div({ className = '', style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

/** A card hidden by opacity stays mounted and painted-ready, but out of the way. */
const seen = (opacity: number): CSSProperties => ({ opacity, visibility: opacity <= 0.01 ? 'hidden' : 'visible' });

/** A pop-up card standing on its hinge. a = -180 lies flat toward the reader; -90 stands. */
function Card({ k, x, z, w, h, img, a, opacity = 1, filter, children }: { k: number; x: number; z: number; w: number; h: number; img: string; a: number; opacity?: number; filter?: string; children?: ReactNode }) {
  return (
    <Div className="p3" style={{ left: x * k, top: z * k - h * k, width: w * k, height: h * k, transformOrigin: 'bottom center', transform: `rotateX(${a}deg)`, ...seen(opacity) }}>
      <Div className="face" style={{ backgroundImage: `url(${img})`, backgroundSize: '100% 100%', filter }}>
        {children}
      </Div>
      <Div
        className="face back"
        style={{ background: '#a99c84', WebkitMaskImage: `url(${img})`, maskImage: `url(${img})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }}
      />
    </Div>
  );
}

const layerAngle = (v: number) => -180 + 90 * pop(v);
/** A card lying flat is tucked into the page, as in the real book: fade it with its angle. */
const standing = (a: number) => clamp((a + 158) / 38);

/** A spread's printed ground, with the gutter's shadow where the pages meet the spine. */
function Ground({ img, side, filter }: { img: string; side: 'left' | 'right'; filter: string }) {
  return (
    <>
      <div className="absolute inset-0" style={{ backgroundImage: `url(${img})`, backgroundSize: '200% 100%', backgroundPosition: side === 'left' ? '0 0' : '100% 0', filter }} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(${side === 'left' ? '270deg' : '90deg'}, rgba(48,32,20,.42), rgba(48,32,20,.1) 7%, rgba(48,32,20,0) 16%)` }} />
    </>
  );
}

export type StageLight = { lampX: number; lampY: number };

export function BookStage({ p, className = '', onLamp }: { p: number; className?: string; onLamp?: (light: StageLight) => void }) {
  const [ref, vp] = useViewport();
  const lampMarker = useRef<HTMLDivElement>(null);
  // Scale: the open book takes most of the width on a phone, and a calm share of a wide screen.
  const k = Math.max(320, Math.min((vp.w * (vp.w < 700 ? 0.66 : 0.86)) / (2 * W), (vp.h * 0.6) / 0.38, 2600));

  const settle = ease(span(p, ...MARKS.settle));
  const open = ease(span(p, ...MARKS.cover));
  const end = ease(span(p, 0.9, 1));
  // The camera: a closed book lying askew in lamplight, then straightened, nearer, and opened.
  const zoom = mix(vp.h < 760 ? 0.52 : 0.64, 1, settle) * mix(1, 0.9, end);
  const tilt = mix(58, 54, settle);
  const askew = mix(-9, 0, settle);
  const centreY = mix(vp.h < 760 ? 0.82 : 0.76, 0.63, settle);
  // Closed, the book's middle is its cover's middle; open, it's the spine.
  const shift = (-W / 2) * (1 - open);

  const shoreOut = ease(span(p, ...MARKS.fold));
  const rise = (id: string, from: number, to: number, order: string[]) => {
    const i = order.indexOf(id);
    const step = (to - from) / (order.length + 1.2);
    return span(p, from + i * step, from + i * step + step * 2.2);
  };
  const shoreAngle = (id: string) => (shoreOut > 0 ? -90 : layerAngle(rise(id, ...MARKS.rise, shore.stack.topToBottom)));
  const shoreSeen = (id: string) => (shoreOut > 0 ? clamp(1 - shoreOut * 1.6) : standing(shoreAngle(id)));
  const turn = ease(span(p, ...MARKS.turn));
  const lampAngle = (id: string) => layerAngle(rise(id, ...MARKS.lampRise, lamp.stack.topToBottom));

  // The lead character and the lantern.
  const gustOut = p >= MARKS.gust;
  const lookedUp = p >= MARKS.lookUp;
  const liftT = ease(span(p, ...MARKS.lift));
  const backT = ease(span(p, ...MARKS.back));
  const relit = p >= MARKS.back[1] - 0.004;
  const leadFace = !gustOut || relit ? content.lead.lit : lookedUp ? content.lead.up : content.lead.scared;
  const leadW = LEAD_H * LEAD_ASPECT;
  // The lead's place in each set's stack, by the set's own mark id.
  const shoreLead = shore.marks[0]!.id;
  const lampLead = lamp.marks[0]!.id;
  const shoreMark = shore.marks[0]!.position;
  const lampMark = lamp.marks[0]!.position;
  const smoke = gustOut && !lookedUp ? span(p, MARKS.gust, MARKS.lookUp) : 0;
  const lanternSeen = lookedUp && !relit ? 1 : 0;
  const lx = mix(mix(shoreMark[0]! - 0.05, 0.0, liftT), shoreMark[0]! + 0.012, backT);
  const ly = mix(mix(shoreMark[2]! + 0.03, 0.12, liftT), shoreMark[2]!, backT);
  const lup = mix(mix(0, 0.16, liftT), 0.07, backT);
  const lscale = mix(mix(1, 2.6, liftT), 1, backT);
  const lanternLit = liftT > 0.55;

  // The lamp, and the house lights going down as the book opens.
  const lit = p >= MARKS.lit;
  const houseLights = 1 - 0.55 * span(p, 0.1, 0.26) - 0.2 * span(p, MARKS.turn[0], MARKS.lampRise[1]);
  // Night falls on the shore's printed ground; the lamp spread is at dusk.
  const shoreTint = 'brightness(.8) saturate(.88) sepia(.12)';
  const lampTint = 'brightness(.9) saturate(.95) sepia(.08)';

  const lastLamp = useRef('');
  useLayoutEffect(() => {
    if (!onLamp || !lampMarker.current || !ref.current) return;
    const a = lampMarker.current.getBoundingClientRect();
    const b = ref.current.getBoundingClientRect();
    const lampX = (a.left + a.width / 2 - b.left) / b.width;
    const lampY = (a.top + a.height / 2 - b.top) / b.height;
    const key = `${lampX.toFixed(3)},${lampY.toFixed(3)}`;
    if (key === lastLamp.current) return;
    lastLamp.current = key;
    onLamp({ lampX, lampY });
  });

  const lampRoom = lamp.layers.find((l) => l.id === 'lamp-room')!;
  const litEffect = lamp.effects['lamp-lit'];
  const litX = -W + litEffect.px[0]! / lamp.pxPerM;
  const anchor = lamp.anchors.lighthouseLamp.position;
  const spreadLeft = turn >= 1 ? 'lamp-ground.webp' : 'shore-ground.webp';
  const spreadRight = turn > 0.5 ? 'lamp-ground.webp' : 'shore-ground.webp';

  return (
    <div ref={ref} className={`stage3d overflow-hidden ${className || "relative"}`} style={{ '--persp': `${0.7 * k}px` } as CSSProperties}>
      {/* The table lives in its own layer: its blend and mask would flatten the book's 3D if they shared a tree. */}
      <div className="absolute" style={{ left: '50%', top: `${centreY * 100}%`, width: 0, height: 0, transform: `scale(${zoom}) rotateX(${tilt}deg) rotateZ(${askew}deg)` }}>
        {/* The painted table, fading into the dark room, with the lamp's warm pool on it. */}
        <Div style={{ position: 'absolute', left: (-TABLE_W / 2) * k, top: (-TABLE_D * 0.58) * k, width: TABLE_W * k, height: TABLE_D * k, backgroundImage: `url(${art('room-tabletop.webp')})`, backgroundSize: 'cover', filter: `brightness(${0.42 + 0.4 * houseLights}) saturate(.9)`, WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 52%, #000 38%, transparent 72%)', maskImage: 'radial-gradient(ellipse 50% 50% at 50% 52%, #000 38%, transparent 72%)' }} />
        <Div style={{ position: 'absolute', left: (-TABLE_W / 2) * k, top: (-TABLE_D * 0.58) * k, width: TABLE_W * k, height: TABLE_D * k, mixBlendMode: 'soft-light', background: 'radial-gradient(ellipse 30% 34% at 54% 50%, rgba(255,214,150,.9), rgba(255,200,120,.25) 55%, rgba(255,200,120,0) 75%)' }} />
        {/* Contact shadow. */}
        <Div style={{ position: 'absolute', left: (-W * 1.12 + shift) * k, top: -D * 0.6 * k, width: W * 2.24 * k * mix(0.55, 1, open), height: D * 1.22 * k, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(20,12,6,.75), rgba(20,12,6,0) 66%)', transform: `translateX(${open < 1 ? W * 0.5 * (1 - open) * k : 0}px)` }} />

      </div>
      <Div className="p3" style={{ left: '50%', top: `${centreY * 100}%`, width: 0, height: 0, transform: `scale(${zoom}) rotateX(${tilt}deg) rotateZ(${askew}deg)` }}>
        <Div className="p3" style={{ left: shift * k, top: 0, transform: `translateZ(${THICK * k}px)` }}>
          {/* The page block's edges: toward the reader, and the fore-edge. */}
          <Div className="face" style={{ left: 0, top: (D / 2) * k, width: W * k, height: THICK * k, transformOrigin: 'top', transform: 'rotateX(-90deg)', background: 'repeating-linear-gradient(180deg, #efe6d3 0 1px, #d9ccb2 1px 2px)', filter: 'brightness(.8)' }} />
          <Div className="face" style={{ left: W * k, top: (-D / 2) * k, width: THICK * k, height: D * k, transformOrigin: 'left', transform: 'rotateY(90deg)', background: 'repeating-linear-gradient(90deg, #efe6d3 0 1px, #d9ccb2 1px 2px)', filter: 'brightness(.62)' }} />
          {/* The right page. */}
          <Div className="face" style={{ left: 0, top: (-D / 2) * k, width: W * k, height: D * k }}>
            <Ground img={art(spreadRight)} side="right" filter={spreadRight.startsWith('lamp') ? lampTint : shoreTint} />
          </Div>

          {/* The leaf that turns from the shore to the lamp. */}
          <Div className="p3" style={{ left: 0, top: (-D / 2) * k, width: W * k, height: D * k, transformOrigin: 'left center', transform: `translateZ(${1 + turn}px) rotateY(${-180 * turn}deg)`, visibility: turn > 0 && turn < 1 ? 'visible' : 'hidden' }}>
            <Div className="face">
              <Ground img={art('shore-ground.webp')} side="right" filter={`${shoreTint} brightness(${1 - turn * 0.35})`} />
            </Div>
            <Div className="face back">
              <Ground img={art('lamp-ground.webp')} side="left" filter={lampTint} />
            </Div>
          </Div>

          {/* The cover swings about the spine; inside, the left half of the spread. */}
          <Div className="p3" style={{ left: 0, top: (-D / 2) * k, width: W * k, height: D * k, transformOrigin: 'left center', transform: `translateZ(${2 + turn * 2}px) rotateY(${-180 * open}deg)` }}>
            <Div className="face overflow-hidden rounded-r-[5px]" style={{ backgroundImage: `url(${art('cover.webp')})`, backgroundSize: '100% 100%', boxShadow: 'inset 6px 0 10px -6px rgba(0,0,0,.6)' }}>
              <p className="display absolute inset-x-[18%] top-[9.6%] m-0 grid h-[22%] place-items-center text-center italic leading-[1.02] text-navy" style={{ fontSize: Math.max(8, W * k * 0.1), textWrap: 'balance' }}>
                {BOOK_TITLE}
              </p>
            </Div>
            <Div className="face back">
              <Ground img={art(spreadLeft)} side="left" filter={spreadLeft.startsWith('lamp') ? lampTint : shoreTint} />
            </Div>
          </Div>

          {/* The shore's pop-ups and the lead character. */}
          {(shore.layers as Layer[]).map((l) => (
            <Card key={l.id} k={k} x={-W} z={l.hinge[0]![2]!} w={2 * W} h={l.sizeM[1]!} img={art(`shore-${l.file.replace('.png', '.webp')}`)} a={shoreAngle(l.id)} opacity={open > 0.85 && turn < 1 ? shoreSeen(l.id) : 0} filter={l.id.includes('sky') ? undefined : 'brightness(.92)'} />
          ))}
          <Card k={k} x={shoreMark[0]! - leadW * LEAD_FEET} z={shoreMark[2]!} w={leadW} h={LEAD_H} img={art(leadFace)} a={shoreAngle(shoreLead)} opacity={open > 0.85 && turn < 1 ? shoreSeen(shoreLead) : 0}>
            <div aria-hidden className="absolute rounded-full mix-blend-screen" style={{ left: '38%', top: '47%', width: '96%', aspectRatio: '1', transform: 'translate(-50%,-50%)', opacity: leadFace === content.lead.lit ? 0.95 : 0, transition: 'opacity .4s', background: 'radial-gradient(circle, rgba(255,214,130,.6), rgba(255,200,110,.18) 45%, rgba(255,190,90,0) 70%)' }} />
            <div aria-hidden className="absolute" style={{ left: '42%', bottom: '58%', width: '22%', height: '40%', backgroundImage: `url(${art('smoke.webp')})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', opacity: smoke > 0 ? 1 - smoke : 0, transform: `translateY(${-smoke * 40}%) scale(${0.7 + smoke * 0.5})` }} />
          </Card>
          {/* The lantern in your hand: lifted off the page toward you, then given back. */}
          <Div className="p3" style={{ left: lx * k - (LANTERN_H * 0.62 * k) / 2, top: ly * k - LANTERN_H * k, width: LANTERN_H * 0.62 * k, height: LANTERN_H * k, transformOrigin: 'bottom center', transform: `translateZ(${lup * k}px) rotateX(-90deg) scale(${lscale})`, ...seen(lanternSeen) }}>
            <Div className="face" style={{ backgroundImage: `url(${art(lanternLit ? 'lantern-lit.webp' : 'lantern-out.webp')})`, backgroundSize: 'contain', backgroundPosition: 'center bottom', filter: 'drop-shadow(0 6px 8px rgba(5,7,16,.5))' }} />
            <div aria-hidden className="absolute -inset-[120%] rounded-full mix-blend-screen transition-opacity duration-300" style={{ opacity: lanternLit ? 1 : 0, background: 'radial-gradient(circle, rgba(255,214,130,.6), rgba(255,200,110,0) 60%)' }} />
          </Div>

          {/* The lamp spread. */}
          {(lamp.layers as Layer[]).map((l) => (
            <Card key={l.id} k={k} x={-W} z={l.hinge[0]![2]!} w={2 * W} h={l.sizeM[1]!} img={art(`lamp-${l.file.replace('.png', '.webp')}`)} a={lampAngle(l.id)} opacity={turn > 0.95 ? standing(lampAngle(l.id)) : 0}>
              {l.id === lampRoom.id && (
                <>
                  <div aria-hidden className="absolute top-0 h-full transition-opacity duration-700" style={{ left: `${((litX + W) / (2 * W)) * 100}%`, width: `${(litEffect.sizeM[0]! / (2 * W)) * 100}%`, backgroundImage: `url(${art('lamp-lamp-lit.webp')})`, backgroundSize: '100% 100%', opacity: lit ? 1 : 0 }} />
                  <div ref={lampMarker} aria-hidden className="absolute size-px" style={{ left: `${((anchor[0]! + W) / (2 * W)) * 100}%`, bottom: `${(anchor[1]! / l.sizeM[1]!) * 100}%` }} />
                </>
              )}
            </Card>
          ))}
          <Card k={k} x={lampMark[0]! - leadW * LEAD_FEET} z={lampMark[2]!} w={leadW} h={LEAD_H} img={art(content.lead.lit)} a={lampAngle(lampLead)} opacity={turn > 0.95 ? standing(lampAngle(lampLead)) : 0} />
        </Div>
      </Div>
    </div>
  );
}

/**
 * The room behind the table: the window with the moon, the shelves, the armchair under its lamp.
 * Painted flats, dark while the house lights are down, lifted when the beam passes over them.
 */
export function Room({ p, light }: { p: number; light: StageLight }) {
  const house = 1 - 0.6 * span(p, 0.1, 0.26) - 0.15 * span(p, MARKS.turn[0], MARKS.lampRise[1]);
  const lit = p >= MARKS.lit;
  const heading = beamHeading(p);
  const flats = [
    { file: 'room-flat-window.webp', x: 0.13, h: 0.86, y: 0.06 },
    { file: 'room-flat-shelves.webp', x: 0.5, h: 0.7, y: 0.02 },
    { file: 'room-flat-lamp.webp', x: 0.86, h: 0.8, y: 0.1 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {flats.map((f) => {
        // How squarely the beam points at this flat right now.
        const dir = (Math.atan2(f.x - light.lampX, -(f.y + f.h * 0.4 - light.lampY)) * 180) / Math.PI;
        const facing = lit ? Math.pow(Math.max(0, Math.cos(((heading - dir) * Math.PI) / 180)), 10) : 0;
        const brightness = 0.32 * house + 0.06 + facing * 0.7;
        return (
          <img
            key={f.file}
            src={art(f.file)}
            alt=""
            className="absolute max-w-none -translate-x-1/2"
            style={{ left: `${f.x * 100}%`, top: `${(f.y - p * 0.04) * 100}%`, height: `${f.h * 100}%`, filter: `brightness(${brightness}) saturate(${0.55 + facing * 0.4}) blur(${f.file.includes('shelves') ? 1.2 : 0.6}px)`, transition: 'filter .25s linear' }}
          />
        );
      })}
      {/* The floor of the room, falling away into the dark under the table. */}
      <div className="absolute inset-x-0 bottom-0 h-[45%]" style={{ background: 'linear-gradient(to bottom, rgba(21,17,14,0), #15110e 55%)' }} />
    </div>
  );
}
