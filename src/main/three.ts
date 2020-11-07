import * as THREE from 'three';

import { VRButton } from 'https://threejs.org/examples/jsm/webxr/VRButton.js';
import { ControllerManager } from './controller';

let camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer;
let controller1: ControllerManager, controller2: ControllerManager;

let room: THREE.Object3D;

// let count = 0;
const radius = 0.08;
let normal = new THREE.Vector3();
const relativeVelocity = new THREE.Vector3();

const clock = new THREE.Clock();

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x505050);

  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    10
  );
  camera.position.set(0, 1.6, 3);

  const sphereGeometry = new THREE.SphereBufferGeometry(
    4,
    20,
    20,
    0,
    undefined,
    Math.PI / 2
  );
  sphereGeometry.rotateX(Math.PI);
  const wireframe = new THREE.WireframeGeometry(sphereGeometry);
  const dome = new THREE.LineSegments(
    wireframe,
    new THREE.LineBasicMaterial({ color: 0x808080 })
  );
  scene.add(dome);

  const circle = new THREE.CircleBufferGeometry(4, 20)
  const floor = new THREE.Mesh(
    circle,
    new THREE.MeshLambertMaterial({
      color: 0x111111,
    })
  );
  floor.geometry.rotateX(-Math.PI / 2);
  scene.add(floor);

  let roomBox = new THREE.Group();
  scene.add(roomBox);
  room = roomBox;

  scene.add(new THREE.HemisphereLight(0x606060, 0x404040));

  const light = new THREE.DirectionalLight(0xffffff);
  light.position.set(1, 1, 1).normalize();
  scene.add(light);

  const geometry = new THREE.IcosahedronBufferGeometry(radius, 3);

  for (let i = 0; i < 200; i++) {
    const object = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff })
    );

    object.position.x = Math.random() * 4 - 2;
    object.position.y = Math.random() * 4;
    object.position.z = Math.random() * 4 - 2;

    object.userData.velocity = new THREE.Vector3();
    object.userData.velocity.x = Math.random() * 0.01 - 0.005;
    object.userData.velocity.y = Math.random() * 0.01 - 0.005;
    object.userData.velocity.z = Math.random() * 0.01 - 0.005;

    room.add(object);
  }

  //

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  //

  document.body.appendChild(VRButton.createButton(renderer));

  // controllers

  controller1 = new ControllerManager(renderer.xr, 0);
  scene.add(controller1.controller);

  controller2 = new ControllerManager(renderer.xr, 1);
  scene.add(controller2.controller);

  scene.add(controller1.grip);
  scene.add(controller2.grip);

  //

  window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

//

function animate() {
  renderer.setAnimationLoop(render);
}

function render() {
  controller1.render();
  controller2.render();

  //

  const delta = clock.getDelta() * 0.8; // slow down simulation

  const range = 3 - radius;

  for (let i = 0; i < room.children.length; i++) {
    const object = room.children[i];

    object.position.x += object.userData.velocity.x * delta;
    object.position.y += object.userData.velocity.y * delta;
    object.position.z += object.userData.velocity.z * delta;

    // keep objects inside room

    if (object.position.x < -range || object.position.x > range) {
      object.position.x = THREE.MathUtils.clamp(
        object.position.x,
        -range,
        range
      );
      object.userData.velocity.x = -object.userData.velocity.x;
    }

    if (object.position.y < radius || object.position.y > 6) {
      object.position.y = Math.max(object.position.y, radius);

      object.userData.velocity.x *= 0.98;
      object.userData.velocity.y = -object.userData.velocity.y * 0.8;
      object.userData.velocity.z *= 0.98;
    }

    if (object.position.z < -range || object.position.z > range) {
      object.position.z = THREE.MathUtils.clamp(
        object.position.z,
        -range,
        range
      );
      object.userData.velocity.z = -object.userData.velocity.z;
    }

    for (let j = i + 1; j < room.children.length; j++) {
      const object2 = room.children[j];

      normal.copy(object.position).sub(object2.position);

      const distance = normal.length();

      if (distance < 2 * radius) {
        normal.multiplyScalar(0.5 * distance - radius);

        object.position.sub(normal);
        object2.position.add(normal);

        normal.normalize();

        relativeVelocity
          .copy(object.userData.velocity)
          .sub(object2.userData.velocity);

        normal = normal.multiplyScalar(relativeVelocity.dot(normal));

        object.userData.velocity.sub(normal);
        object2.userData.velocity.add(normal);
      }
    }

    object.userData.velocity.y -= 9.8 * delta;
  }

  renderer.render(scene, camera);
}
