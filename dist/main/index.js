import { Ray, Matrix4, Vector3, RingBufferGeometry, MeshBasicMaterial, Mesh, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, AdditiveBlending, Line, AudioLoader, PositionalAudio, SphereBufferGeometry, WireframeGeometry, LineSegments, EllipseCurve, Clock, Scene, Color, PerspectiveCamera, AudioListener, Raycaster, CircleBufferGeometry, MeshLambertMaterial, Group, HemisphereLight, DirectionalLight, WebGLRenderer, sRGBEncoding, MathUtils } from 'https://threejs.org/build/three.module.js';
import { VRButton } from 'https://threejs.org/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'https://threejs.org/examples/jsm/webxr/XRControllerModelFactory.js';

var workerUrl = "dist/worker/index.js";

const ray = new Ray();
const tempMatrix = new Matrix4();
function toThreeVector(workerVector) {
    const { x, y, z } = workerVector;
    return new Vector3(x, y, z);
}
function fromThreeVector(threeVector) {
    return {
        x: threeVector.x,
        y: threeVector.y,
        z: threeVector.z,
    };
}
class WorkerThread {
    constructor(raycaster) {
        this.raycaster = raycaster;
        this.worker = new Worker(workerUrl);
        this.worker.onmessage = (evt) => {
            console.log(evt.data);
            this.onMessage?.(evt.data);
        };
    }
    sendPlayerClick(controller, dome) {
        tempMatrix.identity().extractRotation(controller.controller.matrixWorld);
        ray.origin.setFromMatrixPosition(controller.controller.matrixWorld);
        ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        ray.direction.normalize();
        this.raycaster.set(ray.origin, ray.direction);
        const [{ point }] = this.raycaster.intersectObjects(dome);
        const message = {
            hand: fromThreeVector(point),
        };
        console.log(message);
        this.worker.postMessage(message);
    }
}

var domeRadius = 4;

// The XRControllerModelFactory will automatically fetch controller models
// that match what the user is holding as closely as possible. The models
// should be attached to the object returned from getControllerGrip in
// order to match the orientation of the held device.
const controllerModelFactory = new XRControllerModelFactory();
class ControllerManager {
    constructor(xrManager, id) {
        this.isSelecting = false;
        this.isSqueezing = false;
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
            this.controller.add(this.buildController(event.data));
        });
        this.controller.addEventListener('disconnected', () => {
            this.controller.remove(this.controller.children[0]);
        });
        this.grip = xrManager.getControllerGrip(id);
        this.grip.add(controllerModelFactory.createControllerModel(this.grip));
    }
    buildController(data) {
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
                this.geometry = new BufferGeometry();
                this.geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
                this.geometry.setAttribute('color', new Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
                this.material = new LineBasicMaterial({
                    color: 0xff0000,
                    vertexColors: true,
                    blending: AdditiveBlending,
                });
                return new Line(this.geometry, this.material);
            /**
             * gaze indicates the target ray will originate at the viewer and follow
             * the direction it is facing. (This is commonly referred to as a "gaze
             * input" device in the context of head-mounted displays.)
             */
            case 'gaze':
                this.geometry = new RingBufferGeometry(0.02, 0.04, 32).translate(0, 0, -1);
                this.material = new MeshBasicMaterial({
                    opacity: 0.5,
                    transparent: true,
                });
                return new Mesh(this.geometry, this.material);
            case 'screen':
                return undefined;
        }
    }
    render() {
        if (this.isSelecting) {
            this.material?.color?.setHex(0x00ff00);
        }
        else {
            this.material?.color?.setHex(0xff0000);
        }
    }
}

const audioLoader = new AudioLoader();
class Sound {
    constructor(listener) {
        this.audio = new PositionalAudio(listener);
    }
    async load(url) {
        const buffer = await audioLoader.loadAsync(url);
        this.audio.setBuffer(buffer);
    }
    play() {
        if (this.audio.isPlaying) {
            this.audio.stop();
            this.audio.isPlaying = false;
        }
        this.audio.play();
    }
}
class SoundSphere {
    constructor(listener, color) {
        this.sound = new Sound(listener);
        const sphere = new SphereBufferGeometry(0.25, 8, 6);
        const wireframe = new WireframeGeometry(sphere);
        this.mesh = new LineSegments(wireframe, new LineBasicMaterial({ color }));
        this.mesh.visible = false;
        this.mesh.add(this.sound.audio);
    }
    async load(url) {
        return this.sound.load(url);
    }
    play(x, y, z) {
        /*if (this.audio.isPlaying) {
          this.audio.stop()
        }*/
        this.mesh.position.set(x, y, z);
        this.sound.play();
    }
}

