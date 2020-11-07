import * as THREE from 'three';

const audioLoader = new THREE.AudioLoader();

export class Sound {
  audio: THREE.PositionalAudio;
  mesh: THREE.LineSegments;

  constructor(listener: THREE.AudioListener) {
    this.audio = new THREE.PositionalAudio(listener);

    const sphere = new THREE.SphereBufferGeometry(0.25, 8, 6);
    const wireframe = new THREE.WireframeGeometry(sphere);
    this.mesh = new THREE.LineSegments(
      wireframe,
      new THREE.LineBasicMaterial({ color: 0xaa3939 })
    );
    this.mesh.add(this.audio);
    this.mesh.visible = false;
  }

  async load(url: string) {
    const buffer: AudioBuffer = await audioLoader.loadAsync(url);
    this.audio.setBuffer(buffer);
  }

  play(x: number, y: number, z: number) {
    /*if (this.audio.isPlaying) {
      this.audio.stop()
    }*/
    this.mesh.position.set(x, y, z);
    this.audio.play();
  }
}
