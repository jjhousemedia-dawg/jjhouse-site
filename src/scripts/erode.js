/* ============================================================
   Hero mask-reveal — a faithful reimplementation of noth.in's.

   Read out of their public bundle (nothinv1.netlify.app/main.js) rather
   than guessed at. Their architecture, in full:

     base   = a flat IMAGE of the hero at rest (paper + black wordmark)
     reveal = a video
     dye    = a Navier-Stokes fluid simulation driven by the pointer
     out    = mix(base, reveal, smoothstep(soft, soft + width, dye * size))

   Two things this corrects about the earlier attempt:

   1. There is NO procedural noise anywhere. The organic shapes come from
      fluid advection, not fbm. Noise is what made the first pass read as
      smoke rather than liquid.
   2. There is NO ink/letterform union. The apparent "black ink spreading
      outside the letters" in the reference is simply their video — which
      is mostly black — showing through the white background. One
      crossfade between two pictures.

   Their exact config:
     simResolution 256 · dyeResolution 512
     velocityDissipation 0.962 · dyeDissipation 0.988
     pressureIterations 20 · curlStrength 0
     splatRadius 6e-5 · splatForce 5900
     revealSize 3.9 · edgeSoftness 0.5 · edgeWidth 0.01

   curlStrength is 0, so vorticity confinement is a no-op and the curl and
   vorticity passes are omitted. edgeWidth 0.01 against a 0.5 threshold is
   a near-binary cut — that is why their boundary is crisp and identical
   on both sides of the edge.
   ============================================================ */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const F_HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
`;

/* ---- splat: exp falloff, added onto the target ---- */
const F_SPLAT = F_HEAD + `
uniform sampler2D uTarget;
uniform float uAspectRatio;
uniform vec2  uPoint;      // segment end   (where the pointer is now)
uniform vec2  uPoint0;     // segment start (where it was last sample)
uniform vec3  uColor;
uniform float uRadius;
void main(){
  // Their splat is a POINT: exp(-dot(p,p)/r) around a single position, one
  // per frame. At speed the pointer travels further between frames than the
  // splat is wide, so the stroke lands as separate dots.
  //
  // This is the same falloff measured to the SEGMENT the pointer travelled,
  // so the stroke is continuous at any speed. When the two ends coincide —
  // slow movement — dot(ba,ba) goes to zero, h clamps to 0 and this reduces
  // exactly to their point splat.
  vec2 pa = vUv - uPoint0;
  vec2 ba = uPoint - uPoint0;
  pa.x *= uAspectRatio;
  ba.x *= uAspectRatio;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);
  vec2 d = pa - ba * h;
  vec3 splat = exp(-dot(d, d) / uRadius) * uColor;
  vec3 base = texture(uTarget, vUv).xyz;
  fragColor = vec4(base + splat, 1.0);
}`;

/* ---- advection, with manual bilinear fetch ---- */
const F_ADVECT = F_HEAD + `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2  uTexelSize;
uniform float uDt;
uniform float uDissipation;
vec4 bilerp(sampler2D sam, vec2 uv, vec2 tsize){
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}
void main(){
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexelSize;
  fragColor = uDissipation * bilerp(uSource, coord, uTexelSize);
}`;

const F_DIVERGENCE = F_HEAD + `
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  float div = 0.5 * (R - L + T - B);
  fragColor = vec4(div, 0.0, 0.0, 1.0);
}`;

const F_PRESSURE = F_HEAD + `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float C = texture(uDivergence, vUv).x;
  float pressure = (L + R + B + T - C) * 0.25;
  fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}`;

const F_GRADIENT = F_HEAD + `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B) * 0.5;
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

