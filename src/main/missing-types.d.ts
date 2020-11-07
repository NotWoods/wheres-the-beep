declare module 'consts:workerUrl' {
  const url: string;
  export default url;
}

declare module 'consts:radius' {
  const radius: number;
  export default radius;
}

declare module 'https://threejs.org/examples/jsm/webxr/VRButton.js' {
  export class VRButton {
    static createButton(renderer: THREE.Renderer): HTMLButtonElement;
  }
}

declare module 'https://threejs.org/examples/jsm/webxr/XRControllerModelFactory.js' {
  import * as THREE from 'three';

  export class XRControllerModel extends THREE.Object3D {}

  export class XRControllerModelFactory {
    constructor(gltfLoader?: unknown | null);

    createControllerModel(controller): XRControllerModel;
  }
}
