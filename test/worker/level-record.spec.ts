import test from 'ava';
import { GameState, SphericalPoint } from '../../src/worker/level-record';

test('gameState.completeLevel', (t) => {
  const game = new GameState(15);

  t.throws(() => game.completeLevel({ theta: 0, phi: 0 }));

  const audioPosition: SphericalPoint = { theta: 2, phi: 1 };
  const pointerPosition: SphericalPoint = { theta: 1.5, phi: 1.1 };
  game.startLevel(audioPosition, 500);
  t.deepEqual(game.completeLevel(pointerPosition, 590), {
    audio: audioPosition,
    pointer: pointerPosition,
    startTime: 500,
    endTime: 590,
  });
});
