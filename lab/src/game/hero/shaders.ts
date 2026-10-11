// Shaders du personnage. Les coordonnées sont en pixels de la toile du rig (1024 × 1536).
// Chaque calque est un quad : le vertex shader applique la transformation du calque, le fragment
// shader retrouve le pixel d'origine et y ajoute l'ondulation des rubans, nulle à la racine
// et maximale à la pointe.
export const LAYER_VERTEX = `attribute vec2 a;
uniform vec4 uQuad;                             // rectangle dessiné, en pixels de la toile
uniform vec3 uMx,uMy;                           // transformation du calque
uniform vec4 uView;                             // toile -> écran : p*xy+zw
varying vec2 vC;
void main(){vC=uQuad.xy+a*uQuad.zw;vec3 h=vec3(vC,1.);gl_Position=vec4(vec2(dot(uMx,h),dot(uMy,h))*uView.xy+uView.zw,0.,1.);}`

export const LAYER_FRAGMENT = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vC; uniform sampler2D uTex;
uniform vec4 uBox;                              // rectangle du calque dans la toile
uniform vec2 uAtlas,uAtlasSize;
uniform vec4 uBend;                             // amplitude, longueur, angle de phase
uniform vec4 uAxis;                             // xy = axe racine -> pointe, zw = racine
uniform float uAlpha;                           // opacité du calque (images fantômes du dash)
uniform float uSmear;                           // traînée de vitesse : longueur en pixels de la toile, signée
vec4 pick(vec2 c){
  vec2 q=c-uBox.xy;
  float inside=step(0.,q.x)*step(0.,q.y)*step(q.x,uBox.z)*step(q.y,uBox.w);
  return texture2D(uTex,(uAtlas+q)/uAtlasSize)*inside;
}
void main(){
  vec2 c=vC;
  // rubans : déplacement perpendiculaire à l'axe, nul à la racine, maximal à la pointe
  float s=clamp(dot(c-uAxis.zw,uAxis.xy)/uBend.y,0.,1.3);
  c+=uBend.x*s*s*sin(uBend.z-2.2*s)*vec2(uAxis.y,-uAxis.x);
  vec4 col=pick(c);
  if(abs(uSmear)>.5){
    // traînée : le dessin est étiré derrière lui en bandes horizontales irrégulières, qui s'estompent
    float band=.55+.45*sin(c.y*.21)*sin(c.y*.057+1.7);
    vec4 trail=vec4(0.);
    for(int i=1;i<=10;i++){
      float t=float(i)/10.;
      trail+=pick(c+vec2(uSmear*t*band,0.))*(1.-t)*(1.-t);
    }
    trail*=.42;
    // la traînée tire vers le rouge du personnage et ne recouvre pas le dessin net
    trail.rgb=mix(trail.rgb,vec3(.91,.15,.18)*trail.a,.35);
    col+=trail*(1.-col.a);
  }
  gl_FragColor=col*uAlpha;
}`

// Reflet (le personnage rendu hors écran, retourné) et ombre au sol.
export const FLAT_VERTEX = `attribute vec2 a;uniform vec4 uRect;varying vec2 v;void main(){v=a;gl_Position=vec4(uRect.xy+(a*2.-1.)*uRect.zw,0.,1.);}`

export const FLAT_FRAGMENT = `precision mediump float;
varying vec2 v; uniform sampler2D uTex; uniform float uAlpha,uShadow;
void main(){
  if(uShadow>.5){float r=length((v-.5)*2.);gl_FragColor=vec4(0.,0.,0.,1.)*smoothstep(1.,.15,r)*.6;return;}
  gl_FragColor=texture2D(uTex,v)*uAlpha;
}`
