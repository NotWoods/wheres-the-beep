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
/**
 * Normalize a radian angle
 */
function positiveRadian(angle) {
    return ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;
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
                arcCurve: undefined,
                goodGuess: false
            };
        }
        // go from raycast point to radian lat lng
        const pointSpherical = cartesianToSpherical(pointerPosition);
        // complete level
        const { audio } = this.state.completeLevel(pointSpherical);
        const height = stageRadius / 4;
        const h = stageRadius - height;
        const rSquared = (2 * h * stageRadius) - (h ** 2);
        const startAngle = positiveRadian(pointSpherical.phi);
        const endAngle = positiveRadian(audio.phi);
        const GOOD_GUESS_THRESHOLD = 1;
        return {
            type: 'display_result',
            pointerPosition,
            arcCurve: {
                height,
                radius: Math.sqrt(rSquared),
                startAngle,
                endAngle,
            },
            goodGuess: positiveRadian(endAngle - startAngle) < GOOD_GUESS_THRESHOLD
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
    await timeout(2000);
    self.postMessage(game.newAudioPoint());
};
self.postMessage(game.newAudioPoint());
//# sourceMappingURL=index.js.map