import * as THREE from 'three';

export type AppearanceGender = 'GF' | 'GM';
export interface AppearanceSettings {
  irisId?: string; pupilId?: string; browId?: string; lashId?: string;
  irisSize?: number; pupilSize?: number;
  irisColor?: string; irisBorderColor?: string; scleraColor?: string;
  browColor?: string; browOpacity?: number; lashColor?: string; lashOpacity?: number;
}
export interface AppearanceOption {
  id: string; label: string; texture: string; thumbnail?: string;
  sourceMaterial: string; scalars: Record<string, number>;
}
export interface AppearancePreset {
  id: string; label: string; faction: null; thumbnail: string | null;
  sourceIcon: string; sourceHead: {HeadType: number}; sourceHair: Record<string, unknown>;
  sourceMaterialValues: Record<string, unknown>; appearance: AppearanceSettings; note: string;
}
export interface AppearanceCatalog {
  version: number;
  genders: Record<AppearanceGender, {
    iris: AppearanceOption[]; pupils: AppearanceOption[]; brows: AppearanceOption[]; lashes: AppearanceOption[];
    skin: {id: string; color: string}[]; presets: AppearancePreset[];
    ranges: Record<string, {min: number; mid: number; max: number}>;
  }>;
  pads: {id: string; label: string; x: string; y: string; group: string}[];
  notes?: string[];
}
export const DEFAULT_APPEARANCE: Required<AppearanceSettings> = {
  irisId: '1', pupilId: '1', browId: '1', lashId: '1', irisSize: 0, pupilSize: 1.05,
  irisColor: '#547e8e', irisBorderColor: '#233b47', scleraColor: '#e8dfd8',
  browColor: '#392b25', browOpacity: .85, lashColor: '#211b18', lashOpacity: .85,
};
export function getDefaultAppearance(gender: AppearanceGender): Required<AppearanceSettings> {
  return {...DEFAULT_APPEARANCE, browOpacity: gender === 'GM' ? .95 : .85};
}

