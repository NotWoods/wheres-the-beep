import * as THREE from 'three';
import { XRControllerModelFactory } from 'https://threejs.org/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRInputSource } from 'three';

// The XRControllerModelFactory will automatically fetch controller models
// that match what the user is holding as closely as possible. The models
// should be attached to the object returned from getControllerGrip in
// order to match the orientation of the held device.

const controllerModelFactory = new XRControllerModelFactory();

export class ControllerManager {
  readonly controller: THREE.Group;
  readonly grip: THREE.Group;

  private geometry: THREE.BufferGeometry | undefined;
  private material:
    | THREE.MeshBasicMaterial
    | THREE.LineBasicMaterial
    | undefined;

  isSelecting = false;
  isSqueezing = false;

  onselect: ((this: ControllerManager) => void) | undefined;

  constructor(xrManager: THREE.WebXRManager, id: number) {
    this.controller = xrManager.getController(id);

    this.controller.addEventListener('selectstart', () => {
      this.isSelecting = true;
      this.onselect?.call(this);
    });
    this.controller.addEventListener('selectend', () => {
      this.isSelecting = false;
    });
    this.controller.addEventListener('squeezestart', () => {
      this.isSqueezing = true;
    });
    this.controller.addEventListener('squeezeend', () => {
      this.isSqueezing = false;
    });

    this.controller.addEventListener('connected', (event) => {
      this.controller.add(this.buildController(event.data)!);
    });
    this.controller.addEventListener('disconnected', () => {
      this.controller.remove(this.controller.children[0]);
    });

    this.grip = xrManager.getControllerGrip(id);
    this.grip.add(controllerModelFactory.createControllerModel(this.grip));
  }

  buildController(data: XRInputSource) {
    switch (data.targetRayMode) {
      /**
       * tracked-pointer indicates that the target ray originates from either a
       * handheld device or other hand-tracking mechanism and represents that the
       * user is using their hands or the held device for pointing.
       * The orientation of the target ray relative to the tracked object MUST
       * follow platform-specific ergonomics guidelines when available. In the
       * absence of platform-specific guidance, the target ray SHOULD point in
       * the same direction as the user’s index finger if it was outstretched.
       */
      case 'tracked-pointer':
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)
        );
        this.geometry.setAttribute(
          'color',
          new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
        );

        this.material = new THREE.LineBasicMaterial({
          color: 0xff0000,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
        });

        return new THREE.Line(this.geometry, this.material);

      /**
       * gaze indicates the target ray will originate at the viewer and follow
       * the direction it is facing. (This is commonly referred to as a "gaze
       * input" device in the context of head-mounted displays.)
       */
      case 'gaze':
        this.geometry = new THREE.RingBufferGeometry(0.02, 0.04, 32).translate(
          0,
          0,
          -1
        );
        this.material = new THREE.MeshBasicMaterial({
          opacity: 0.5,
          transparent: true,
        });
        return new THREE.Mesh(this.geometry, this.material);

      case 'screen':
        return undefined;
    }
  }

  render() {
    if (this.isSelecting) {
      this.material?.color?.setHex(0x00ff00);
    } else {
      this.material?.color?.setHex(0xff0000);
    }
  }
}
