/* ============================================================
   Wordmark erosion — the "algae on a lake" reveal.

   Mechanic, matching what noth.in actually runs (verified: a live
   WebGL2 canvas.mask-reveal-canvas, no three.js):

     1. Rasterise the wordmark to a matte texture (white on black).
     2. Keep a ping-pong trail buffer. Each frame the previous trail is
        multiplied by a decay constant and the pointer is stamped in,
        weighted by velocity. The decay IS the foam closing over the
        lake — it is the single number that owns the feel.
     3. Add procedural noise to the trail BEFORE thresholding. Without
        this the erosion edge is a clean circle. With it the edge is
        cellular and tattered, which is the whole illusion.
     4. alpha = matte, colour = mix(substrate, ink, 1 - erosion)

   Substrate is a procedural colour field until JJ's Blender geo-nodes
   render exists. Pass a video/image URL via data-substrate to swap it.
   ============================================================ */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/* ---- trail pass: decay everything, stamp the pointer segment ---- */
const TRAIL = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uPrev;
uniform vec2  uP;        // pointer now, uv
uniform vec2  uPPrev;    // pointer last frame, uv
uniform float uDecay;    // the foam constant
uniform float uRadius;
uniform float uStrength;
uniform float uAspect;
uniform float uActive;

// distance to the segment travelled since last frame, so a fast flick
// paints a continuous stroke instead of a dotted line
float segDist(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main(){
  float prev = texture(uPrev, vUv).r * uDecay;
  vec2 p  = vec2(vUv.x * uAspect, vUv.y);
  vec2 a  = vec2(uP.x * uAspect, uP.y);
  vec2 b  = vec2(uPPrev.x * uAspect, uPPrev.y);
  float d = segDist(p, a, b);
  float stamp = smoothstep(uRadius, 0.0, d) * uStrength * uActive;
  frag = vec4(max(prev, stamp), 0.0, 0.0, 1.0);
}`;

/* ---- display pass ---- */
const DISP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uMatte;
uniform sampler2D uTrail;
uniform sampler2D uSub;
uniform float uHasSub;
uniform float uTime;
uniform float uNoise;     // amplitude
uniform float uScale;     // cells across the wordmark
uniform vec3  uInk;
uniform float uAspect;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.02; a *= 0.5; }
  return v;
}

// hair-system stand-in: domain-warped striations, in colour, per spec §5
vec3 substrate(vec2 uv){
  vec2 q = vec2(uv.x * uAspect, uv.y);
  float w = fbm(q * 3.0 + vec2(uTime * 0.03, 0.0));
  float strand = fbm(q * vec2(38.0, 9.0) + vec2(w * 2.2, uTime * 0.05));
  float band = fbm(q * 1.6 - vec2(0.0, uTime * 0.02));
  vec3 warm = vec3(1.00, 0.46, 0.12);
  vec3 deep = vec3(0.30, 0.16, 0.72);
  vec3 gold = vec3(1.00, 0.86, 0.36);
  vec3 teal = vec3(0.10, 0.72, 0.70);
  vec3 c = mix(deep, warm, smoothstep(0.28, 0.70, band));
  c = mix(c, teal, smoothstep(0.62, 0.98, w) * 0.45);
  c = mix(c, gold, smoothstep(0.52, 0.92, strand) * 0.85);
  return c * (0.95 + 0.55 * strand);
}

void main(){
  float matte = texture(uMatte, vUv).a;
  if (matte < 0.003) { frag = vec4(0.0); return; }

  float trail = texture(uTrail, vUv).r;

  // noise added BEFORE the threshold — this is what makes the edge
  // tattered rather than a clean circle
  float n = fbm(vec2(vUv.x * uAspect, vUv.y) * uScale + uTime * 0.06);
  float e = smoothstep(0.30, 0.66, trail + (n - 0.5) * uNoise);

  vec3 sub = uHasSub > 0.5 ? texture(uSub, vUv).rgb : substrate(vUv);
  vec3 col = mix(uInk, sub, e);

  frag = vec4(col, matte);
}`;

function compile(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[erode] shader:', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}
function program(gl, vs, fs){
  const v = compile(gl, gl.VERTEX_SHADER, vs), f = compile(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[erode] link:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

export function initErode(surface){
  const textEl = surface.querySelector('.wordmark__placeholder');
  const canvas = surface.querySelector('canvas.surface__erode');
  if (!textEl || !canvas) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  const gl = canvas.getContext('webgl2', {
    alpha: true, premultipliedAlpha: false, antialias: false, depth: false,
  });
  if (!gl) return false;   // caller keeps the DOM text visible

  const pTrail = program(gl, VERT, TRAIL);
  const pDisp  = program(gl, VERT, DISP);
  if (!pTrail || !pDisp) return false;

  // fullscreen triangle pair
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const matteTex = gl.createTexture();
  const mk = (w, h) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb };
  };
  gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('EXT_float_blend');

  let A = null, B = null, W = 0, H = 0, TW = 0, TH = 0;
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

  // --- rasterise the wordmark to a matte -------------------------
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');

  function buildMatte(){
    const r = surface.getBoundingClientRect();
    const dpr = DPR();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    off.width  = Math.round(W * dpr);
    off.height = Math.round(H * dpr);

    const cs = getComputedStyle(textEl);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);
    // the font shorthand carries weight onto a variable wght axis
    octx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
    if ('letterSpacing' in octx) octx.letterSpacing = cs.letterSpacing;
    octx.textAlign = 'left';
    octx.textBaseline = 'alphabetic';
    octx.fillStyle = '#fff';

    // place the glyphs exactly where the DOM text sits
    const tr = textEl.getBoundingClientRect();
    const m = octx.measureText(textEl.textContent.trim());
    const x = tr.left - r.left;
    const y = (tr.top - r.top) + (tr.height + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent)) / 2;
    octx.fillText(textEl.textContent.trim(), x, y);

    gl.bindTexture(gl.TEXTURE_2D, matteTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    canvas.width  = off.width;
    canvas.height = off.height;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    // trail buffers run at half res: cheaper, and the blur helps the foam
    TW = Math.max(2, Math.round(W * 0.5));
    TH = Math.max(2, Math.round(H * 0.5));
    A = mk(TW, TH); B = mk(TW, TH);
    [A, B].forEach((o) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, o.fb);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // --- pointer ----------------------------------------------------
  const P = { x: 0.5, y: 0.5 }, PP = { x: 0.5, y: 0.5 };
  let active = 0, idle = 0, vel = 0;

  const move = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    const nx = (cx - r.left) / r.width;
    const ny = 1.0 - (cy - r.top) / r.height;
    vel = Math.min(1, Math.hypot(nx - P.x, ny - P.y) * 14);
    PP.x = P.x; PP.y = P.y; P.x = nx; P.y = ny;
    active = 1; idle = 0;
  };
  surface.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
  surface.addEventListener('pointerdown', (e) => move(e.clientX, e.clientY));
  surface.addEventListener('pointerleave', () => { active = 0; });
  surface.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; if (t) move(t.clientX, t.clientY);
  }, { passive: true });

  // Knobs. Defaults live on the element; a query string overrides them so
  // the feel can be dialled in the browser without touching code:
  //   ?decay=0.97&radius=0.32&noise=0.7&scale=14
  const opts = surface.dataset;
  const q = new URLSearchParams(location.search);
  const knob = (name, fallback) => parseFloat(q.get(name) ?? opts[name] ?? fallback);
  const DECAY  = knob('decay',  '0.955');   // the foam. higher = slower close
  const RADIUS = knob('radius', '0.26');    // fraction of wordmark HEIGHT
  const NOISE  = knob('noise',  '0.62');    // how tattered the edge reads
  const SCALE  = knob('scale',  '18');      // cells across the mark

  const ink = (() => {
    const c = getComputedStyle(document.body).color.match(/[\d.]+/g) || [11, 11, 11];
    return [c[0] / 255, c[1] / 255, c[2] / 255];
  })();

  const uT = {
    prev: gl.getUniformLocation(pTrail, 'uPrev'), p: gl.getUniformLocation(pTrail, 'uP'),
    pprev: gl.getUniformLocation(pTrail, 'uPPrev'), decay: gl.getUniformLocation(pTrail, 'uDecay'),
    radius: gl.getUniformLocation(pTrail, 'uRadius'), strength: gl.getUniformLocation(pTrail, 'uStrength'),
    aspect: gl.getUniformLocation(pTrail, 'uAspect'), active: gl.getUniformLocation(pTrail, 'uActive'),
  };
  const uD = {
    matte: gl.getUniformLocation(pDisp, 'uMatte'), trail: gl.getUniformLocation(pDisp, 'uTrail'),
    sub: gl.getUniformLocation(pDisp, 'uSub'), hasSub: gl.getUniformLocation(pDisp, 'uHasSub'),
    time: gl.getUniformLocation(pDisp, 'uTime'), noise: gl.getUniformLocation(pDisp, 'uNoise'),
    scale: gl.getUniformLocation(pDisp, 'uScale'), ink: gl.getUniformLocation(pDisp, 'uInk'),
    aspect: gl.getUniformLocation(pDisp, 'uAspect'),
  };

  buildMatte();
  let t0 = performance.now();

  function frame(now){
    const t = (now - t0) / 1000;
    const aspect = W / Math.max(1, H);

    // idle drift so the idea is not invisible on a touch device or to a
    // visitor who never moves the mouse across the mark
    idle += 1;
    if (idle > 90) {
      const a = t * 0.55;
      move(
        canvas.getBoundingClientRect().left + W * (0.5 + Math.sin(a) * 0.34),
        canvas.getBoundingClientRect().top + H * (0.5 + Math.cos(a * 0.8) * 0.3)
      );
      vel = 0.55;
    }

    // --- trail
    gl.useProgram(pTrail);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
    gl.viewport(0, 0, TW, TH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.t);
    gl.uniform1i(uT.prev, 0);
    gl.uniform2f(uT.p, P.x, P.y);
    gl.uniform2f(uT.pprev, PP.x, PP.y);
    gl.uniform1f(uT.decay, DECAY);
    gl.uniform1f(uT.radius, RADIUS);
    gl.uniform1f(uT.strength, 0.78 + vel * 0.55);
    gl.uniform1f(uT.aspect, aspect);
    gl.uniform1f(uT.active, active);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const tmp = A; A = B; B = tmp;

    PP.x = P.x; PP.y = P.y;
    vel *= 0.86;

    // --- display
    gl.useProgram(pDisp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, matteTex); gl.uniform1i(uD.matte, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, A.t);      gl.uniform1i(uD.trail, 1);
    gl.uniform1f(uD.hasSub, 0.0);
    gl.uniform1f(uD.time, t);
    gl.uniform1f(uD.noise, NOISE);
    gl.uniform1f(uD.scale, SCALE);
    gl.uniform3f(uD.ink, ink[0], ink[1], ink[2]);
    gl.uniform1f(uD.aspect, aspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(buildMatte, 160); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(buildMatte, 60));

  return true;
}
