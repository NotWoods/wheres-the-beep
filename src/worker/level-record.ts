export interface SphericalPoint {
  /**
   * Y-coordinate replaced by Polar Angle (θ).
   * Corresponds to latitude.
   */
  readonly theta: number;
  /**
   * Z-coordinate replaced by Azimuthal Angle (φ)
   * Corresponds to longitude.
   */
  readonly phi: number;
}

export interface Vector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Ray {
  readonly origin: Vector;
  readonly direction: Vector;
}

export interface CurrentLevel {
  readonly audio: SphericalPoint;
  readonly startTime: number;
}

export interface CompletedLevel extends CurrentLevel {
  pointer: SphericalPoint;
  endTime: number;
}

export function timeout(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class GameState {
  completedLevels: Readonly<CompletedLevel>[] = [];
  currentLevel?: CurrentLevel;

  constructor(public readonly stageRadius: number) {}

  startLevel(audioPosition: SphericalPoint, now = Date.now()) {
    if (this.currentLevel) {
      throw new Error('Level already started');
    }
    const level = {
      audio: audioPosition,
      startTime: now,
    };
    this.currentLevel = level;
    return level;
  }

  completeLevel(pointerPosition: SphericalPoint, now = Date.now()) {
    if (!this.currentLevel) {
      throw new Error('Cannot complete level before it starts');
    }
    const level = this.currentLevel as CompletedLevel;
    level.pointer = pointerPosition;
    level.endTime = now;
    this.completedLevels.push(level);
    this.currentLevel = undefined;
    return level;
  }
}
