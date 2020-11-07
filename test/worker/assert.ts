import floatEqual from 'float-equal';

export function closeTo(actual: number, expected: number, message?: string) {
  if (!floatEqual(actual, expected)) {
    throw new Error(message || `${actual} is not close to ${expected}`);
  }
}
