import { expect, test } from 'vitest';
import { distanceSquared } from '../../src/worker/math.js';

test('distanceSquared', () => {
  const distSq = distanceSquared(
    { x: -1.662238460495674, y: 3.1631536178355564, z: 1.7410881016267117 },
    { x: -1.2307219371741995, y: 1.512030739326027, z: 3.4927190778376915 }
  );

  expect(distSq).toBeCloseTo(5.980624346658877);
  expect(Math.sqrt(distSq)).toBeCloseTo(2.445531505963249);
});
