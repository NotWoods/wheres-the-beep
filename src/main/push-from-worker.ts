import * as THREE from 'three';
import workerUrl from 'consts:workerUrl';
import type { Vector } from '../worker/level-record';
import { ControllerManager } from './controller';

export interface PlayAudio {
  type: 'play_audio';
  audioPosition: Vector;
}

export interface DisplayResult {
  type: 'display_result';
  pointerPosition: Vector;
  arc: [Vector, Vector, Vector];
}

const ray = new THREE.Ray();
const tempMatrix = new THREE.Matrix4();

export class WorkerThread {
  private readonly worker = new Worker(workerUrl);

  set onmessage(value: (evt: MessageEvent<PlayAudio | DisplayResult>) => void) {
    this.worker.onmessage = value;
  }

  sendPlayerClick(controller: ControllerManager) {
    tempMatrix.identity().extractRotation(controller.controller.matrixWorld);
    ray.origin.setFromMatrixPosition(controller.controller.matrixWorld);
    ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    ray.direction.normalize();
    this.worker.postMessage({
      hand: {
        origin: {
          x: ray.origin.x,
          y: ray.origin.y,
          z: ray.origin.z,
        },
        direction: {
          x: ray.direction.x,
          y: ray.direction.y,
          z: ray.direction.z,
        },
      },
    });
  }
}
