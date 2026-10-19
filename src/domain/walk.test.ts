import { describe, expect, it } from 'vitest';
import { cameraHeight, collisionRadius, eyeHeight, isValidHeight, walkSpeed } from './walk';

describe('walk: рост → параметры прогулки', () => {
  it('eyeHeight для 100 / 170 / 220 см', () => {
    expect(eyeHeight(100)).toBe(0.94);
    expect(eyeHeight(170)).toBe(1.59);
    expect(eyeHeight(220)).toBe(2.06);
  });

  it('камера не выше потолка минус зазор', () => {
    expect(cameraHeight(170, 2.7)).toBe(1.59);
    expect(cameraHeight(220, 2.1)).toBe(2.0);
  });

  it('диапазон роста 100–220 см', () => {
    expect(isValidHeight(50)).toBe(false);
    expect(isValidHeight(100)).toBe(true);
    expect(isValidHeight(185)).toBe(true);
    expect(isValidHeight(221)).toBe(false);
    expect(isValidHeight(Number.NaN)).toBe(false);
  });

  it('радиус и скорость растут с ростом и ограничены', () => {
    expect(collisionRadius(100)).toBe(0.18);
    expect(collisionRadius(170)).toBeCloseTo(0.221);
    expect(collisionRadius(220)).toBe(0.28);
    expect(walkSpeed(100)).toBe(1.0);
    expect(walkSpeed(170)).toBeCloseTo(1.36);
    expect(walkSpeed(220)).toBe(1.6);
  });
});
