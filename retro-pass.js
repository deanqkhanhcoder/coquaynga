import { Vector2 } from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Runs after OutputPass: quantization operates on display-referred sRGB colors.
// The scene is actually rendered into smaller nearest-filtered buffers; HTML stays sharp.
export function createRetroPass() {
  return new ShaderPass({
    name: 'IndustrialPSX',
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new Vector2(960, 540) },
      time: { value: 0 },
      grain: { value: .026 },
      vignette: { value: .68 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float time, grain, vignette;
      varying vec2 vUv;

      float bayer4(vec2 p) {
        vec2 q = mod(floor(p), 4.0);
        if (q.y < 1.0) {
          if(q.x<1.0)return 0.0; if(q.x<2.0)return 8.0; if(q.x<3.0)return 2.0; return 10.0;
        }
        if (q.y < 2.0) {
          if(q.x<1.0)return 12.0; if(q.x<2.0)return 4.0; if(q.x<3.0)return 14.0; return 6.0;
        }
        if (q.y < 3.0) {
          if(q.x<1.0)return 3.0; if(q.x<2.0)return 11.0; if(q.x<3.0)return 1.0; return 9.0;
        }
        if(q.x<1.0)return 15.0; if(q.x<2.0)return 7.0; if(q.x<3.0)return 13.0; return 5.0;
      }
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
      }
      void main() {
        vec2 pixel = floor(vUv * resolution);
        vec2 uv = (pixel + .5) / resolution;
        vec3 c = texture2D(tDiffuse, uv).rgb;
        float luma = dot(c, vec3(.299,.587,.114));
        // Dirty olive in the lit mids; rusty crimson in shadow, without tinting CRTs white.
        c = mix(vec3(luma), c, .76);
        c *= vec3(1.02,.99,.94);
        c += vec3(.023,-.007,-.002) * (1.0-smoothstep(.03,.34,luma));
        c = max(vec3(0.0), (c-.035)*1.13);
        vec2 v = (vUv-.5)*vec2(1.08,.92);
        c *= 1.0 - vignette * smoothstep(.22,.68,length(v));
        float textureStrength = smoothstep(.015,.16,luma);
        c += (noise(pixel + floor(time*12.0))-.5)*grain*textureStrength;
        float d = (bayer4(pixel)+.5)/16.0-.5;
        vec3 levels = vec3(23.0,23.0,20.0);
        c = floor(clamp(c,0.0,1.0)*levels + .5 + d*.85*textureStrength)/levels;
        c *= .986 + .014 * mod(pixel.y,2.0);
        gl_FragColor = vec4(c,1.0);
      }
    `
  });
}
