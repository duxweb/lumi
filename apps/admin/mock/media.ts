/**
 * Placeholder photos for the showcase pages (Image, Gallery, Carousel, Article).
 * They are drawn here instead of committed as image files, so the repository
 * holds no image assets outside the visual baselines; `vite.config.ts` serves
 * them in development and emits them as `media/<name>.svg` in a build.
 */

interface Scene {
  sky: string
  sun: string
  sunRadius: number
  hills: readonly [string, string, string]
}

const scenes = {
  canyon: { sky: '#f0d9cf', sun: '#fbf1ec', sunRadius: 140, hills: ['#dca08a', '#bf735c', '#934f3d'] },
  dunes: { sky: '#e9d8c4', sun: '#f6efe6', sunRadius: 140, hills: ['#d9b48f', '#c48f63', '#a86e47'] },
  forest: { sky: '#d7e3d2', sun: '#f1f6ee', sunRadius: 140, hills: ['#9cb894', '#6f9468', '#4b6d47'] },
  lake: { sky: '#cfe0ea', sun: '#eef5f9', sunRadius: 90, hills: ['#9fbccc', '#6f93a8', '#46687d'] },
  night: { sky: '#2b3350', sun: '#3a4466', sunRadius: 90, hills: ['#454f73', '#363f5e', '#262d45'] },
} satisfies Record<string, Scene>

export type MediaName = keyof typeof scenes

export const mediaNames = Object.keys(scenes) as MediaName[]

const WIDTH = 1600
const HEIGHT = 1000

/** One rolling ridge from the left edge to the right, filled down to the bottom. */
function ridge(top: number, depth: number, fill: string): string {
  const low = top + depth / 2
  const mid = top - depth / 3
  const end = top - depth / 4
  return `<path d="M0 ${top} C 300 ${top - depth}, 520 ${low}, 800 ${mid} S 1300 ${top - depth}, 1600 ${end} V ${HEIGHT} H 0 Z" fill="${fill}"/>`
}

export function mediaSvg(name: MediaName): string {
  const scene: Scene = scenes[name]
  const [far, middle, near] = scene.hills
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${scene.sky}"/>`,
    `<circle cx="1180" cy="300" r="${scene.sunRadius}" fill="${scene.sun}" opacity="0.9"/>`,
    ridge(520, 120, far),
    ridge(660, 100, middle),
    ridge(800, 80, near),
    '</svg>',
  ].join('')
}
