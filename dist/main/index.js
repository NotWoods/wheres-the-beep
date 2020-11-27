import { Ray, Matrix4, Vector3, RingBufferGeometry, MeshBasicMaterial, Mesh, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, AdditiveBlending, Line, AudioLoader, PositionalAudio, SphereBufferGeometry, BackSide, CylinderBufferGeometry, Object3D, AnimationMixer, FontLoader, FrontSide, Group, TextGeometry, Clock, Scene, Color, PerspectiveCamera, AudioListener, Raycaster, NumberKeyframeTrack, AnimationClip, LoopOnce, CircleBufferGeometry, MeshLambertMaterial, HemisphereLight, DirectionalLight, WebGLRenderer, sRGBEncoding } from 'https://threejs.org/build/three.module.js';
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
    constructor(radius, outlineColor, transparent = false) {
        this._debug = false;
        this._visible = false;
        const geometry = new SphereBufferGeometry(radius, 12, 10);
        this.outlineMaterial = new MeshBasicMaterial({
            color: outlineColor,
            side: BackSide,
            transparent,
        });
        const beepOutline = new Mesh(new SphereBufferGeometry(0.08, 12, 10), this.outlineMaterial);
        beepOutline.scale.multiplyScalar(1.1);
        beepOutline.visible = false;
        this.outlineMesh = beepOutline;
        this.material = new MeshBasicMaterial({
            color: 0x000000,
        });
        this.mesh = new Mesh(geometry, this.material);
        this.mesh.visible = false;
    }
    addToGroup(group) {
        group.add(this.outlineMesh);
        group.add(this.mesh);
    }
    setPosition(position) {
        this.mesh.position.copy(position);
        this.outlineMesh.position.copy(position);
    }
    set debug(value) {
        this._debug = value;
        this.material.wireframe = value;
        this.render();
    }
    set visible(value) {
        this._visible = value;
        this.render();
    }
    set opacity(value) {
        this.outlineMaterial.opacity = value;
    }
    render() {
        this.outlineMesh.visible = this._visible || this._debug;
        this.mesh.visible = this._visible || this._debug;
    }
}

const ANIMATION_LENGTH = 1;
class IndicatorCone {
    constructor() {
        this.endpoints = [];
        this.startTime = -1;
        this.targetLength = 1;
        const coneGeometry = new CylinderBufferGeometry(0.005, 0.005, 1, 10, 1, false);
        coneGeometry.rotateX(Math.PI / 2);
        const coneMaterial = new MeshBasicMaterial({
            color: 0xffffff,
            depthTest: false,
        });
        const coneInner = new Mesh(coneGeometry, coneMaterial);
        coneInner.position.set(0, 0, 0.5);
        const scaled = new Object3D();
        scaled.add(coneInner);
        const cone = new Object3D();
        cone.add(scaled);
        cone.visible = false;
        this.scaled = scaled;
        this.obj = cone;
        this.mixer = new AnimationMixer(cone);
    }
    hide() {
        this.obj.visible = false;
        this.startTime = -1;
    }
    set length(value) {
        this.scaled.scale.z = value;
    }
    show(length, start, end) {
        this.startTime = this.mixer.time;
        this.targetLength = length;
        this.obj.position.copy(start);
        this.obj.lookAt(end);
        this.length = 0.01;
        this.obj.visible = true;
        for (const endpoint of this.endpoints) {
            endpoint.opacity = 0;
        }
    }
    render() {
        if (this.startTime < 0)
            return;
        if (this.mixer.time > this.startTime + ANIMATION_LENGTH) {
            this.length = this.targetLength;
            for (const endpoint of this.endpoints) {
                endpoint.opacity = 1;
            }
        }
        else {
            const timePassed = this.mixer.time - this.startTime;
            const percentagePassed = timePassed / ANIMATION_LENGTH;
            this.length = this.targetLength * percentagePassed;
            for (const endpoint of this.endpoints) {
                endpoint.opacity = percentagePassed;
            }
        }
    }
}

class Dome {
    constructor(domeRadius) {
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
}

const loader = new FontLoader();
class Score {
    constructor() {
        this.material = new MeshBasicMaterial({ color: 0x111111, side: FrontSide });
        this.ready = this.load();
        this.group = new Group();
        this.group.position.y = 0.01;
        this.group.rotateX(-Math.PI / 2);
    }
    async load() {
        this.font = await loader.loadAsync('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json');
    }
    async setScore(value) {
        await this.ready;
        const geometry = new TextGeometry(value, {
            font: this.font,
            size: 0.5,
            height: 0,
            curveSegments: 12,
        });
        const mesh = new Mesh(geometry, this.material);
        if (this.mesh) {
            this.group.remove(this.mesh);
        }
        this.group.add(mesh);
        this.mesh = mesh;
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
const mixers = [];
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
    mixers.push(cone.mixer);
    const beepSound = new Sound(audioListener);
    beepSound.load('assets/audio/echo.wav');
    beepMesh = new Sphere(0.08, 0xffffff, true);
    beepMesh.mesh.add(beepSound.audio);
    beepMesh.addToGroup(scene);
    cone.endpoints.push(beepMesh.material, beepMesh.outlineMaterial);
    pointerResult = new Sphere(0.08, 0xf76a6f);
    const goodSound = new Sound(audioListener);
    goodSound.load('assets/audio/correct.wav');
    pointerResult.mesh.add(goodSound.audio);
    const badSound = new Sound(audioListener);
    badSound.load('assets/audio/incorrect.wav');
    pointerResult.mesh.add(badSound.audio);
    pointerResult.addToGroup(scene);
    const score = new Score();
    score.setScore('0');
    //
    const fadeOutKF = new NumberKeyframeTrack('.material.opacity', [0, 5], [1, 0]);
    const domeMixer = new AnimationMixer(dome.obj);
    mixers.push(domeMixer);
    const fadeOutAction = domeMixer.clipAction(new AnimationClip('FadeOutDome', 5, [fadeOutKF]));
    fadeOutAction.clampWhenFinished = true;
    fadeOutAction.loop = LoopOnce;
    domeMixer.addEventListener('finished', () => {
        dome.obj.visible = false;
    });
    //
    worker = new WorkerThread(raycaster);
    worker.onMessage = (data) => {
        switch (data.type) {
            case 'play_audio': {
                const { audioPosition } = data;
                beepMesh.setPosition(toThreeVector(audioPosition));
                beepSound.play();
                cone.hide();
                beepMesh.visible = false;
                pointerResult.visible = false;
                break;
            }
            case 'display_result': {
                const { pointerPosition, line, goodGuess } = data;
                score.setScore(data.score.toString());
                if (pointerPosition) {
                    pointerResult.setPosition(toThreeVector(pointerPosition));
                    pointerResult.visible = true;
                    beepMesh.visible = true;
                    if (line) {
                        cone.show(line.length, toThreeVector(pointerPosition), toThreeVector(line.end));
                    }
                    pointerResult.outlineMaterial.color.setHex(goodGuess ? 0x6af797 : 0xf76a6f);
                }
                if (goodGuess) {
                    goodSound.play();
                }
                else {
                    badSound.play();
                }
                fadeOutAction.play();
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
    floor.add(score.group);
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
    for (const mixer of mixers) {
        mixer.update(delta);
    }
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
    controller1.render();
    controller2.render();
    cone.render();
    //
    renderer.render(scene, camera);
}
//# sourceMappingURL=index.js.map
