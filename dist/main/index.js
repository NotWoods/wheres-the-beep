import { Ray, Matrix4, Vector3, RingBufferGeometry, MeshBasicMaterial, Mesh, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, AdditiveBlending, Line, AudioLoader, PositionalAudio, SphereBufferGeometry, CylinderBufferGeometry, Object3D, AnimationMixer, Clock, Scene, Color, PerspectiveCamera, AudioListener, Raycaster, BackSide, CircleBufferGeometry, MeshLambertMaterial, HemisphereLight, DirectionalLight, WebGLRenderer, sRGBEncoding } from 'https://threejs.org/build/three.module.js';
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
    start() {
        this.worker.postMessage({});
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
    render() { }
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
class Sphere {
    constructor(radius) {
        this.debug = false;
        this.visible = false;
        const geometry = new SphereBufferGeometry(radius, 12, 10);
        this.material = new MeshBasicMaterial({
            color: 0x000000,
        });
        this.mesh = new Mesh(geometry, this.material);
    }
    render() {
        this.material.wireframe = this.debug;
        this.mesh.visible = this.visible || this.debug;
    }
}

const ANIMATION_LENGTH = 1;
class IndicatorCone {
    constructor() {
        this.startTime = -1;
        this.targetLength = 1;
        const coneGeometry = new CylinderBufferGeometry(0.005, 0.005, 1, 10, 1, false);
        coneGeometry.rotateX(Math.PI / 2);
        const coneMaterial = new MeshBasicMaterial({
            color: 0xffffff,
            depthTest: false
        });
        const coneInner = new Mesh(coneGeometry, coneMaterial);
        const cone = new Object3D();
        coneInner.position.set(0, 0, 0.5);
        cone.add(coneInner);
        cone.visible = false;
        this.obj = cone;
        this.mixer = new AnimationMixer(cone);
    }
    hide() {
        this.obj.visible = false;
        this.startTime = -1;
    }
    show(length, start, end) {
        this.startTime = this.mixer.time;
        this.targetLength = length;
        this.obj.position.copy(start);
        this.obj.lookAt(end);
        this.obj.scale.z = 0.01;
        this.obj.visible = true;
    }
    render() {
        if (this.startTime < 0)
            return;
        if (this.mixer.time > this.startTime + ANIMATION_LENGTH) {
            this.obj.scale.z = this.targetLength;
        }
        else {
            const timePassed = this.mixer.time - this.startTime;
            const percentagePassed = timePassed / ANIMATION_LENGTH;
            this.obj.scale.z = this.targetLength * percentagePassed;
        }
    }
}

const ANIMATION_LENGTH$1 = 5;
class Dome {
    constructor(domeRadius) {
        this.startTime = -1;
        const sphereGeometry = new SphereBufferGeometry(domeRadius, 20, 20, 0, undefined, Math.PI / 2);
        sphereGeometry.rotateX(Math.PI);
        this.material = new MeshBasicMaterial({
            color: 0x111111,
            wireframe: true,
            transparent: true,
        });
        const dome = new Mesh(sphereGeometry, this.material);
        this.obj = dome;
        this.mixer = new AnimationMixer(dome);
    }
    fade() {
        if (this.startTime < 0) {
            this.startTime = this.mixer.time;
        }
    }
    render() {
        if (this.startTime < 0)
            return;
        if (this.mixer.time > this.startTime + ANIMATION_LENGTH$1) {
            this.material.opacity = 0;
        }
        else {
            const timePassed = this.mixer.time - this.startTime;
            const percentagePassed = timePassed / ANIMATION_LENGTH$1;
            this.material.opacity = 1 - percentagePassed;
        }
    }
}

let camera;
let audioListener;
let scene;
let renderer;
let controller1, controller2;
let beepMesh, pointerResult;
let raycaster;
let cone;
let bgm;
let dome;
let worker;
const clock = new Clock();
init();
animate();
function init() {
    scene = new Scene();
    scene.background = new Color(0x000000);
    camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 7);
    camera.position.set(0, 1.6, 3);
    audioListener = new AudioListener();
    camera.add(audioListener);
    raycaster = new Raycaster();
    raycaster.camera = camera;
    dome = new Dome(domeRadius);
    scene.add(dome.obj);
    cone = new IndicatorCone();
    scene.add(cone.obj);
    const beepSound = new Sound(audioListener);
    beepSound.load('assets/audio/echo.wav');
    beepMesh = new Sphere(0.08);
    beepMesh.mesh.add(beepSound.audio);
    const beepOutline = new Mesh(new SphereBufferGeometry(0.08, 12, 10), new MeshBasicMaterial({ color: 0xffffff, side: BackSide }));
    beepOutline.scale.multiplyScalar(1.1);
    beepOutline.visible = false;
    scene.add(beepOutline);
    scene.add(beepMesh.mesh);
    const pointerResultRadius = 0.08;
    pointerResult = new Sphere(pointerResultRadius);
    const goodSound = new Sound(audioListener);
    goodSound.load('assets/audio/correct.wav');
    pointerResult.mesh.add(goodSound.audio);
    const badSound = new Sound(audioListener);
    badSound.load('assets/audio/incorrect.wav');
    pointerResult.mesh.add(badSound.audio);
    const outlineMaterial = new MeshBasicMaterial({
        color: 0xf76a6f,
        side: BackSide,
    });
    const pointerResultOutline = new Mesh(new SphereBufferGeometry(pointerResultRadius, 12, 10), outlineMaterial);
    pointerResultOutline.scale.multiplyScalar(1.1);
    pointerResultOutline.visible = false;
    scene.add(pointerResultOutline);
    scene.add(pointerResult.mesh);
    worker = new WorkerThread(raycaster);
    worker.onMessage = (data) => {
        switch (data.type) {
            case 'play_audio': {
                const { audioPosition } = data;
                beepMesh.mesh.position.copy(toThreeVector(audioPosition));
                beepOutline.position.copy(beepMesh.mesh.position);
                beepSound.play();
                cone.hide();
                beepMesh.visible = false;
                beepOutline.visible = false;
                pointerResultOutline.visible = false;
                pointerResult.visible = false;
                break;
            }
            case 'display_result': {
                const { pointerPosition, line, goodGuess } = data;
                if (pointerPosition) {
                    pointerResult.mesh.position.copy(toThreeVector(pointerPosition));
                    pointerResultOutline.position.copy(pointerResult.mesh.position);
                    pointerResultOutline.visible = true;
                    pointerResult.visible = true;
                    beepMesh.visible = true;
                    beepOutline.visible = true;
                    if (line) {
                        cone.show(line.length, toThreeVector(pointerPosition), toThreeVector(line.end));
                    }
                    outlineMaterial.color.setHex(goodGuess ? 0x6af797 : 0xf76a6f);
                }
                if (goodGuess) {
                    goodSound.play();
                }
                else {
                    badSound.play();
                }
                dome.fade();
                break;
            }
        }
    };
    bgm = document.getElementById('bgm');
    const bgmPanner = new PositionalAudio(audioListener);
    bgmPanner.setMediaElementSource(bgm);
    const circle = new CircleBufferGeometry(domeRadius, 20);
    const floor = new Mesh(circle, new MeshLambertMaterial({
        color: 0x000000,
    }));
    floor.geometry.rotateX(-Math.PI / 2);
    floor.add(bgmPanner);
    scene.add(floor);
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
        worker.sendPlayerClick(this, [dome.obj, floor]);
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
let xrSessionStarted = false;
function render() {
    const delta = clock.getDelta(); // slow down simulation
    cone.mixer.update(delta);
    dome.mixer.update(delta);
    const xrSession = renderer.xr.getSession() != null;
    if (xrSession !== xrSessionStarted) {
        xrSessionStarted = xrSession;
        if (xrSession) {
            bgm.play();
            worker.start();
        }
        else {
            bgm.pause();
        }
    }
    const debug = controller1.isSqueezing || controller2.isSqueezing;
    beepMesh.debug = debug;
    beepMesh.render();
    pointerResult.render();
    controller1.render();
    controller2.render();
    cone.render();
    dome.render();
    //
    renderer.render(scene, camera);
}
//# sourceMappingURL=index.js.map
