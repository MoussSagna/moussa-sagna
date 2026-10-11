// Shader du décor, repris de `lab/` (lab/src/game/stage/shaders.ts) et adapté à l'objet Shader de Phaser :
// l'image arrive sur iChannel0, la carte sur iChannel1 (r = profondeur, g = ciel, b = écrans), et les coordonnées
// viennent de `outTexCoord`, fourni par le vertex shader par défaut de Phaser. Le reste est inchangé.
export const STAGE_FRAGMENT = `precision mediump float;
varying vec2 outTexCoord; uniform sampler2D iChannel0,iChannel1; uniform float uT,uZoom,uTrain,uCalm,uBolt; uniform vec2 uOff;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p*=2.02;a*=.5;}return s;}
float g(vec2 p,vec2 c,float r){vec2 q=(p-c)*vec2(1.777,1.);return exp(-dot(q,q)/(r*r));}
float fl(float seed,float sp){return .72+.28*n(vec2(uT*sp,seed));}
void main(){
  vec2 v=vec2(outTexCoord.x,1.-outTexCoord.y);   // origine en haut à gauche, comme l'image
  vec2 uv=(v-.5)/uZoom+.5;
  float d=texture2D(iChannel1,uv).r;
  vec2 p=uv+(d-.42)*uOff;                       // parallaxe : le proche bouge plus que le lointain
  float floorM=smoothstep(.725,.765,uv.y);
  float amp=(.35+(uv.y-.72)*3.2)*(1.-.7*uCalm);
  p.x+=floorM*sin(uv.y*150.-uT*2.6+sin(uv.x*22.)*2.)*.0017*amp;   // eau qui frémit sur les dalles
  p.y+=floorM*sin(uv.x*64.+uT*1.9)*.0009*amp;
  vec3 c=texture2D(iChannel0,p).rgb;
  vec3 M=texture2D(iChannel1,p).rgb;                // g = ciel, b = écrans (la valeur sert d'identifiant)
  // écrans géants : lignes de balayage, barre lumineuse, changement de teinte, parasites et coupures
  float sc=M.b, on=smoothstep(.2,.28,sc), ph=floor(sc*20.+.5)*1.7;
  float gt=floor(uT*11.);
  float glitch=step(.88,h(vec2(gt,ph)))*(1.-uCalm);
  float shift=(h(vec2(floor(p.y*110.),gt))-.5)*.014*glitch;
  vec3 s1=vec3(texture2D(iChannel0,p+vec2(shift+.0015*glitch,0.)).r,texture2D(iChannel0,p+vec2(shift,0.)).g,texture2D(iChannel0,p+vec2(shift-.0015*glitch,0.)).b);
  float scan=.8+.2*sin(p.y*1100.-uT*9.+ph);
  float sweep=smoothstep(.05,0.,abs(fract(p.y*2.2-uT*.25+ph*.37)-.5));
  float pulse=.9+.22*sin(uT*2.1+ph*3.);
  float off=step(.975,h(vec2(floor(uT*5.),ph+9.)))*(1.-uCalm);
  float hue=(.5+.5*sin(uT*.45+ph))*mix(.55,.16,step(.9,sc));
  s1=mix(s1,s1.brg,hue);
  vec3 scol=s1*scan*pulse*(1.+sweep*.7)*(1.-.5*off)+vec3(.5,.45,.9)*sweep*.12;
  c=mix(c,scol,on);
  // ciel : deux couches de nuages qui défilent, rougies près de la lune
  float sky=M.g, moonG=g(p,vec2(.55,.2),.24);
  vec2 cp=vec2(p.x*2.4+uT*.04,p.y*5.2-uT*.006);
  float c1=fbm(cp), c2=fbm(cp*2.4+vec2(uT*.07,3.7));
  float cloud=clamp(smoothstep(.42,.72,c1)*.8+smoothstep(.5,.8,c2)*.45,0.,1.);
  vec3 ccol=mix(vec3(.07,.05,.13),vec3(.62,.13,.15),moonG*.85)+vec3(.12,.1,.2)*c2*.4;
  c=mix(c,ccol,sky*cloud*.82);
  // lune : halo qui respire
  c+=vec3(.95,.16,.1)*moonG*(.09+.06*sin(uT*.7))*sky;
  // éclairs dans les nuages
  c+=sky*vec3(.72,.68,1.)*uBolt*(.25+cloud*.9)+vec3(.5,.45,.75)*uBolt*.07;
  // brume violette entre la ville et la cour
  float band=smoothstep(.47,.64,uv.y)*(1.-smoothstep(.66,.73,uv.y))*(1.-smoothstep(.36,.56,d));
  float mn=fbm(vec2(p.x*4.2+uT*.05,p.y*9.-uT*.018));
  c=mix(c,vec3(.6,.5,.88),band*mn*.55);
  // lanternes et braseros qui vacillent
  vec3 warm=vec3(1.,.5,.18); float f1=fl(1.,2.6),f2=fl(7.,3.1),f3=fl(13.,4.2);
  c+=warm*(g(p,vec2(.212,.319),.062)*f1*.34+g(p,vec2(.939,.25),.058)*f2*.34+g(p,vec2(.429,.629),.03)*f3*.4+g(p,vec2(.631,.638),.02)*f1*.3
         +g(p,vec2(.76,.574),.05)*f3*.3+g(p,vec2(.873,.531),.04)*f2*.3+g(p,vec2(.804,.409),.024)*f3*.4);
  // enseignes au néon : pulsation lente et coupures brèves
  float cut=step(.93,h(vec2(floor(uT*9.),3.)));
  float neon=(.7+.3*sin(uT*1.6))*(1.-.6*cut);
  c+=vec3(.55,.42,1.)*(g(p,vec2(.344,.191),.05)+g(p,vec2(.444,.287),.035)+g(p,vec2(.478,.367),.03))*neon*.3;
  c+=vec3(.5,.36,.95)*g(p,vec2(.625,.393),.075)*(.6+.4*sin(uT*.9+1.))*.18;
  // métro qui passe sur le viaduc : fenêtres éclairées qui défilent derrière la motrice
  vec2 A=vec2(.269,.319),B=vec2(.688,.494),ab=B-A; float s=clamp(dot(p-A,ab)/dot(ab,ab),0.,1.);
  float dist=length((p-(A+ab*s))*vec2(1.777,1.));
  float lit=step(s,uTrain)*step(uTrain-.75,s);
  c+=vec3(1.,.78,.45)*smoothstep(.013,.004,dist)*step(.45,fract(s*40.-uT*1.5))*lit*.7;
  c+=vec3(1.,.9,.7)*g(p,A+ab*clamp(uTrain,0.,1.),.03)*step(0.,uTrain)*step(uTrain,1.)*.6;
  // sol : reflets qui suivent les lanternes
  c*=1.+floorM*((f1+f2+f3)/3.-.86)*.9;
  // vignette
  vec2 q=v-.5; c*=1.-dot(q,q)*.55;
  gl_FragColor=vec4(c,1.);
}`;

/** Uniformes pilotés par la scène à chaque image, au format attendu par `Phaser.Display.BaseShader`. */
export const STAGE_UNIFORMS = {
  uT: { type: '1f', value: 0 },
  uZoom: { type: '1f', value: 1 },
  uTrain: { type: '1f', value: -1 },
  uCalm: { type: '1f', value: 0 },
  uBolt: { type: '1f', value: 0 },
  uOff: { type: '2f', value: { x: 0, y: 0 } },
};

/**
 * Sans ces réglages, Phaser repasse les textures en mode REPEAT, ce que WebGL 1 refuse pour une image
 * dont les côtés ne sont pas des puissances de deux : le décor serait noir.
 */
export const STAGE_TEXTURE_DATA = { wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge' };