type Pixels = {image: HTMLImageElement; data: Uint8ClampedArray; width: number; height: number};
const images = new Map<string, Promise<Pixels>>();
function loadPixels(url: string): Promise<Pixels> {
  let pending = images.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d', {willReadFrequently: true})!; ctx.drawImage(image, 0, 0);
        resolve({image, width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data});
      };
      image.onerror = () => { images.delete(url); reject(new Error(`Appearance texture could not load: ${url}`)); };
      image.src = url;
    });
    images.set(url, pending);
  }
  return pending;
}
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
function channel(p: Pixels, u: number, v: number, c: number, outside = 0): number {
  if (u < 0 || u > 1 || v < 0 || v > 1) return outside;
  const x = Math.min(p.width - 1, Math.floor(u * p.width));
  const y = Math.min(p.height - 1, Math.floor(v * p.height));
  return p.data[(y * p.width + x) * 4 + c] / 255;
}
function rgb(value: string): number[] {
  const c = new THREE.Color(value).convertLinearToSRGB(); return [c.r * 255, c.g * 255, c.b * 255];
}
function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const result = document.createElement('canvas'); result.width = w; result.height = h;
  return [result, result.getContext('2d')!];
}
function texture(c: HTMLCanvasElement, original: THREE.Texture | null): THREE.CanvasTexture {
  const result = new THREE.CanvasTexture(c); result.flipY = original?.flipY ?? false;
  result.colorSpace = THREE.SRGBColorSpace;
  result.wrapS = original?.wrapS ?? THREE.ClampToEdgeWrapping;
  result.wrapT = original?.wrapT ?? THREE.ClampToEdgeWrapping;
  if (original) { result.offset.copy(original.offset); result.repeat.copy(original.repeat); result.rotation = original.rotation; }
  result.anisotropy = 4; result.needsUpdate = true; return result;
}
/** Approximate the native layered iris in the existing exported eye UV0 layout. */
function eyeCanvas(iris: Pixels, pupil: Pixels, s: Required<AppearanceSettings>): HTMLCanvasElement {
  const [c, ctx] = canvas(512); const image = ctx.createImageData(c.width, c.height);
  const mid = rgb(s.irisColor), edge = rgb(s.irisBorderColor), white = rgb(s.scleraColor);
  const radius = .17 * (1 + clamp(s.irisSize, -5, 5) * .045);
  // Native source pupil map is an inverted red mask; its central disk radius is about .12.
  const pupilScale = clamp(s.pupilSize, 0, 1.9) / 1.05;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const u = (x + .5) / c.width - .5, v = (y + .5) / c.height - .5, r = Math.hypot(u, v);
    const i = (y * c.width + x) * 4;
    let color = white;
    if (r < radius) {
      const iu = u / (radius / .475) + .5, iv = v / (radius / .475) + .5;
      const detail = .25 + .75 * (.5 * channel(iris, iu, iv, 0) + .5 * channel(iris, iu, iv, 1));
      const border = clamp((r / radius - .72) / .25);
      const pupilMask = pupilScale > .001 ? 1 - channel(pupil, u / (.42 * pupilScale) + .5, v / (.42 * pupilScale) + .5, 0, 1) : 0;
      color = mid.map((a, k) => ((a * (1 - border) + edge[k] * border) * detail) * (1 - pupilMask) + 2 * pupilMask);
    }
    image.data[i] = color[0]; image.data[i + 1] = color[1]; image.data[i + 2] = color[2]; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0); return c;
}
function maskCanvas(mask: Pixels, color: string, opacity: number, which: 'brow' | 'lash'): HTMLCanvasElement {
  const [c, ctx] = canvas(mask.width, mask.height); const out = ctx.createImageData(c.width, c.height); const col = rgb(color);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = col[0]; out.data[i + 1] = col[1]; out.data[i + 2] = col[2];
    // NNPH packs normals in RG and hair mask in B. EyelashAO green supplies exported lash cards.
    out.data[i + 3] = mask.data[i + (which === 'brow' ? 2 : 1)] * clamp(opacity);
  }
  ctx.putImageData(out, 0, 0); return c;
}
function browCanvas(base: THREE.Texture, mask: Pixels, s: Required<AppearanceSettings>, gender: AppearanceGender): HTMLCanvasElement {
  const [c, ctx] = canvas(1024);
  ctx.drawImage(base.image as CanvasImageSource, 0, 0, c.width, c.height);
  const brow = maskCanvas(mask, s.browColor, s.browOpacity, 'brow');
  // Shared exported head UV0 layout. Placement reconstructed from basecolor and native eyebrow area;
  // stripped native shader graphs do not expose the full UV transform function.
  const w = .155 * c.width, h = .0775 * c.height, cy = (gender === 'GF' ? .318 : .314) * c.height;
  for (const [cx, mirror] of [[.377, true], [.623, false]] as const) {
    ctx.save(); ctx.translate(cx * c.width, cy); ctx.scale(mirror ? -1 : 1, 1);
    ctx.drawImage(brow, -w / 2, -h / 2, w, h); ctx.restore();
  }
  return c;
}
type RecordState = {base: THREE.Texture | null; generated?: THREE.Texture; key?: string; request: number};
const materials = new WeakMap<THREE.MeshStandardMaterial, RecordState>();
let requestId = 0;
function role(material: THREE.MeshStandardMaterial): string {
  if (material.userData.role) return material.userData.role as string;
  const n = material.name.toLowerCase();
  if (n.includes('eyea') || n.includes('eye_a')) return 'lashes';
  if (n.includes('_eye')) return 'eyes';
  return n.includes('head') && !n.includes('tear') && !n.includes('hide') ? 'skin' : '';
}
/** Call on state/asset changes, not each frame. Original maps/normals remain intact for recomposition. */
export async function applyAppearance(roots: THREE.Object3D[], catalog: AppearanceCatalog, settings: AppearanceSettings, gender: AppearanceGender): Promise<void> {
  const s = {...getDefaultAppearance(gender), ...settings}; const data = catalog.genders[gender];
  const select = (list: AppearanceOption[], id: string) => list.find(o => o.id === String(id)) ?? list[0];
  const selected = {iris: select(data.iris, s.irisId), pupil: select(data.pupils, s.pupilId), brow: select(data.brows, s.browId), lash: select(data.lashes, s.lashId)};
  const key = JSON.stringify([gender, s]); const request = ++requestId;
  const targets = new Set<THREE.MeshStandardMaterial>();
  roots.forEach(root => root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      const r = role(m);
      const headSkin = r === 'skin' && /head/i.test(m.name + ' ' + (m.userData.sourceMaterial ?? ''));
      if (r !== 'eyes' && r !== 'lashes' && !headSkin) continue;
      if (r === 'eyes' || r === 'lashes') m.color.set('#ffffff');
      let state = materials.get(m);
      if (!state) { state = {base: m.map, request}; materials.set(m, state); }
      state.request = request;
      if (state.key !== key) targets.add(m);
    }
  }));
  if (!targets.size) return;
  const [iris, pupil, brow, lash] = await Promise.all([selected.iris, selected.pupil, selected.brow, selected.lash].map(o => loadPixels(o.texture)));
  for (const m of targets) {
    const state = materials.get(m); if (!state || state.request !== request) continue;
    const r = role(m); let c: HTMLCanvasElement;
    if (r === 'eyes') { c = eyeCanvas(iris, pupil, s); m.color.set('#ffffff'); }
    else if (r === 'lashes') {
      c = maskCanvas(lash, s.lashColor, s.lashOpacity, 'lash'); m.color.set('#ffffff');
      m.transparent = true; m.opacity = 1; m.alphaTest = .08; m.depthWrite = false;
    } else { if (!state.base?.image) continue; c = browCanvas(state.base, brow, s, gender); }
    const next = texture(c, state.base); const old = state.generated;
    m.map = next; state.generated = next; state.key = key; m.needsUpdate = true; old?.dispose();
  }
}

/** Release generated GPU textures before discarding an assembly. Shared source maps are retained. */
export function disposeAppearance(roots: THREE.Object3D[]): void {
  roots.forEach(root => root.traverse(obj => {
    const mesh = obj as THREE.Mesh; if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const m = material as THREE.MeshStandardMaterial, state = materials.get(m);
      if (state) { state.request = -1; m.map = state.base; state.generated?.dispose(); materials.delete(m); }
    }
  }));
}

