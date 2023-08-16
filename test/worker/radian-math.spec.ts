import { expect, test } from 'vitest';
import { ZERO } from '../../src/worker/math.js';
import {
  cartesianToSpherical,
  raycastOnSphereToPoint,
  sphericalInterpolate,
  sphericalToCartesian,
} from '../../src/worker/radian-math.js';

test.skip('raycastOnSphereToPoint', () => {
  expect(
    raycastOnSphereToPoint(
      {
        origin: ZERO,
        direction: { x: 0, y: 1, z: 0 },
      },
      1
    )
  ).toEqual({ x: 0, y: 1, z: 0 });

  expect(
    raycastOnSphereToPoint(
      {
        origin: ZERO,
        direction: { x: 1, y: 0, z: 0 },
      },
      15
    )
  ).toEqual({ x: 15, y: 0, z: 0 });

  expect(
    raycastOnSphereToPoint(
      {
        origin: {
          x: -0.27254772186279297,
          y: 1.426231026649475,
          z: 0.015554174780845642,
        },
        direction: {
          x: 0.5681502185421388,
          y: 0.3375724233702126,
          z: -0.7504999587944574,
        },
      },
      4
    )
  ).toEqual({ x: 15, y: 0, z: 0 });
});

test('sphericalInterpolate', () => {
  const interpolate = sphericalInterpolate(
    { theta: 0, phi: 0 },
    { theta: 0, phi: Math.PI }
  );
  expect(interpolate(0.5)).toEqual({ theta: 0, phi: Math.PI / 2 });
});

test('cartesianToSpherical', () => {
  expect(cartesianToSpherical({ x: 1, y: 0, z: 0 })).toEqual({
    theta: Math.PI / 2,
    phi: 0,
  });

  expect(cartesianToSpherical({ x: 0, y: 1, z: 0 })).toEqual({
    theta: 0,
    phi: 0,
  });

  expect(cartesianToSpherical({ x: 0, y: -1, z: 0 })).toEqual({
    theta: 0,
    phi: 0,
  });
});

test('sphericalToCartesian', () => {
  const toX = sphericalToCartesian({ theta: Math.PI / 2, phi: 0 }, 1);
  expect(1).toBeCloseTo(toX.x);
  expect(0).toBeCloseTo(toX.y);
  expect(0).toBeCloseTo(toX.z);

  expect(sphericalToCartesian({ theta: 0, phi: 0 }, 1)).toEqual({
    x: 0,
    y: 1,
    z: 0,
  });
});