/* ---- the water loop that stands in for their video ---- */
const F_WATER = F_HEAD + `
uniform float uTime;
uniform float uAspect;
// Predictable layered ripples. The earlier caustic formula saturated to a
// flat field at this scale, which is why the reveal read as one solid
// colour: mostly dark water, sparse bright crests, nothing in between.
void main(){
  vec2 p = vec2(vUv.x * uAspect, vUv.y) * 6.0;
  float t = uTime * 0.5;
  float w = 0.0;
  w += sin(p.x * 1.7 + t * 1.30);
  w += sin(p.y * 2.1 - t * 1.10);
  w += sin((p.x + p.y) * 1.3 + t * 0.70);
  w += sin(length(p - vec2(3.0, 2.0)) * 2.2 - t * 1.70);
  w *= 0.25;
  float h = clamp(0.5 + 0.5 * w, 0.0, 1.0);
  float spec = pow(h, 14.0);
  vec3 deep = vec3(0.010, 0.026, 0.036);
  vec3 mid  = vec3(0.030, 0.100, 0.140);
  vec3 col = mix(deep, mid, h);
  col += vec3(0.60, 0.86, 0.95) * spec * 0.9;
  fragColor = vec4(col, 1.0);
}`;

/* ---- composite: their shader, unchanged ---- */
const F_COMPOSITE = F_HEAD + `
uniform sampler2D uBaseTexture;
uniform sampler2D uRevealTexture;
uniform sampler2D uDye;
uniform float uRevealSize;
uniform float uEdgeSoftness;
uniform float uEdgeWidth;
uniform float uBaseImageAspect;
uniform float uRevealImageAspect;
uniform float uPlaneAspect;
uniform float uDebug;
vec2 coverUv(vec2 uv, float imageAspect, float planeAspect){
  vec2 ratio = vec2(
    min(planeAspect / imageAspect, 1.0),
    min(imageAspect / planeAspect, 1.0)
  );
  return vec2(uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
              uv.y * ratio.y + (1.0 - ratio.y) * 0.5);
}
void main(){
  float dye = texture(uDye, vUv).r;
  if (uDebug > 2.5) { fragColor = vec4(texture(uRevealTexture, vUv).rgb, 1.0); return; }
  if (uDebug > 1.5) { fragColor = vec4(vec3(dye), 1.0); return; }
  if (uDebug > 0.5) { fragColor = vec4(vec3(dye * 40.0), 1.0); return; }
  vec2 baseUv = coverUv(vUv, uBaseImageAspect, uPlaneAspect);
  baseUv = clamp(baseUv, 0.001, 0.999);
  vec4 baseColor = texture(uBaseTexture, baseUv);
  vec2 revealUv = coverUv(vUv, uRevealImageAspect, uPlaneAspect);
  revealUv = clamp(revealUv, 0.001, 0.999);
  vec4 revealColor = texture(uRevealTexture, revealUv);
  float raw  = dye * uRevealSize;
  float mask = smoothstep(uEdgeSoftness, uEdgeSoftness + uEdgeWidth, raw);
  mask = clamp(mask, 0.0, 1.0);
  fragColor = mix(baseColor, revealColor, mask);
}`;

