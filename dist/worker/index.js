var domeRadius = 4;

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

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const GOOD_SCORE_THRESHOLD = 1.5 ** 2;
class GameState {
    constructor(stageRadius) {
        this.stageRadius = stageRadius;
        this.completedLevels = [];
        this.lastLostLevelIndex = -1;
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
        level.score = pointerPosition
            ? this.score(level.audio, pointerPosition)
            : -1;
        level.goodScore = this.goodScore(level.score);
        level.endTime = now;
        this.completedLevels.push(level);
        this.currentLevel = undefined;
        if (!level.goodScore) {
            this.lastLostLevelIndex = this.completedLevels.length - 1;
        }
        return level;
    }
    totalScore() {
        if (this.lastLostLevelIndex === -1)
            return this.completedLevels.length;
        return this.completedLevels.length - this.lastLostLevelIndex - 1;
    }
    goodScore(score) {
        return score >= 0 && score < GOOD_SCORE_THRESHOLD;
    }
    score(audioPos, pointerPos) {
        const audio = sphericalToCartesian(audioPos, this.stageRadius);
        const pointer = sphericalToCartesian(pointerPos, this.stageRadius);
        return distanceSquared(audio, pointer);
    }
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
    handlePlayerClick(pointerPosition) {
        const { stageRadius } = this.state;
        if (!pointerPosition) {
            this.state.completeLevel(undefined);
            return {
                type: 'display_result',
                pointerPosition: undefined,
                score: this.state.totalScore(),
                goodGuess: false,
            };
        }
        // go from raycast point to radian lat lng
        const pointSpherical = cartesianToSpherical(pointerPosition);
        // complete level
        const { audio, score } = this.state.completeLevel(pointSpherical);
        const end = sphericalToCartesian(audio, stageRadius);
        return {
            type: 'display_result',
            pointerPosition,
            line: {
                length: Math.sqrt(score),
                end,
            },
            score: this.state.totalScore(),
            goodGuess: this.state.goodScore(score),
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
let started = false;
self.onmessage = async (evt) => {
    const { hand } = evt.data;
    if (started || hand) {
        self.postMessage(game.handlePlayerClick(evt.data.hand));
        await timeout(4000);
    }
    else {
        started = true;
        await timeout(1000);
    }
    self.postMessage(game.newAudioPoint());
};
// self.postMessage(game.newAudioPoint());
//# sourceMappingURL=index.js.map
