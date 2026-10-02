import * as THREE from 'three';

// Final lens pass (runs after tone mapping): subtle chromatic fringing,
// vignette and film grain.
export const FinishShader = {
  name: 'FinishShader',
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.3 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignette;
    uniform vec2 resolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * 0.006;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      float v = smoothstep(0.85, 0.15, r2 * (1.0 + vignette));
      col *= mix(1.0 - vignette, 1.0, v);
      float g = hash(vUv * resolution + fract(time * 7.13) * 100.0) - 0.5;
      col += g * 0.022;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
