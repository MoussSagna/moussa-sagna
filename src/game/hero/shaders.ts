// Shaders du personnage : une seule illustration déformée en direct.
// Carte uMap : r = tissus libres (bandeau, lanières), g = haut du corps (respiration), b = tête.
// Carte uLegs : r = jambe arrière, g = jambe avant ; 0 à la hanche, 1 à la cheville et sur le pied.
export const HERO_VERTEX = `attribute vec2 a;uniform vec4 uRect;uniform float uFlip;varying vec2 v;void main(){v=a*.5+.5;v.y=1.-v.y;vec2 p=a;if(uFlip>.5)p.y=-p.y;gl_Position=vec4(uRect.xy+p*uRect.zw,0.,1.);}`

export const HERO_FRAGMENT = `precision mediump float;
varying vec2 v; uniform sampler2D uTex,uMap,uLegs; uniform float uT,uAlpha,uMode,uCalm,uChest,uCx,uBob,uLean,uWalk;
uniform vec3 uBack,uFront;                      // par jambe : x = avancée du pied, y = levée, z = flexion du genou
void main(){
  if(uMode>1.5){float r=length((v-.5)*2.);gl_FragColor=vec4(0.,0.,0.,1.)*smoothstep(1.,.15,r)*.6;return;}
  vec3 m=texture2D(uMap,v).rgb;                 // r = tissus libres, g = haut du corps, b = tête
  float k=1.-.65*uCalm, br=sin(uT*1.9);
  vec2 d=vec2(0.);
  d.y-=m.g*.0052*br*k;                                                        // la cage thoracique monte et descend
  d.x+=(v.x-uCx)*m.g*.014*br*k*exp(-pow((v.y-uChest)/.11,2.));                // le torse se gonfle
  d.x+=pow(max(0.,1.-v.y),1.5)*.0065*sin(uT*.95)*k;                           // léger balancement, pieds ancrés
  d.y-=m.b*.003*sin(uT*1.9-.8)*k; d.x+=m.b*.0015*sin(uT*.95-.5)*k;            // la tête suit avec un temps de retard
  float w=m.r;                                                                // bandeau et pans de tissu : ondes qui partent du corps
  d+=w*vec2(.024*sin(uT*2.6+v.x*9.+v.y*5.),.018*sin(uT*3.2+v.x*12.+1.3))*k;
  d+=w*w*vec2(.009*sin(uT*5.3+v.y*22.),.006*sin(uT*4.4+v.x*26.))*k;
  // marche : chaque jambe se plie de la hanche (poids 0) au pied (poids 1, rigide)
  vec2 lg=texture2D(uLegs,v).rg; float wb=lg.r, wf=lg.g, wl=max(wb,wf);
  d+=wb*vec2(uBack.x,-uBack.y)+4.*wb*(1.-wb)*vec2(uBack.z,-uBack.y*.35);
  d+=wf*vec2(uFront.x,-uFront.y)+4.*wf*(1.-wf)*vec2(uFront.z,-uFront.y*.35);
  d.y+=uBob*(1.-wl);                                                          // le corps monte et descend, pas les pieds
  d.x+=uLean*pow(max(0.,1.-v.y),1.2)*(1.-wl);                                 // buste penché dans le sens de la marche
  d.x-=w*.03*uWalk;                                                           // le bandeau traîne derrière
  gl_FragColor=texture2D(uTex,v-d)*uAlpha;
}`