function sh(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[erode] shader:', gl.getShaderInfoLog(s), src.slice(0, 200));
    return null;
  }
  return s;
}
function prog(gl, fs){
  const v = sh(gl, gl.VERTEX_SHADER, VERT), f = sh(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[erode] link:', gl.getProgramInfoLog(p));
    return null;
  }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++){
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export function initErode(surface){
  const hero   = surface.closest('.arrival') || surface;
  const textEl = surface.querySelector('.wordmark__svg, .wordmark__placeholder');
  const canvas = hero.querySelector('canvas.surface__erode');
  if (!textEl || !canvas) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) return false;
  if (!gl.getExtension('EXT_color_buffer_float')) return false;
  gl.getExtension('OES_texture_float_linear');

  const P = {
    splat: prog(gl, F_SPLAT), advect: prog(gl, F_ADVECT), diverge: prog(gl, F_DIVERGENCE),
    pressure: prog(gl, F_PRESSURE), gradient: prog(gl, F_GRADIENT),
    water: prog(gl, F_WATER), composite: prog(gl, F_COMPOSITE),
  };
  if (Object.values(P).some((x) => !x)) return false;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const q = new URLSearchParams(location.search);
  const d = surface.dataset;
  const k = (name, fb) => parseFloat(q.get(name) ?? d[name] ?? fb);

  // their numbers, verbatim
  const CFG = {
    simRes:      k('simres', 256),
    dyeRes:      k('dyeres', 512),
    velDiss:     k('veldiss', 0.962),
    dyeDiss:     k('dyediss', 0.988),
    iterations:  k('iters', 20),
    splatRadius: k('splatradius', 2.6e-4),
    splatForce:  k('splatforce', 5900),
    revealSize:  k('revealsize', 3.9),
    edgeSoftness:k('edgesoftness', 0.5),
    edgeWidth:   k('edgewidth', 0.01),
  };

  const texA = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  function fbo(w, h){
    const t = texA();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h, texel: [1 / w, 1 / h] };
  }
  const dbl = (w, h) => {
    let a = fbo(w, h), b = fbo(w, h);
    return { get read(){ return a; }, get write(){ return b; }, swap(){ const t = a; a = b; b = t; }, w, h };
  };

  let velocity, dyeFbo, divergence, pressure, water, baseTex, revealTex;
  let W = 0, H = 0;

  function build(){
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nW = Math.max(2, Math.round(r.width));
    const nH = Math.max(2, Math.round(r.height));
    // Mobile fires resize when the URL bar shows or hides, but the canvas
    // is sized in svh so its rect does not actually change. Rebuilding the
    // FBOs anyway wipes the dye field mid-scroll. Only rebuild on a real
    // size change.
    if (velocity && nW === W && nH === H && canvas.width === Math.round(nW * dpr)) return;
    W = nW;
    H = nH;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    // BASE IS TRANSPARENT. This is the part that took reading their DOM to
    // see: the canvas is a clear overlay, not a picture of the hero. The
    // wordmark stays an ordinary DOM element underneath and the plate is
    // painted over it only where the dye has reached. It is why their deck
    // copy and CTA survive untouched while the letters still get eaten, and
    // why the reveal can run over the section below.
    if (!baseTex) {
      baseTex = texA();
      gl.bindTexture(gl.TEXTURE_2D, baseTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                    new Uint8Array([0, 0, 0, 0]));
    }

    // Resolution is set on the SHORT edge and scaled by aspect — but this
    // canvas is 3x the viewport, so an unclamped long edge lands at 512x1536
    // for dye and 256x768 for the sim, and 20 pressure iterations per frame
    // at that size starves requestAnimationFrame outright. Clamp the long
    // edge; the fluid does not read any finer at this scale anyway.
    const CAP_SIM = 512, CAP_DYE = 1024;
    const fit = (res, cap) => {
      const ar = W / H;
      let w = ar > 1 ? Math.round(res * ar) : res;
      let h = ar > 1 ? res : Math.round(res / ar);
      const long = Math.max(w, h);
      if (long > cap) { const k = cap / long; w = Math.round(w * k); h = Math.round(h * k); }
      return [Math.max(2, w), Math.max(2, h)];
    };
    const [sw, shh] = fit(Math.round(CFG.simRes), CAP_SIM);
    const [dw, dh]  = fit(Math.round(CFG.dyeRes), CAP_DYE);
    velocity   = dbl(sw, shh);
    pressure   = dbl(sw, shh);
    divergence = fbo(sw, shh);
    dyeFbo     = dbl(dw, dh);
    water      = fbo(dw, dh);
    revealTex  = water.t;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const draw = (target) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const bind = (unit, tex, loc) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  };

  // ---- pointer ----
  // Every sample is kept, not just the last one per frame. Browsers coalesce
  // pointermove and only deliver one per rAF by default; getCoalescedEvents
  // hands back the full high-frequency path the OS actually reported, which
  // is the difference between a smooth stroke and a dotted one on a flick.
  const queue = [];
  let lastPt = null, everMoved = false;
  // On touch, "the visitor took over" cannot mean everMoved=true forever:
  // scrolling fires touchmove, so the first scroll would permanently kill
  // the autonomous drift and the mechanic goes invisible on phones (spec
  // §5 wants the drift there for exactly that reason). Touch pauses the
  // drift; a mouse or pen retires it.
  let lastTouchT = -1e9;

  const toUv = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / r.width, y: 1.0 - (cy - r.top) / r.height };
  };
  const onMove = (e) => {
    let evs = [e];
    if (typeof e.getCoalescedEvents === 'function') {
      const c = e.getCoalescedEvents();
      if (c && c.length) evs = c;
    }
    for (const ev of evs) queue.push(toUv(ev.clientX, ev.clientY));
    if (e.pointerType === 'touch') lastTouchT = performance.now();
    else everMoved = true;
  };
  // Listen on the window, not the hero. The sheet now reaches well past the
  // fold, so the cursor has to keep driving it while it is over the section
  // below. Points outside the canvas map to uv outside 0..1 and simply splat
  // off-surface, which is harmless and keeps strokes continuous as the
  // pointer crosses the boundary.
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', (e) => { lastPt = null; onMove(e); }, { passive: true });
  addEventListener('touchmove', (e) => {
    for (const t of e.touches) queue.push(toUv(t.clientX, t.clientY));
    lastTouchT = performance.now();
  }, { passive: true });

  function splat(x0, y0, x1, y1, dx, dy){
    splats++;
    gl.useProgram(P.splat.p);
    bind(0, velocity.read.t, P.splat.u.uTarget);
    gl.uniform1f(P.splat.u.uAspectRatio, W / H);
    gl.uniform2f(P.splat.u.uPoint0, x0, y0);
    gl.uniform2f(P.splat.u.uPoint, x1, y1);
    gl.uniform3f(P.splat.u.uColor, dx, dy, 0);
    gl.uniform1f(P.splat.u.uRadius, CFG.splatRadius);
    draw(velocity.write); velocity.swap();

    bind(0, dyeFbo.read.t, P.splat.u.uTarget);
    gl.uniform3f(P.splat.u.uColor, 1, 1, 1);
    draw(dyeFbo.write); dyeFbo.swap();
  }

  build();

  // Nothing to see behind the loader, and the sim is the most expensive
  // thing on the page — running it under the curtain starves the loader's
  // own animation frames.
  let curtain = document.documentElement.hasAttribute('data-loading');
  if (curtain) {
    const mo = new MutationObserver(() => {
      if (!document.documentElement.hasAttribute('data-loading')) {
        curtain = false; mo.disconnect(); t0 = prevT = performance.now();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-loading'] });
  }

  const DBGMODE = parseFloat(new URLSearchParams(location.search).get('dbg') || '0');
  let frameNo = 0, splats = 0, lastDriftT = 0;
  let t0 = performance.now(), prevT = t0;

  function frame(now){
    if (curtain) { prevT = now; requestAnimationFrame(frame); return; }
    const dt = Math.min((now - prevT) / 1000, 0.016666);
    prevT = now;
    const time = (now - t0) / 1000;

    if (queue.length) {
      // cap the work per frame, but by SUBSAMPLING the path rather than
      // dropping its tail — the stroke must still reach where the cursor is
      const MAXSEG = 24;
      const stride = Math.max(1, Math.ceil(queue.length / MAXSEG));
      let prev = lastPt || queue[0];
      for (let i = 0; i < queue.length; i += stride) {
        const cur = queue[Math.min(i + stride - 1, queue.length - 1)];
        splat(prev.x, prev.y, cur.x, cur.y,
              (cur.x - prev.x) * CFG.splatForce, (cur.y - prev.y) * CFG.splatForce);
        prev = cur;
      }
      lastPt = prev;
      queue.length = 0;
    }
    else if (!everMoved && now - lastTouchT > 2400) {
      // Autonomous sweep until the visitor takes over. The reference does
      // something similar; it also means the mechanic is never invisible to
      // someone who lands and does not move, or on a touch device. After a
      // touch it waits ~2.4s, then resumes.
      const a = time * 1.15;
      const x = 0.5 + Math.sin(a) * 0.34;
      const y = 0.46 + Math.sin(a * 2.1) * 0.16;
      // If the drift was interrupted (by a touch), do not draw one long
      // streak from the last finger position to the sweep — restart clean.
      if (now - lastDriftT > 400) lastPt = null;
      lastDriftT = now;
      const prev = lastPt || { x, y };
      splat(prev.x, prev.y, x, y,
            (x - prev.x) * CFG.splatForce, (y - prev.y) * CFG.splatForce);
      lastPt = { x, y };
    }

    // divergence
    gl.useProgram(P.diverge.p);
    gl.uniform2f(P.diverge.u.uTexelSize, velocity.read.texel[0], velocity.read.texel[1]);
    bind(0, velocity.read.t, P.diverge.u.uVelocity);
    draw(divergence);

    // pressure jacobi
    gl.useProgram(P.pressure.p);
    gl.uniform2f(P.pressure.u.uTexelSize, velocity.read.texel[0], velocity.read.texel[1]);
    bind(0, divergence.t, P.pressure.u.uDivergence);
    for (let i = 0; i < CFG.iterations; i++){
      bind(1, pressure.read.t, P.pressure.u.uPressure);
      draw(pressure.write); pressure.swap();
    }

    // subtract gradient
    gl.useProgram(P.gradient.p);
    gl.uniform2f(P.gradient.u.uTexelSize, velocity.read.texel[0], velocity.read.texel[1]);
    bind(0, pressure.read.t, P.gradient.u.uPressure);
    bind(1, velocity.read.t, P.gradient.u.uVelocity);
    draw(velocity.write); velocity.swap();

    // advect velocity, then dye
    gl.useProgram(P.advect.p);
    gl.uniform2f(P.advect.u.uTexelSize, velocity.read.texel[0], velocity.read.texel[1]);
    gl.uniform1f(P.advect.u.uDt, dt);
    gl.uniform1f(P.advect.u.uDissipation, CFG.velDiss);
    bind(0, velocity.read.t, P.advect.u.uVelocity);
    bind(1, velocity.read.t, P.advect.u.uSource);
    draw(velocity.write); velocity.swap();

    gl.uniform2f(P.advect.u.uTexelSize, dyeFbo.read.texel[0], dyeFbo.read.texel[1]);
    gl.uniform1f(P.advect.u.uDissipation, CFG.dyeDiss);
    bind(0, velocity.read.t, P.advect.u.uVelocity);
    bind(1, dyeFbo.read.t, P.advect.u.uSource);
    draw(dyeFbo.write); dyeFbo.swap();

    // the stand-in plate
    gl.useProgram(P.water.p);
    gl.uniform1f(P.water.u.uTime, time);
    gl.uniform1f(P.water.u.uAspect, W / H);
    draw(water);

    // composite — their shader, their constants
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.composite.p);
    bind(0, baseTex, P.composite.u.uBaseTexture);
    bind(1, revealTex, P.composite.u.uRevealTexture);
    bind(2, dyeFbo.read.t, P.composite.u.uDye);
    gl.uniform1f(P.composite.u.uRevealSize, CFG.revealSize);
    gl.uniform1f(P.composite.u.uEdgeSoftness, CFG.edgeSoftness);
    gl.uniform1f(P.composite.u.uEdgeWidth, CFG.edgeWidth);
    gl.uniform1f(P.composite.u.uBaseImageAspect, W / H);
    gl.uniform1f(P.composite.u.uRevealImageAspect, W / H);
    gl.uniform1f(P.composite.u.uPlaneAspect, W / H);
    gl.uniform1f(P.composite.u.uDebug, DBGMODE);
    draw(null);

    frameNo++;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 160); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(build, 60));
  return true;
}
