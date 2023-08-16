import { expect, test } from 'vitest'
import { GameState, SphericalPoint } from '../../src/worker/level-record.js';

test('gameState.completeLevel', () => {
  const game = new GameState(15);

  expect(() => game.completeLevel({ theta: 0, phi: 0 })).toThrow();

  const audioPosition: SphericalPoint = { theta: 2, phi: 1 };
  const pointerPosition: SphericalPoint = { theta: 1.5, phi: 1.1 };
  game.startLevel(audioPosition, 500);
  expect(game.completeLevel(pointerPosition, 590)).toEqual({
    audio: audioPosition,
    pointer: pointerPosition,
    startTime: 500,
    endTime: 590,
  });
});
