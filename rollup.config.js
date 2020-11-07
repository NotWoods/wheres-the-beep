// @ts-check
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import consts from 'rollup-plugin-consts';

const constants = {
  workerUrl: 'dist/worker/index.js',
  radius: 4,
};

/** @type {import('rollup').RollupOptions} */
const main = {
  input: 'src/main/index.ts',
  output: {
    dir: 'dist/main',
    format: 'es',
    sourcemap: true,
    paths: {
      three: 'https://threejs.org/build/three.module.js',
    },
  },
  external: [
    'three',
    'https://threejs.org/build/three.module.js',
    'https://threejs.org/examples/jsm/webxr/VRButton.js',
    'https://threejs.org/examples/jsm/webxr/XRControllerModelFactory.js',
  ],
  plugins: [typescript({ module: 'esnext' }), nodeResolve(), consts(constants)],
};

/** @type {import('rollup').RollupOptions} */
const worker = {
  input: 'src/worker/index.ts',
  output: {
    file: 'dist/worker/index.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [typescript({ module: 'esnext' }), nodeResolve(), consts(constants)],
};

export default [main, worker];
