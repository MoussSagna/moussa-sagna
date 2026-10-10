// Shaders du personnage. Les coordonnées sont en pixels de la toile du rig (1024 × 1536).
// Chaque calque est un quad : le vertex shader applique la transformation du calque, le fragment
// shader retrouve le pixel d'origine et y ajoute les déformations (rubans, jambes), comme warp()
// dans tools/rig/simulate.py.
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
varying vec2 vC; uniform sampler2D uTex,uLegs;
uniform vec4 uBox;                              // rectangle du calque dans la toile
uniform vec2 uAtlas,uAtlasSize,uCanvas;
uniform vec4 uBend;                             // amplitude, longueur, angle de phase, traîne de marche
uniform vec4 uAxis;                             // xy = axe racine -> pointe, zw = racine
uniform float uLegsOn;
uniform vec3 uBack,uFront;                      // par jambe : x = avancée du pied, y = levée, z = flexion du genou
uniform vec3 uBody;                             // x = balancement vertical, y = inclinaison en haut, z = hauteur des pieds
void main(){
  vec2 c=vC;
  // rubans : déplacement perpendiculaire à l'axe, nul à la racine, maximal à la pointe
  float s=clamp(dot(c-uAxis.zw,uAxis.xy)/uBend.y,0.,1.3);
  c+=uBend.x*s*s*sin(uBend.z-2.2*s)*vec2(uAxis.y,-uAxis.x);
  c.x+=uBend.w*s*s;                             // en marche, la pointe traîne derrière
  // marche : chaque jambe se plie de la hanche (poids 0) au pied (poids 1, rigide)
  vec2 lg=texture2D(uLegs,c/uCanvas).rg*uLegsOn; float wb=lg.r, wf=lg.g, wl=max(wb,wf);
  vec2 d=wb*vec2(uBack.x,-uBack.y)+4.*wb*(1.-wb)*vec2(uBack.z,-uBack.y*.35);
  d+=wf*vec2(uFront.x,-uFront.y)+4.*wf*(1.-wf)*vec2(uFront.z,-uFront.y*.35);
  d+=(1.-wl)*vec2(uBody.y*(uBody.z-c.y)/uBody.z,uBody.x)*uLegsOn;   // le bassin suit le corps, pas les pieds
  vec2 q=c-d-uBox.xy;
  float inside=step(0.,q.x)*step(0.,q.y)*step(q.x,uBox.z)*step(q.y,uBox.w);
  gl_FragColor=texture2D(uTex,(uAtlas+q)/uAtlasSize)*inside;
}`

// Reflet (le personnage rendu hors écran, retourné) et ombre au sol.
export const FLAT_VERTEX = `attribute vec2 a;uniform vec4 uRect;varying vec2 v;void main(){v=a;gl_Position=vec4(uRect.xy+(a*2.-1.)*uRect.zw,0.,1.);}`

export const FLAT_FRAGMENT = `precision mediump float;
varying vec2 v; uniform sampler2D uTex; uniform float uAlpha,uShadow;
void main(){
  if(uShadow>.5){float r=length((v-.5)*2.);gl_FragColor=vec4(0.,0.,0.,1.)*smoothstep(1.,.15,r)*.6;return;}
  gl_FragColor=texture2D(uTex,v)*uAlpha;
}`
