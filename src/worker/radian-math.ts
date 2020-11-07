import { Ray, SphericalPoint, Vector } from './level-record';
import { add, dot, haversin, scale } from './math';

/**
 * Find the point where the ray intersects with a sphere centered at the origin.
 * https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-sphere-intersection
 */
export function raycastOnSphere(
  ray: Ray,
  sphereRadius: number
): number | undefined {
  // sphere's origin is 0, 0, 0
  const radius2 = sphereRadius ** 2;
  const L = { x: -ray.origin.x, y: -ray.origin.y, z: -ray.origin.z };
  const tca = dot(L, ray.direction);
  if (tca < 0) return undefined;
  const d2 = dot(L, L) - tca ** 2;
  if (d2 > radius2) return undefined;
  const thc = Math.sqrt(radius2 - d2);
  let t0 = tca - thc;
  let t1 = tca + thc;

  if (t0 > t1) {
    const oldt1 = t1;
    t1 = t0;
    t0 = oldt1;
  }

  if (t0 < 0) {
    // if t0 is negative, let's use t1 instead
    t0 = t1;
    // if both t0 and t1 are negative
    if (t0 < 0) return undefined;
  }

  return t0;
}

export function rayToPoint(ray: Ray, distance: number) {
  return add(ray.origin, scale(distance, ray.direction));
}

export function raycastOnSphereToPoint(
  ray: Ray,
  sphereRadius: number
): Vector | undefined {
  const t = raycastOnSphere(ray, sphereRadius);
  if (t == undefined) return undefined;
  return rayToPoint(ray, t);
}

/**
 * Returns an interpolator function given two points.
 * The returned interpolator function takes a single argument t,
 * where t is a number ranging from 0 to 1;
 * a value of 0 returns the point `from`,
 * while a value of 1 returns the point `to`.
 * Intermediate values interpolate from between them along the great arc
 * that passes through both. If they are antipodes,
 * an arbitrary great arc is chosen.
 *
 * Taken from d3-geo and modified to use radians.
 */
export function sphericalInterpolate(from: SphericalPoint, to: SphericalPoint) {
  const x0 = from.phi;
  const y0 = from.theta;
  const x1 = to.phi;
  const y1 = to.theta;

  const cy0 = Math.cos(y0),
    sy0 = Math.sin(y0),
    cy1 = Math.cos(y1),
    sy1 = Math.sin(y1),
    kx0 = cy0 * Math.cos(x0),
    ky0 = cy0 * Math.sin(x0),
    kx1 = cy1 * Math.cos(x1),
    ky1 = cy1 * Math.sin(x1),
    d =
      2 *
      Math.asin(Math.sqrt(haversin(y1 - y0) + cy0 * cy1 * haversin(x1 - x0))),
    k = Math.sin(d);

  if (d === 0) {
    function interpolate() {
      return from;
    }

    interpolate.distance = 0;
    return interpolate;
  } else {
    function interpolate(t: number): SphericalPoint {
      const B = Math.sin((t *= d)) / k,
        A = Math.sin(d - t) / k,
        x = A * kx0 + B * kx1,
        y = A * ky0 + B * ky1,
        z = A * sy0 + B * sy1;

      return {
        theta: Math.atan2(z, Math.sqrt(x * x + y * y)),
        phi: Math.atan2(y, x),
      };
    }

    interpolate.distance = d;
    return interpolate;
  }
}

export function cartesianToSpherical(vector: Vector): SphericalPoint {
  const polar = Math.atan(Math.sqrt(vector.x ** 2 + vector.z ** 2) / vector.y);
  if (polar === 0) {
    return { theta: 0, phi: 0 };
  }

  const azimuthal = Math.atan(vector.z / vector.x);
  return { theta: polar, phi: azimuthal };
}

export function sphericalToCartesian(
  point: SphericalPoint,
  sphereRadius: number
): Vector {
  const x = sphereRadius * Math.sin(point.theta) * Math.cos(point.phi);
  const z = sphereRadius * Math.sin(point.theta) * Math.sin(point.phi);
  const y = sphereRadius * Math.cos(point.theta);
  return { x, y, z };
}
