import { Vector } from './level-record';

/**
 * Taken from d3-geo.
 */
export function haversin(x: number) {
  return (x = Math.sin(x / 2)) * x;
}

/**
 * Function to generate random number
 * https://www.geeksforgeeks.org/how-to-generate-random-number-in-given-range-using-javascript/
 */
export function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/**
 * Get dot product for 2 vectors
 */
export function dot(a: Vector, b: Vector) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function scale(c: number, v: Vector) {
  return { x: c * v.x, y: c * v.y, z: c * v.z };
}

export function add(a: Vector, b: Vector) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
