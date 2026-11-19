// CRT post-process: WebGL2 over the terminal framebuffer, with a plain 2D fallback.
// Legibility first: sharp-bilinear sampling keeps text crisp at any scale.

export interface PowerState {
  /** Seconds since power-on, or -1 when off. */
  onT: number;
  /** Seconds since power-off, or -1 when on. */
  offT: number;
}

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; uv.y = 1.0-uv.y; gl_Position = vec4(p,0.,1.); }`;

const FS_SCENE = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D src; uniform sampler2D prev;
uniform vec2 srcSize; uniform vec2 outSize;
uniform float onT, offT, time, motion, persist;

vec2 curve(vec2 u){ u = u*2.-1.; vec2 off = abs(u.yx)/vec2(9.,7.); u = u + u*off*off; return u*0.5+0.5; }

vec3 sharp(vec2 u){
  vec2 t = u*srcSize - 0.5;
  float scale = max(1., floor(min(outSize.x/srcSize.x, outSize.y/srcSize.y)));
  vec2 ti = floor(t); vec2 f = fract(t);
  f = clamp((f-0.5)*scale+0.5, 0., 1.);
  return textureLod(src, (ti+f+0.5)/srcSize, 0.).rgb;
}

void main(){
  vec2 u = curve(uv);
  // power animation: vertical/horizontal scale of the raster
  float sy = 1., sx = 1., gain = 1.;
  if (onT >= 0.) {
    sy = smoothstep(0.0, 0.32, onT); sy = max(sy, 0.004);
    gain = mix(3.5, 1.0, smoothstep(0.0, 0.35, onT)) * mix(0.25, 1.0, smoothstep(0.25, 1.6, onT));
  }
  vec3 col = vec3(0.);
  if (offT >= 0.) {
    sy = max(1. - smoothstep(0.0, 0.14, offT), 0.004);
    sx = max(1. - smoothstep(0.12, 0.3, offT), 0.002);
    gain = 1. + (1.-sy)*3.;
  }
  vec2 c = (u-0.5)/vec2(sx,sy)+0.5;
  if (c.x>=0. && c.x<=1. && c.y>=0. && c.y<=1. && (onT>=0. || offT < 0.3)) {
    col = sharp(c);
    vec3 glow = textureLod(src, c, 2.5).rgb*0.5 + textureLod(src, c, 4.).rgb*0.5;
    col += glow*0.22;
    col *= gain;
  }
  if (offT >= 0.12) {
    float d = length((u-0.5)*vec2(1.33,1.));
    float fade = 1. - smoothstep(0.3, 2.4, offT);
    col += vec3(0.85,0.9,1.0) * exp(-d*d*1800.) * fade * 1.4;
  }
  vec3 p = texture(prev, gl_FragCoord.xy / outSize).rgb;
  col = max(col, p*persist);
  o = vec4(col, 1.);
}`;