function getPoints(radius, startAngle, endAngle) {
    const curve = new EllipseCurve(0, 0, radius, radius, startAngle, endAngle, false, 0);
    return curve.getPoints(50);
}
class Arc {
    constructor(sphereRadius, height) {
        const h = sphereRadius - height;
        const rSquared = (2 * h * sphereRadius) - (h ** 2);
        this.radius = Math.sqrt(rSquared);
        this.geometry = new BufferGeometry();
        const arcMaterial = new LineBasicMaterial({ color: 0x00ff00 });
        this.line = new Line(this.geometry, arcMaterial);
        this.line.lookAt(0, 1, 0);
        this.line.rotateX(Math.PI);
        this.line.position.y = height;
        this.reset();
    }
    reset() {
        this.geometry.setFromPoints(getPoints(this.radius, 0, 2 * Math.PI));
    }
    set(startAngle, endAngle) {
        this.geometry.setFromPoints(getPoints(this.radius, startAngle, endAngle));
    }
}

let camera;
let audioListener;
let scene;
let renderer;
let controller1, controller2;
let beepSound;
let goodSound;
let badSound;
let pointerResult;
let raycaster;
let arc;
let room;
// let count = 0;
const radius = 0.08;
let normal = new Vector3();
const relativeVelocity = new Vector3();
const clock = new Clock();
init();
animate();
function init() {
    scene = new Scene();
    scene.background = new Color(0x505050);
    camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
    camera.position.set(0, 1.6, 3);
    audioListener = new AudioListener();
    camera.add(audioListener);
    raycaster = new Raycaster();
    raycaster.camera = camera;
    beepSound = new SoundSphere(audioListener, 0xaa3939);
    beepSound.load('assets/audio/echo.wav');
    scene.add(beepSound.mesh);
    const pointerSphere = new SphereBufferGeometry(0.25, 8, 6);
    const pointerWireframe = new WireframeGeometry(pointerSphere);
    const pointerMaterial = new LineBasicMaterial({ color: 0x0ad0ff });
    pointerResult = new LineSegments(pointerWireframe, pointerMaterial);
    scene.add(pointerResult);
    goodSound = new Sound(audioListener);
    goodSound.load('assets/audio/correct.wav');
    pointerResult.add(goodSound.audio);
    badSound = new Sound(audioListener);
    badSound.load('assets/audio/wrong.wav');
    pointerResult.add(badSound.audio);
    arc = new Arc(domeRadius, domeRadius / 4);
    scene.add(arc.line);
    const worker = new WorkerThread(raycaster);
    worker.onMessage = (data) => {
        switch (data.type) {
            case 'play_audio': {
                const { x, y, z } = data.audioPosition;
                beepSound.play(x, y, z);
                arc.reset();
                break;
            }
            case 'display_result': {
                const { pointerPosition, arcCurve, goodGuess } = data;
                if (pointerPosition) {
                    pointerResult.position.copy(toThreeVector(pointerPosition));
                }
                if (arcCurve) {
                    arc.set(arcCurve.startAngle, arcCurve.endAngle);
                }
                if (goodGuess) {
                    goodSound.play();
                }
                else {
                    badSound.play();
                }
                break;
            }
        }
    };
    const sphereGeometry = new SphereBufferGeometry(domeRadius, 20, 20, 0, undefined, Math.PI / 2);
    sphereGeometry.rotateX(Math.PI);
    const wireframe = new WireframeGeometry(sphereGeometry);
    const dome = new LineSegments(wireframe, new LineBasicMaterial({ color: 0x808080 }));
    scene.add(dome);
    const circle = new CircleBufferGeometry(domeRadius, 20);
    const floor = new Mesh(circle, new MeshLambertMaterial({
        color: 0x111111,
    }));
    floor.geometry.rotateX(-Math.PI / 2);
    scene.add(floor);
    let roomBox = new Group();
    scene.add(roomBox);
    room = roomBox;
    scene.add(new HemisphereLight(0x606060, 0x404040));
    const light = new DirectionalLight(0xffffff);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);
    //
    renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = sRGBEncoding;
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
    function onSelect() {
        worker.sendPlayerClick(this, [dome, floor]);
    }
    controller1.onselect = onSelect;
    controller2.onselect = onSelect;
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
    const debug = controller1.isSqueezing || controller2.isSqueezing;
    beepSound.mesh.visible = debug;
    pointerResult.visible = debug;
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
            object.position.x = MathUtils.clamp(object.position.x, -range, range);
            object.userData.velocity.x = -object.userData.velocity.x;
        }
        if (object.position.y < radius || object.position.y > 6) {
            object.position.y = Math.max(object.position.y, radius);
            object.userData.velocity.x *= 0.98;
            object.userData.velocity.y = -object.userData.velocity.y * 0.8;
            object.userData.velocity.z *= 0.98;
        }
        if (object.position.z < -range || object.position.z > range) {
            object.position.z = MathUtils.clamp(object.position.z, -range, range);
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
//# sourceMappingURL=index.js.map