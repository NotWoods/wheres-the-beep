var domeRadius = 4;

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
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

const GOOD_SCORE_THRESHOLD = 2.5 ** 2;
class GameLogic {
    constructor(stageRadius) {
        this.score = 0;
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
            this.score = 0;
            return {
                type: 'display_result',
                pointerPosition: undefined,
                score: this.score,
                goodGuess: false,
            };
        }
        // go from raycast point to radian lat lng
        const pointSpherical = cartesianToSpherical(pointerPosition);
        // complete level
        const { audio } = this.state.completeLevel(pointSpherical);
        const end = sphericalToCartesian(audio, stageRadius);
        const distSq = distanceSquared(pointerPosition, end);
        const goodGuess = distSq <= GOOD_SCORE_THRESHOLD;
        if (goodGuess) {
            this.score++;
        }
        else {
            this.score = 0;
        }
        return {
            type: 'display_result',
            pointerPosition,
            line: {
                length: Math.sqrt(distSq),
                end,
            },
            score: this.score,
            goodGuess,
        };
    }
    newAudioPoint() {
        // send a new audio sound
        const level = this.state.startLevel(this.randomAudioPoint());
        return {
            type: 'play_audio',
            audioPosition: sphericalToCartesian(level.audio, this.state.stageRadius),
            maxTime: 15,
        };
    }
}

const game = new GameLogic(domeRadius);
self.onmessage = async (evt) => {
    switch (evt.data.type) {
        case 'start_game':
            await timeout(1000);
            self.postMessage(game.newAudioPoint());
            break;
        case 'player_click': {
            const { hand } = evt.data;
            self.postMessage(game.handlePlayerClick(hand));
            await timeout(4000);
            self.postMessage(game.newAudioPoint());
            break;
        }
        case 'out_of_time':
            self.postMessage(game.handlePlayerClick(undefined));
            await timeout(4000);
            self.postMessage(game.newAudioPoint());
            break;
    }
};
//# sourceMappingURL=index.js.map