const FS_OUT = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D scene; uniform vec2 srcSize; uniform vec2 outSize; uniform float time, motion, bright, contrast;
vec2 curve(vec2 u){ u = u*2.-1.; vec2 off = abs(u.yx)/vec2(9.,7.); u = u + u*off*off; return u*0.5+0.5; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec3 col = texture(scene, gl_FragCoord.xy / outSize).rgb;
  vec2 u = curve(uv);
  // scanlines, only when there is room for them
  float lines = outSize.y / srcSize.y;
  float sl = lines >= 2.0 ? 0.055 : 0.0;
  col *= 1. - sl*(0.5+0.5*cos(u.y*srcSize.y*6.28318));
  // vignette
  vec2 v = u*(1.-u.yx); col *= pow(clamp(v.x*v.y*22., 0., 1.), 0.22);
  // Fixed, low-amplitude grain: no brightness oscillator or per-frame reseeding.
  float n = hash(u*srcSize);
  col += (n-0.5)*0.006;
  // tube glass base glow
  col += vec3(0.018,0.022,0.02);
  // rounded corners of the tube
  vec2 q = abs(u-0.5)*2.; vec2 r = vec2(0.06*0.75, 0.06);
  vec2 d = max(q - (1.-r), 0.)/r; float corner = 1. - smoothstep(0.92, 1.0, length(d));
  float edge = step(0., u.x)*step(u.x,1.)*step(0.,u.y)*step(u.y,1.);
  col = max((col-0.06)*contrast+0.06, 0.);
  o = vec4(col*corner*edge*bright, 1.);
}`;

export class CRTDisplay {
  readonly webgl: boolean;
  private gl: WebGL2RenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private progScene!: WebGLProgram; private progOut!: WebGLProgram;
  private srcTex!: WebGLTexture;
  private fbos: { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }[] = [];
  private ping = 0;
  private srcW = 0; private srcH = 0;
  brightness = 1;
  /** Picture (gain) knob. */
  contrast = 1;

  constructor(private canvas: HTMLCanvasElement, public reducedMotion: boolean) {
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    this.webgl = !!gl;
    if (gl) { this.gl = gl; this.initGL(gl); }
    else this.ctx2d = canvas.getContext("2d");
  }

  private compile(gl: WebGL2RenderingContext, fs: string) {
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
    return p;
  }

  private initGL(gl: WebGL2RenderingContext) {
    this.progScene = this.compile(gl, FS_SCENE);
    this.progOut = this.compile(gl, FS_OUT);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.srcTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private ensureFbos(w: number, h: number) {
    const gl = this.gl!;
    if (this.fbos.length && this.fbos[0].w === w && this.fbos[0].h === h) return;
    for (const f of this.fbos) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
    this.fbos = [0, 1].map(() => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return { fb, tex, w, h };
    });
  }

  /** Resize the display canvas to its CSS box at device pixel ratio. */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  private lastT = 0;
  render(src: HTMLCanvasElement, srcChanged: boolean, power: PowerState, time: number) {
    this.resize();
    const W = this.canvas.width, H = this.canvas.height;
    if (!this.gl) return this.render2d(src, power);
    const gl = this.gl;
    if (srcChanged || src.width !== this.srcW || src.height !== this.srcH) {
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.srcW = src.width; this.srcH = src.height;
    }
    this.ensureFbos(W, H);
    const cur = this.fbos[this.ping], prev = this.fbos[1 - this.ping];
    const motion = this.reducedMotion ? 0 : 1;
    // scene pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, cur.fb); gl.viewport(0, 0, W, H);
    gl.useProgram(this.progScene);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prev.tex);
    const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
    gl.uniform1i(u(this.progScene, "src"), 0); gl.uniform1i(u(this.progScene, "prev"), 1);
    gl.uniform2f(u(this.progScene, "srcSize"), this.srcW, this.srcH);
    gl.uniform2f(u(this.progScene, "outSize"), W, H);
    gl.uniform1f(u(this.progScene, "onT"), power.onT);
    gl.uniform1f(u(this.progScene, "offT"), power.offT);
    gl.uniform1f(u(this.progScene, "time"), time);
    gl.uniform1f(u(this.progScene, "motion"), motion);
    // Phosphor decay: frame-rate independent, tau ~27 ms. Scaled so a full-white ghost is
    // ~19% after one 60 fps frame and ~4% (invisible) after two: no readable second copy.
    const dt = this.lastT ? Math.min(0.2, Math.max(0, time - this.lastT)) : 1 / 60;
    this.lastT = time;
    gl.uniform1f(u(this.progScene, "persist"), power.offT >= 0 ? 0.0 : phosphorDecay(dt));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // output pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(this.progOut);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.tex);
    gl.uniform1i(u(this.progOut, "scene"), 0);
    gl.uniform2f(u(this.progOut, "srcSize"), this.srcW, this.srcH);
    gl.uniform2f(u(this.progOut, "outSize"), W, H);
    gl.uniform1f(u(this.progOut, "time"), time);
    gl.uniform1f(u(this.progOut, "motion"), motion);
    gl.uniform1f(u(this.progOut, "bright"), this.brightness);
    gl.uniform1f(u(this.progOut, "contrast"), this.contrast);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.ping = 1 - this.ping;
  }

  private render2d(src: HTMLCanvasElement, power: PowerState) {
    const ctx = this.ctx2d!; const W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = "#050605"; ctx.fillRect(0, 0, W, H);
    let sy = 1, sx = 1;
    if (power.onT >= 0) sy = Math.max(0.004, Math.min(1, power.onT / 0.32));
    else if (power.offT >= 0) { sy = Math.max(0.004, 1 - power.offT / 0.14); sx = Math.max(0.002, 1 - Math.max(0, power.offT - 0.12) / 0.18); if (power.offT > 2) return; }
    else return;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = this.brightness;
    const w = W * sx, h = H * sy;
    ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }
}

/** Phosphor persistence factor for a frame of dt seconds (time constant 27 ms, 0.35 ghost gain). */
export function phosphorDecay(dt: number, tau = 0.027) { return 0.35 * Math.exp(-dt / tau); }
