import type { Scene } from "@/domain/visualScene";

/**
 * The nine pictures from the previews (docs/plan-wrong-answer-visuals.md), written as the AI is asked to write them.
 * Used by the scene tests and the /dev/visuals page. Their questions come from a real optics track.
 */

const MIRROR = "M309.4 37 A220 220 0 0 1 309.4 223";
const FISH = "M-16 0 Q-2 -9 12 0 Q-2 9 -16 0 Z M12 0 L22 -7 L22 7 Z";
const PULSE = "M-7 0 A7 7 0 1 0 7 0 A7 7 0 1 0 -7 0";

export type SampleVisual = { key: string; prompt: string; answer: string; scene: Scene };

export const sampleVisuals: SampleVisual[] = [
  {
    key: "angle-from-normal",
    prompt: "A ray of sunlight bounces off a flat (plane) mirror. The reflected ray makes an angle of 54° with the surface of the mirror. What was the angle of incidence?",
    answer: "36°",
    scene: {
      size: [400, 240],
      alt: "A ray reflecting off a plane mirror, with the 54° angle at the surface and the 36° angles from the normal",
      points: { O: [200, 200], A: { from: "O", deg: 126, len: 150 }, B: { from: "O", deg: 54, len: 150 }, N: [200, 45] },
      base: [{ t: "seg", a: [60, 200], b: [340, 200], w: 3 }, { t: "hatch", a: [60, 200], b: [340, 200], side: -1 }],
      steps: [
        { caption: "A ray hits the mirror and bounces off.", add: [{ t: "seg", a: "A", b: "O", arrow: "mid" }, { t: "seg", a: "O", b: "B", arrow: "mid" }] },
        { caption: "The 54° is between the ray and the mirror's surface. Taking it as the answer is a common slip.", add: [{ t: "angle", at: "O", from: 0, to: 54, r: 40, label: "54°", color: "wrong" }] },
        { caption: "The normal is a line at 90° to the mirror. Angles are measured from the normal.", add: [{ t: "seg", a: "O", b: "N", dash: true, color: "muted" }, { t: "text", at: [207, 52], s: "normal", anchor: "start", color: "muted" }] },
        { caption: "From the normal: 90° − 54° = 36°. And i = r, so the angle of incidence is 36°.", add: [{ t: "angle", at: "O", from: 54, to: 90, r: 64, lr: 84, label: "r = 36°", color: "right" }, { t: "angle", at: "O", from: 90, to: 126, r: 64, lr: 84, label: "i = 36°", color: "right" }] },
      ],
    },
  },
  {
    key: "focal-length",
    prompt: "Nisha points a concave mirror at the sun. She finds the smallest, brightest spot of sunlight on a sheet of paper held 11 cm from the mirror. What is the radius of curvature of the mirror?",
    answer: "22 cm",
    scene: {
      size: [400, 270],
      alt: "Parallel sunlight reflecting from a concave mirror to the focus, with the focal length and radius of curvature marked",
      points: { C: [110, 130], F: [220, 130], P: [330, 130], M1: [321.7, 70], M2: [327.9, 100], M3: [327.9, 160], M4: [321.7, 190], T: [309.4, 37] },
      base: [{ t: "seg", a: [20, 130], b: [390, 130], w: 1, color: "muted" }, { t: "path", d: MIRROR, w: 3 }, { t: "dot", at: "P", label: "P", dx: 12, dy: -6 }],
      steps: [
        { caption: "Sunlight reaches the mirror as parallel rays.", add: [{ t: "seg", a: [20, 70], b: "M1", arrow: "mid", w: 1.6 }, { t: "seg", a: [20, 100], b: "M2", arrow: "mid", w: 1.6 }, { t: "seg", a: [20, 160], b: "M3", arrow: "mid", w: 1.6 }, { t: "seg", a: [20, 190], b: "M4", arrow: "mid", w: 1.6 }] },
        { caption: "They reflect and meet at one point, the brightest spot. That point is the focus F.", add: [{ t: "seg", a: "M1", b: "F", w: 1.6, color: "right" }, { t: "seg", a: "M2", b: "F", w: 1.6, color: "right" }, { t: "seg", a: "M3", b: "F", w: 1.6, color: "right" }, { t: "seg", a: "M4", b: "F", w: 1.6, color: "right" }, { t: "dot", at: "F", label: "F", color: "right", dy: -10 }] },
        { caption: "So the spot is one focal length away: f = 11 cm. Giving 11 cm as the radius is a common slip.", add: [{ t: "dim", a: [220, 240], b: [330, 240], label: "f = 11 cm", color: "wrong" }] },
        { caption: "The radius of curvature reaches the centre C, twice as far: R = 2 × 11 = 22 cm.", add: [{ t: "dot", at: "C", label: "C", color: "right" }, { t: "seg", a: "C", b: "T", dash: true, color: "muted", w: 1.5 }, { t: "dim", a: [110, 262], b: [330, 262], label: "R = 2 × 11 = 22 cm", color: "right" }] },
      ],
    },
  },
  {
    key: "apparent-depth",
    prompt: "A fish is swimming 60 cm below the surface of a still pond. To a person looking straight down from above, how deep does the fish appear to be? (Refractive index of water = 4/3)",
    answer: "45 cm",
    scene: {
      size: [400, 305],
      alt: "A fish under water; rays bend at the surface so the fish appears higher than it is",
      base: [{ t: "rect", x: 40, y: 50, w: 320, h: 200, fill: "water" }, { t: "seg", a: [40, 50], b: [360, 50], w: 1.5, color: "right" }, { t: "seg", a: [40, 250], b: [360, 250], w: 2.5 }, { t: "text", at: [354, 242], s: "pool floor", anchor: "end", color: "muted", size: 12 }],
      steps: [
        { caption: "The fish is 60 cm below the surface.", add: [{ t: "group", id: "fish", at: [200, 230], items: [{ t: "path", d: FISH, fill: "ink" }] }, { t: "dim", a: [75, 50], b: [75, 230], label: "60 cm", lx: 10, ly: 4, anchor: "start" }] },
        { caption: "Light from the fish bends away from the normal as it leaves the water.", add: [{ t: "seg", a: [200, 230], b: [230, 50], arrow: "mid", w: 1.6 }, { t: "seg", a: [230, 50], b: [238.9, 10], w: 1.6 }, { t: "seg", a: [200, 230], b: [170, 50], arrow: "mid", w: 1.6 }, { t: "seg", a: [170, 50], b: [161.1, 10], w: 1.6 }] },
        { caption: "Your eye follows the rays straight back. They seem to come from higher up, so the fish looks raised.", add: [{ t: "seg", a: [230, 50], b: [200, 185], dash: true, color: "right", w: 1.5 }, { t: "seg", a: [170, 50], b: [200, 185], dash: true, color: "right", w: 1.5 }, { t: "group", id: "ghost", at: [200, 230], opacity: 0.55, items: [{ t: "path", d: FISH, fill: "right" }] }, { t: "move", id: "ghost", by: [0, -45], dur: 1400 }] },
        { caption: "It looks 60 × 3/4 = 45 cm deep. Multiplying by 4/3 gives 80 cm, below the pool floor: water looks shallower, never deeper.", add: [{ t: "dim", a: [325, 50], b: [325, 185], label: "looks 45 cm", lx: -8, ly: 4, anchor: "end", color: "right" }, { t: "seg", a: [150, 290], b: [250, 290], dash: true, color: "wrong" }, { t: "text", at: [256, 294], s: "80 cm?", anchor: "start", color: "wrong", bold: true }] },
      ],
    },
  },
  {
    key: "towards-normal",
    prompt: "A ray of green light strikes the first face of a glass prism from air with an angle of incidence of 50°. Which of these could be its angle of refraction inside the glass: 32° or 65°? Give a reason.",
    answer: "32°",
    scene: {
      size: [400, 265],
      alt: "A ray entering glass from air; bending away from the normal is crossed out and bending towards it is shown",
      points: { O: [200, 125], A: { from: "O", deg: 140, len: 125 }, R1: { from: "O", deg: -58, len: 130 }, R2: { from: "O", deg: -25, len: 130 } },
      base: [{ t: "rect", x: 20, y: 125, w: 360, h: 135, fill: "glass" }, { t: "seg", a: [20, 125], b: [380, 125], w: 1.5 }, { t: "text", at: [30, 112], s: "air (rarer)", anchor: "start", color: "muted" }, { t: "text", at: [30, 250], s: "glass (denser)", anchor: "start", color: "muted" }],
      steps: [
        { caption: "Light goes from air into glass, 50° from the normal.", add: [{ t: "seg", a: [200, 15], b: [200, 255], dash: true, color: "muted", w: 1.5 }, { t: "seg", a: "A", b: "O", arrow: "mid" }, { t: "angle", at: "O", from: 90, to: 140, r: 46, label: "50°" }] },
        { caption: "65° would mean bending away from the normal.", add: [{ t: "seg", id: "w", a: "O", b: "R2", arrow: "mid", color: "wrong" }, { t: "angle", id: "wa", at: "O", from: -90, to: -25, r: 52, lr: 68, la: -18, label: "65°", color: "wrong" }] },
        { caption: "Going into denser glass, light slows down and bends towards the normal.", add: [{ t: "fade", id: "w", to: 0.22 }, { t: "fade", id: "wa", to: 0.22 }, { t: "seg", a: "O", b: "R1", arrow: "mid", color: "right" }, { t: "angle", at: "O", from: -90, to: -58, r: 80, lr: 98, label: "32°", color: "right" }] },
        { caption: "So the angle of refraction must be smaller than 50°. Only 32° fits.", add: [{ t: "text", at: [300, 70], s: "r < i", color: "right", size: 18, bold: true }] },
      ],
    },
  },
  {
    key: "glass-slab",
    prompt: "A ray of light enters a thick glass slab at a slant and comes out from the opposite side. Describe the direction and position of the ray that comes out compared with the ray that went in.",
    answer: "Parallel to the ray that went in, but shifted sideways",
    scene: {
      size: [400, 270],
      alt: "A ray passing through a glass slab and coming out parallel but shifted sideways",
      points: { S: [54.7, 10], O1: [150, 90], O2: [209.4, 190], E: [292.8, 260], X: [352.6, 260] },
      base: [{ t: "rect", x: 40, y: 90, w: 320, h: 100, fill: "glass" }, { t: "seg", a: [40, 90], b: [360, 90], w: 1.5 }, { t: "seg", a: [40, 190], b: [360, 190], w: 1.5 }, { t: "text", at: [350, 180], s: "glass slab", anchor: "end", color: "muted", size: 12 }],
      steps: [
        { caption: "The ray enters the slab at a slant and bends towards the normal.", add: [{ t: "seg", a: [150, 45], b: [150, 135], dash: true, color: "muted", w: 1.2 }, { t: "seg", a: "S", b: "O1", arrow: "mid" }, { t: "seg", a: "O1", b: "O2", arrow: "mid" }] },
        { caption: "At the bottom face it bends away from the normal by the same amount.", add: [{ t: "seg", a: [209.4, 145], b: [209.4, 235], dash: true, color: "muted", w: 1.2 }, { t: "seg", a: "O2", b: "E", arrow: "mid", color: "right" }] },
        { caption: "Compare it with the path the ray would take with no glass.", add: [{ t: "seg", a: "O1", b: "X", dash: true, color: "muted", w: 1.5 }] },
        { caption: "It comes out parallel to the ray that went in, not slanted. It's only shifted sideways: lateral displacement.", add: [{ t: "seg", a: [269, 240], b: [293.7, 210.6], arrow: "both", color: "right", w: 1.8 }, { t: "text", at: [316, 214], s: "shift", anchor: "start", color: "right", bold: true }] },
      ],
    },
  },
  {
    key: "prism-base",
    prompt: "A glass prism is held upside down so that its base is at the top. A ray of red light passes through it. Will the ray come out bent upwards or downwards?",
    answer: "Upwards, towards the base",
    scene: {
      size: [400, 250],
      alt: "A prism turned upside down; a ray bends towards its base, now at the top",
      steps: [
        { caption: "Light passing through a prism always bends towards its base.", add: [{ t: "group", id: "prism", about: [200, 135], items: [{ t: "poly", pts: [[200, 55], [110, 205], [290, 205]], fill: "glass", stroke: "ink" }] }, { t: "text", id: "b1", at: [200, 226], s: "base", color: "muted", bold: true }, { t: "seg", id: "r1", a: [20, 140], b: [167, 110], w: 1.6, color: "muted" }, { t: "seg", id: "r2", a: [167, 110], b: [257, 150], w: 1.6, color: "muted" }, { t: "seg", id: "r3", a: [257, 150], b: [380, 230], w: 1.6, arrow: "end", color: "muted" }] },
        { caption: "Now turn the prism upside down: the base is on top.", add: [{ t: "fade", id: "r1", to: 0 }, { t: "fade", id: "r2", to: 0 }, { t: "fade", id: "r3", to: 0 }, { t: "fade", id: "b1", to: 0 }, { t: "rotate", id: "prism", deg: 180, dur: 1300 }, { t: "text", at: [200, 54], s: "base", color: "right", bold: true }] },
        { caption: "The ray still bends towards the base, so it comes out bent upwards.", add: [{ t: "seg", a: [20, 190], b: [167, 160], arrow: "mid", color: "right" }, { t: "seg", a: [167, 160], b: [257, 120], arrow: "mid", color: "right" }, { t: "seg", a: [257, 120], b: [380, 40], arrow: "mid", color: "right" }] },
        { caption: "Not 'downwards': the ray follows the base, wherever the base is.", add: [] },
      ],
    },
  },
  {
    key: "ray-through-focus",
    prompt: "Priya is drawing a ray diagram for a concave mirror. She wants the reflected ray to leave the mirror running parallel to the principal axis. Through which point, P, F or C, must she draw the incident ray?",
    answer: "Through F, the focus",
    scene: {
      size: [400, 250],
      alt: "Concave mirror with a ray aimed at P and a ray through F; only the ray through F reflects parallel",
      points: { C: [110, 130], F: [220, 130], P: [330, 130], K: [325.1, 84] },
      base: [{ t: "seg", a: [20, 130], b: [390, 130], w: 1, color: "muted" }, { t: "path", d: MIRROR, w: 3 }, { t: "dot", at: "P", label: "P", dx: 12, dy: -6 }, { t: "dot", at: "F", label: "F", dy: 20 }, { t: "dot", at: "C", label: "C", dy: 20 }, { t: "text", at: [24, 122], s: "principal axis", anchor: "start", color: "muted", size: 11.5 }],
      steps: [
        { caption: "A concave mirror with its pole P, focus F and centre of curvature C.", add: [] },
        { caption: "A ray aimed at P bounces back at the same angle on the other side of the axis. It isn't parallel.", add: [{ t: "seg", id: "w1", a: [60, 210], b: "P", arrow: "mid", color: "wrong" }, { t: "seg", id: "w2", a: "P", b: [60, 50], arrow: "mid", color: "wrong" }] },
        { caption: "A ray through F reflects parallel to the principal axis.", add: [{ t: "fade", id: "w1", to: 0.2 }, { t: "fade", id: "w2", to: 0.2 }, { t: "seg", a: [60, 200], b: "K", arrow: "mid", color: "right" }, { t: "seg", a: "K", b: [20, 84], arrow: "mid", color: "right" }] },
        { caption: "It works both ways: parallel in → through F out, and through F in → parallel out.", add: [] },
      ],
    },
  },
  {
    key: "speed-race",
    prompt: "Light travelling at 3 × 10⁸ m/s in air enters a material whose refractive index is 1.5. What is its speed inside the material?",
    answer: "2 × 10⁸ m/s",
    scene: {
      size: [400, 195],
      alt: "Two pulses of light race for one second, one in air and one in glass; the glass one covers two thirds of the distance",
      base: [
        { t: "seg", a: [60, 50], b: [360, 50], w: 1, color: "muted" }, { t: "rect", x: 60, y: 97, w: 300, h: 36, fill: "glass" },
        { t: "text", at: [52, 54], s: "air", anchor: "end", color: "muted" }, { t: "text", at: [52, 119], s: "glass", anchor: "end", color: "muted" },
        { t: "seg", a: [60, 148], b: [360, 148], w: 1, color: "muted" },
        { t: "text", at: [60, 166], s: "0" }, { t: "text", at: [160, 166], s: "1" }, { t: "text", at: [260, 166], s: "2" }, { t: "text", at: [360, 166], s: "3" },
        { t: "text", at: [210, 186], s: "× 10⁸ m in 1 second", color: "muted", size: 12 },
      ],
      steps: [
        { caption: "In one second, light in air travels 3 × 10⁸ m.", add: [{ t: "group", id: "pa", at: [60, 50], items: [{ t: "path", d: PULSE, fill: "right" }] }, { t: "move", id: "pa", by: [300, 0], dur: 2000 }] },
        { caption: "The refractive index is 1.5, so light in this material is 1.5 times slower.", add: [{ t: "group", id: "pg", at: [60, 115], items: [{ t: "path", d: PULSE, fill: "right" }] }, { t: "move", id: "pg", by: [200, 0], dur: 2000 }] },
        { caption: "3 ÷ 1.5 = 2, so light travels at 2 × 10⁸ m/s inside it.", add: [{ t: "text", at: [268, 88], s: "2 × 10⁸ m/s", anchor: "start", color: "right", bold: true }] },
        { caption: "1.5 × 10⁸ is a common slip: 1.5 is the refractive index, not a speed. Divide the speed in air by it.", add: [{ t: "seg", a: [210, 97], b: [210, 133], dash: true, color: "wrong" }, { t: "text", at: [204, 88], s: "1.5?", anchor: "end", color: "wrong", bold: true }] },
      ],
    },
  },
  {
    key: "prism-faces",
    prompt: "Meera covers each triangular end of a glass prism with a sticker, using 2 stickers. How many more stickers does she need to cover all the other flat faces, and what shape must they be?",
    answer: "3 more, rectangular",
    scene: {
      size: [400, 245],
      alt: "A triangular prism with its two triangular ends and three rectangular faces highlighted in turn",
      points: { f1: [80, 210], f2: [170, 210], f3: [125, 135], b1: [250, 160], b2: [340, 160], b3: [295, 85] },
      base: [
        { t: "seg", a: "f1", b: "b1", dash: true, color: "muted", w: 1.5 }, { t: "seg", a: "b1", b: "b3", dash: true, color: "muted", w: 1.5 }, { t: "seg", a: "b1", b: "b2", dash: true, color: "muted", w: 1.5 },
        { t: "seg", a: "f1", b: "f2", w: 2 }, { t: "seg", a: "f2", b: "f3", w: 2 }, { t: "seg", a: "f3", b: "f1", w: 2 },
        { t: "seg", a: "f3", b: "b3", w: 2 }, { t: "seg", a: "f2", b: "b2", w: 2 }, { t: "seg", a: "b3", b: "b2", w: 2 },
      ],
      steps: [
        { caption: "A prism has two triangular ends. These 2 are covered.", add: [{ t: "poly", pts: ["b1", "b2", "b3"], fill: "sticker", fo: 0.4 }, { t: "poly", under: true, pts: ["f1", "f2", "f3"], fill: "sticker", fo: 0.9 }] },
        { caption: "The faces joining the two ends are rectangles. Here's one…", add: [{ t: "poly", under: true, pts: ["f2", "f3", "b3", "b2"], fill: "pale", fo: 0.9 }, { t: "text", at: [238, 150], s: "1", color: "right", size: 18, bold: true }] },
        { caption: "…two, and three (on the hidden sides).", add: [{ t: "poly", under: true, pts: ["f1", "f3", "b3", "b1"], fill: "pale", fo: 0.45 }, { t: "text", at: [165, 104], s: "2 (behind)", color: "right", size: 15, bold: true }, { t: "poly", under: true, pts: ["f1", "f2", "b2", "b1"], fill: "pale", fo: 0.45 }, { t: "text", at: [250, 228], s: "3 (underneath)", color: "right", size: 15, bold: true }] },
        { caption: "2 triangles + 3 rectangles = 5 faces. So 3 more stickers, all rectangular.", add: [] },
      ],
    },
  },
];
