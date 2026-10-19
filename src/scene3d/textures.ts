/**
 * Процедурные текстуры пола (без файлов и сети). Они почти белые: цвет задаёт материал,
 * поэтому смена отделки — это плавная смена material.color, а текстура остаётся той же.
 */
import * as THREE from 'three';
import { createRng } from '../domain/rng';

const SIZE = 512;
/** Сколько метров пола покрывает одна текстура. */
export const WOOD_TILE_M = 2;
export const TILE_TILE_M = 1.2;

let wood: THREE.CanvasTexture | null = null;
let tile: THREE.CanvasTexture | null = null;

function finish(canvas: HTMLCanvasElement, metres: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metres, 1 / metres);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shade(g: CanvasRenderingContext2D, l: number) {
  const v = Math.round(255 * l);
  g.fillStyle = `rgb(${v},${v},${v})`;
}

/** Паркетная доска: 8 рядов, доски разной длины и тона, тонкие швы. */
export function woodTexture(): THREE.Texture {
  if (wood) return wood;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const rng = createRng(11);
  const rows = 8;
  const h = SIZE / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rng.float(0, 300);
    while (x < SIZE) {
      const len = rng.float(220, 420);
      shade(g, rng.float(0.86, 0.97));
      g.fillRect(x, r * h, len, h);
      g.globalAlpha = 0.06;
      for (let k = 0; k < 7; k++) {
        shade(g, k % 2 ? 0.3 : 1);
        g.fillRect(x, r * h + rng.float(2, h - 3), len, rng.float(0.6, 1.6));
      }
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(0,0,0,.22)';
      g.lineWidth = 1.2;
      g.strokeRect(x + 0.5, r * h + 0.5, len, h);
      x += len;
    }
  }
  wood = finish(c, WOOD_TILE_M);
  return wood;
}

/** Плитка 4×4 с затиркой. */
export function tileTexture(): THREE.Texture {
  if (tile) return tile;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const rng = createRng(5);
  const n = 4;
  const s = SIZE / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      shade(g, rng.float(0.93, 0.99));
      g.fillRect(i * s, j * s, s, s);
    }
  }
  g.strokeStyle = 'rgba(0,0,0,.16)';
  g.lineWidth = 4;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * s, 0);
    g.lineTo(i * s, SIZE);
    g.moveTo(0, i * s);
    g.lineTo(SIZE, i * s);
    g.stroke();
  }
  tile = finish(c, TILE_TILE_M);
  return tile;
}
