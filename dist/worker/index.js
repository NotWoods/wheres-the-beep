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

/**
 * Taken from d3-geo.
 */
function haversin(x) {
    return (x = Math.sin(x / 2)) * x;
}
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

/**
 * Find the point where the ray intersects with a sphere centered at the origin.
 * https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-sphere-intersection
 */
function raycastOnSphere(ray, sphereRadius) {
    // sphere's origin is 0, 0, 0
    const radius2 = sphereRadius ** 2;
    const L = { x: -ray.origin.x, y: -ray.origin.y, z: -ray.origin.z };
    const tca = dot(L, ray.direction);
    if (tca < 0)
        return undefined;
    const d2 = dot(L, L) - tca ** 2;
    if (d2 > radius2)
        return undefined;
    const thc = Math.sqrt(radius2 - d2);
    let t0 = tca - thc;
    let t1 = tca + thc;
    if (t0 > t1) {
        const oldt1 = t1;
        t1 = t0;
        t0 = oldt1;
    }
    if (t0 < 0) {
        // if t0 is negative, let's use t1 instead
        t0 = t1;
        // if both t0 and t1 are negative
        if (t0 < 0)
            return undefined;
    }
    return t0;
}
function rayToPoint(ray, distance) {
    return add(ray.origin, scale(distance, ray.direction));
}
function raycastOnSphereToPoint(ray, sphereRadius) {
    const t = raycastOnSphere(ray, sphereRadius);
    if (t == undefined)
        return undefined;
    return rayToPoint(ray, t);
}
/**
 * Returns an interpolator function given two points.
 * The returned interpolator function takes a single argument t,
 * where t is a number ranging from 0 to 1;
 * a value of 0 returns the point `from`,
 * while a value of 1 returns the point `to`.
 * Intermediate values interpolate from between them along the great arc
 * that passes through both. If they are antipodes,
 * an arbitrary great arc is chosen.
 *
 * Taken from d3-geo and modified to use radians.
 */
function sphericalInterpolate(from, to) {
    const x0 = from.phi;
    const y0 = from.theta;
    const x1 = to.phi;
    const y1 = to.theta;
    const cy0 = Math.cos(y0), sy0 = Math.sin(y0), cy1 = Math.cos(y1), sy1 = Math.sin(y1), kx0 = cy0 * Math.cos(x0), ky0 = cy0 * Math.sin(x0), kx1 = cy1 * Math.cos(x1), ky1 = cy1 * Math.sin(x1), d = 2 *
        Math.asin(Math.sqrt(haversin(y1 - y0) + cy0 * cy1 * haversin(x1 - x0))), k = Math.sin(d);
    if (d === 0) {
        function interpolate() {
            return from;
        }
        interpolate.distance = 0;
        return interpolate;
    }
    else {
        function interpolate(t) {
            const B = Math.sin((t *= d)) / k, A = Math.sin(d - t) / k, x = A * kx0 + B * kx1, y = A * ky0 + B * ky1, z = A * sy0 + B * sy1;
            return {
                theta: Math.atan2(z, Math.sqrt(x * x + y * y)),
                phi: Math.atan2(y, x),
            };
        }
        interpolate.distance = d;
        return interpolate;
    }
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
        const pointCartesian = this.raycast(hand);
        // go from raycast point to radian lat lng
        const pointSpherical = cartesianToSpherical(pointCartesian);
        // complete level
        const { audio } = this.state.completeLevel(pointSpherical);
        // return an arc
        const interpolate = sphericalInterpolate(pointSpherical, audio);
        return {
            type: 'display_result',
            pointerPosition: pointCartesian,
            arc: [pointSpherical, interpolate(0.5), audio].map((point) => sphericalToCartesian(point, stageRadius)),
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
