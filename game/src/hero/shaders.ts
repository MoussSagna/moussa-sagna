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
uniform vec4 uTrail;                            // couleur de la traînée (rgb) et part de cette couleur
uniform vec4 uTint;                             // teinte du dessin (rgb) et part de cette teinte (images fantômes et halo du drive rush)
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
    // la traînée tire vers la couleur demandée (le rouge du personnage, le vert du drive rush) et ne recouvre pas le dessin net
    trail.rgb=mix(trail.rgb,uTrail.rgb*trail.a,uTrail.a);
    col+=trail*(1.-col.a);
  }
  col.rgb=mix(col.rgb,uTint.rgb*col.a,uTint.a);
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

// Boule de feu : entièrement calculée, sans image. Un cœur presque blanc, un corps orangé puis rouge,
// des flammes qui ondulent, et une queue derrière elle quand elle vole (uTail).
export const FIRE_FRAGMENT = `precision mediump float;
varying vec2 v; uniform float uT,uPower,uTail,uWobble;
void main(){
  vec2 p=(v-.5)*2.;
  // en vol, le quad est plus large que haut : le cœur est décalé vers l'avant et la queue s'étire derrière
  vec2 c=vec2(p.x*mix(1.,1.5,uTail)-.5*uTail,p.y);
  float back=step(c.x,0.);
  float d=length(vec2(c.x*mix(1.,mix(1.,.45,uTail),back),c.y));
  float flame=sin(c.y*9.+uT*14.+c.x*6.)*sin(c.x*7.-uT*18.)*.14+sin(atan(c.y,c.x)*5.+uT*9.)*.06;
  d+=flame*uWobble*mix(.35,1.,back*uTail);
  float i=smoothstep(1.,0.,d);
  vec3 col=vec3(.91,.15,.18)*i*1.25+vec3(1.,.55,.2)*pow(i,2.5)+vec3(1.)*pow(i,6.);
  // couleur plus forte que l'opacité : la boule éclaire ce qu'elle recouvre au lieu de le masquer
  gl_FragColor=vec4(col,min(1.,i*.75))*uPower;
}`

// Étincelle d'impact : entièrement calculée. Une étoile à huit branches inégales qui jaillit puis s'éteint,
// et une onde de choc qui s'élargit. uK : avancement de 0 à 1 ; uSeed : fait tourner l'étoile d'un impact à l'autre.
export const SPARK_FRAGMENT = `precision mediump float;
varying vec2 v; uniform float uK,uSeed,uPower;
uniform vec3 uTint,uGlow;                       // couleur du bord et couleur intermédiaire, avant le blanc du cœur
void main(){
  vec2 p=(v-.5)*2.;
  float r=length(p),a=atan(p.y,p.x)+uSeed;
  // quatre grandes branches et quatre petites, plus fines vers la pointe
  float rays=max(pow(abs(cos(a*2.)),28.),.55*pow(abs(cos(a*2.+.785)),40.));
  float grow=1.-(1.-uK)*(1.-uK);
  float reach=mix(.16,.95,rays)*(.35+.65*grow);
  float fade=(1.-uK)*(1.-uK);
  float i=smoothstep(reach,0.,r)*fade;
  float core=smoothstep(.3*(1.-uK)+.02,0.,r)*fade;
  float ring=smoothstep(.07,0.,abs(r-(.25+.7*grow)))*(1.-uK)*.5;
  vec3 col=uTint*(i*1.3+ring)+uGlow*pow(i,1.8)+vec3(1.)*(pow(i,3.)+core);
  gl_FragColor=vec4(col,min(1.,i*.8+core+ring*.5))*uPower;
}`

// Un morceau d'une planche d'images (les effets de la frappe au sol) : uUv donne son rectangle dans la texture.
export const SPRITE_FRAGMENT = `precision mediump float;
varying vec2 v; uniform sampler2D uTex; uniform vec4 uUv; uniform float uAlpha;
void main(){ gl_FragColor=texture2D(uTex,uUv.xy+v*uUv.zw)*uAlpha; }`
