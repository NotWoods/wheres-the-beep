var domeRadius = 4;

class GameState {
    constructor(stageRadius) {
        this.stageRadius = stageRadius;
        this.completedLevels = [];
    }
    startLevel(audioPosition, now = Date.now()) {
        if (this.currentLevel) {
            this.completeLevel(undefined, now);
        }
        const level = {
            audio: audioPosition,
            startTime: now,
        };
        this.currentLevel = level;
        return level;
    }
    completeLevel(pointerPosition, now = Date.now()) {
        if (!this.currentLevel) {
            throw new Error('Cannot complete level before it starts');
        }
        const level = this.currentLevel;
        level.pointer = pointerPosition;
        level.endTime = now;
        this.completedLevels.push(level);
        this.currentLevel = undefined;
        return level;
    }
}

const ZERO = { x: 0, y: 0, z: 0 };
/**
 * Function to generate random number
 * https://www.geeksforgeeks.org/how-to-generate-random-number-in-given-range-using-javascript/
 */
function random(min, max) {
    return Math.random() * (max - min) + min;
}
/**
 * Get dot product for 2 vectors
 */
function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}
function scale(c, v) {
    return { x: c * v.x, y: c * v.y, z: c * v.z };
}
function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function subtract(a, b) {
    return add(a, scale(-1, b));
}
function distanceSquared(a, b) {
    const parts = subtract(b, a);
    return dot(parts, parts);
}

/**
 * Find the point where the ray intersects with a sphere centered at the origin.
 * https://github.com/libgdx/libgdx/blob/9eba80c6694160c743e43d4c3a5d60a5bad06f30/gdx/src/com/badlogic/gdx/math/Intersector.java#L353
 */
function raycastOnSphereToPoint(ray, sphereRadius) {
    const center = ZERO;
    const len = dot(ray.direction, subtract(center, ray.origin));
    // behind the ray
    if (len < 0)
        return undefined;
    const dst2 = distanceSquared(center, add(ray.origin, scale(len, ray.direction)));
    const r2 = sphereRadius * sphereRadius;
    if (dst2 > r2)
        return undefined;
    return rayToPoint(ray, len - Math.sqrt(r2 - dst2));
}
function rayToPoint(ray, distance) {
    return add(ray.origin, scale(distance, ray.direction));
}
function cartesianToSpherical(vector) {
    const polar = Math.atan(Math.sqrt(vector.x ** 2 + vector.z ** 2) / vector.y);
    if (polar === 0) {
        return { theta: 0, phi: 0 };
    }
    const azimuthal = Math.atan(vector.z / vector.x);
    return { theta: polar, phi: azimuthal };
}
function sphericalToCartesian(point, sphereRadius) {
    const x = sphereRadius * Math.sin(point.theta) * Math.cos(point.phi);
    const z = sphereRadius * Math.sin(point.theta) * Math.sin(point.phi);
    const y = sphereRadius * Math.cos(point.theta);
    return { x, y, z };
}

class GameLogic {
    constructor(stageRadius) {
        this.state = new GameState(stageRadius);
    }
    randomAudioPoint() {
        return {
            theta: random(Math.PI / 6, Math.PI / 2 - 0.15),
            phi: random(0, 2 * Math.PI),
        };
    }
    waitTime() {
        return 10000;
    }
    raycast(hand) {
        const { stageRadius } = this.state;
        // raycast hand onto sphere
        // fallback to some point in distance if player exits the game dome
        const pointCartesian = raycastOnSphereToPoint(hand, stageRadius) ||
            rayToPoint(hand, stageRadius);
        return pointCartesian;
    }
    handlePlayerClick(hand) {
        const { stageRadius } = this.state;
        // raycast hand onto sphere
        // fallback to some point in distance if player exits the game dome
        const pointCartesian = raycastOnSphereToPoint(hand, stageRadius);
        // go from raycast point to radian lat lng
        const pointSpherical = cartesianToSpherical(pointCartesian || rayToPoint(hand, stageRadius));
        // complete level
        const { audio } = this.state.completeLevel(pointSpherical);
        const height = stageRadius / 2;
        const h = stageRadius - height;
        const rSquared = (2 * h * stageRadius) - (h ** 2);
        return {
            type: 'display_result',
            pointerPosition: sphericalToCartesian(pointSpherical, stageRadius),
            arc: [
                sphericalToCartesian(pointSpherical, stageRadius),
                sphericalToCartesian(audio, stageRadius),
            ],
            raycastSuccess: Boolean(pointCartesian),
            arcCurve: {
                height,
                radius: Math.sqrt(rSquared),
                startAngle: pointSpherical.phi,
                endAngle: audio.phi,
            }
        };
    }
    newAudioPoint() {
        // send a new audio sound
        const level = this.state.startLevel(this.randomAudioPoint());
        return {
            type: 'play_audio',
            audioPosition: sphericalToCartesian(level.audio, this.state.stageRadius),
        };
    }
}

const game = new GameLogic(domeRadius);
self.onmessage = async (evt) => {
    self.postMessage(game.handlePlayerClick(evt.data.hand));
};
setInterval(() => {
    self.postMessage(game.newAudioPoint());
}, 9000);
//# sourceMappingURL=index.js.map
