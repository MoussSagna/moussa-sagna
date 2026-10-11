import { describe, expect, it } from 'vitest';
import { INTRO_MS, computeCamera } from './camera';

const CENTER = { x: 0, y: 0 };

describe('computeCamera', () => {
  it('ouvre sur un plan serré puis recule', () => {
    const start = computeCamera(0, 0, CENTER, false);
    const settled = computeCamera(0, INTRO_MS, CENTER, false);
    expect(start.zoom).toBeGreaterThan(settled.zoom);
    expect(start.ox).toBeGreaterThan(settled.ox);
    expect(settled.zoom).toBeCloseTo(1.045, 5);
  });

  it('ne bouge plus après la fin du travelling, hors respiration', () => {
    const end = computeCamera(0, INTRO_MS, CENTER, false);
    const later = computeCamera(0, INTRO_MS * 4, CENTER, false);
    expect(later).toEqual(end);
  });

  it('reste fixe quand les animations sont réduites, quel que soit le moment', () => {
    for (const [time, introMs] of [
      [0, 0],
      [3, 1200],
      [40, 90000],
    ]) {
      expect(computeCamera(time, introMs, CENTER, true)).toEqual({ ox: 0, oy: 0, zoom: 1.045 });
    }
  });

  it('suit le pointeur même quand les animations sont réduites', () => {
    const camera = computeCamera(10, INTRO_MS, { x: 1, y: -1 }, true);
    expect(camera.ox).toBeCloseTo(0.02, 5);
    expect(camera.oy).toBeCloseTo(-0.008, 5);
  });
});
