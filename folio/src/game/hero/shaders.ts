import type { Bend } from './poseRig';
import type { PoseLayer } from './poseData';

// Shader des rubans, repris de `lab/` (lab/src/game/hero/shaders.ts) et adapté à l'objet Shader de Phaser.
// Les coordonnées sont en pixels de la toile du rig (1024 × 1536). Le fragment shader retrouve le pixel d'origine
// et y ajoute l'ondulation : un déplacement perpendiculaire à l'axe du ruban, nul à la racine, maximal à la pointe.
export const RIBBON_FRAGMENT = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 outTexCoord; uniform sampler2D iChannel0;
uniform vec4 uQuad;                             // rectangle dessiné, en pixels de la toile
uniform vec4 uBox;                              // rectangle du calque dans la toile
uniform vec2 uAtlas,uAtlasSize;
uniform vec4 uBend;                             // amplitude, longueur, angle de phase
uniform vec4 uAxis;                             // xy = axe racine -> pointe, zw = racine
uniform float uAlpha;
void main(){
  vec2 c=uQuad.xy+vec2(outTexCoord.x,1.-outTexCoord.y)*uQuad.zw;
  float s=clamp(dot(c-uAxis.zw,uAxis.xy)/uBend.y,0.,1.3);
  c+=uBend.x*s*s*sin(uBend.z-2.2*s)*vec2(uAxis.y,-uAxis.x);
  vec2 q=c-uBox.xy;
  float inside=step(0.,q.x)*step(0.,q.y)*step(q.x,uBox.z)*step(q.y,uBox.w);
  gl_FragColor=texture2D(iChannel0,(uAtlas+q)/uAtlasSize)*inside*uAlpha;
}`;

/** Marge autour du quad d'un ruban ondulé, pour que rien ne soit coupé. */
export const RIBBON_MARGIN = 40;

/** Uniformes d'un ruban, au format attendu par `Phaser.Display.BaseShader`. */
export function ribbonUniforms(layer: PoseLayer, bend: Bend, atlasSize: [number, number], alpha: number) {
  const [x, y, width, height] = layer.box;
  return {
    uQuad: {
      type: '4f',
      value: { x: x - RIBBON_MARGIN, y: y - RIBBON_MARGIN, z: width + 2 * RIBBON_MARGIN, w: height + 2 * RIBBON_MARGIN },
    },
    uBox: { type: '4f', value: { x, y, z: width, w: height } },
    uAtlas: { type: '2f', value: { x: layer.atlas[0], y: layer.atlas[1] } },
    uAtlasSize: { type: '2f', value: { x: atlasSize[0], y: atlasSize[1] } },
    uBend: { type: '4f', value: { x: bend.amplitude, y: bend.length, z: 0, w: 0 } },
    uAxis: { type: '4f', value: { x: bend.axis[0], y: bend.axis[1], z: layer.pivot[0], w: layer.pivot[1] } },
    uAlpha: { type: '1f', value: alpha },
  };
}

/**
 * Réglages de texture imposés par le shader. L'atlas est partagé avec les images des autres calques :
 * il faut donc garder ici le même filtrage avec mipmaps que celui de la configuration du jeu.
 */
export const RIBBON_TEXTURE_DATA = {
  wrapS: 'clamp_to_edge',
  wrapT: 'clamp_to_edge',
  minFilter: 'linear_mipmap_linear',
};
