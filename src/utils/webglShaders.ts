export interface ShaderEffectParams {
  enabled: boolean;
  chromaticAberration: number;
  scanlines: number;
  vignette: number;
  distortion: number;
  rgbShift: number;
  noise: number;
  pixelate: number;
  heatHaze: number;
}

export type { ShaderEffectParams as default };

export const defaultShaderParams: ShaderEffectParams = {
  enabled: false,
  chromaticAberration: 0,
  scanlines: 0,
  vignette: 0,
  distortion: 0,
  rgbShift: 0,
  noise: 0,
  pixelate: 0,
  heatHaze: 0,
};

// Vertex shader - full screen quad
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// Fragment shader with all effects
const fragmentShaderSource = `
  precision mediump float;
  
  uniform sampler2D u_image;
  uniform vec2 u_resolution;
  uniform float u_time;
  
  // Effect uniforms
  uniform float u_chromaticAberration;
  uniform float u_scanlines;
  uniform float u_vignette;
  uniform float u_distortion;
  uniform float u_rgbShift;
  uniform float u_noise;
  uniform float u_pixelate;
  uniform float u_heatHaze;
  
  varying vec2 v_texCoord;
  
  // Random function for noise
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Simplex noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                     + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                            dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  void main() {
    vec2 uv = v_texCoord;
    vec2 resolution = u_resolution;
    
    // Pixelate effect
    if (u_pixelate > 0.0) {
      float pixels = max(10.0, 100.0 - u_pixelate);
      vec2 pixelated = floor(uv * pixels) / pixels;
      uv = mix(uv, pixelated, u_pixelate / 100.0);
    }
    
    // Barrel distortion
    vec2 distortedUV = uv;
    if (u_distortion > 0.0) {
      vec2 center = vec2(0.5);
      vec2 tc = uv - center;
      float dist = length(tc);
      float strength = u_distortion / 100.0;
      tc = tc * (1.0 + strength * dist * dist);
      distortedUV = center + tc;
    }
    
    // Heat haze effect
    vec2 heatUV = distortedUV;
    if (u_heatHaze > 0.0) {
      float time = u_time * 2.0;
      float noise1 = snoise(distortedUV * 10.0 + time * 0.5);
      float noise2 = snoise(distortedUV * 20.0 - time * 0.3);
      vec2 offset = vec2(noise1, noise2) * (u_heatHaze / 100.0) * 0.05;
      heatUV = distortedUV + offset;
    }
    
    // RGB Shift / Chromatic Aberration
    float shift = (u_chromaticAberration + u_rgbShift) / 100.0 * 0.02;
    
    vec4 colorR = texture2D(u_image, heatUV + vec2(shift, 0.0));
    vec4 colorG = texture2D(u_image, heatUV);
    vec4 colorB = texture2D(u_image, heatUV - vec2(shift, 0.0));
    
    vec4 color = vec4(colorR.r, colorG.g, colorB.b, 1.0);
    
    // Scanlines
    if (u_scanlines > 0.0) {
      float scanline = sin(uv.y * resolution.y * 2.0) * 0.5 + 0.5;
      float scanlineIntensity = u_scanlines / 100.0 * 0.3;
      color.rgb *= (1.0 - scanlineIntensity * scanline);
    }
    
    // Vignette
    if (u_vignette > 0.0) {
      vec2 center = vec2(0.5);
      float dist = length(uv - center);
      float vignette = smoothstep(0.8, 0.2, dist * (u_vignette / 100.0));
      color.rgb *= vignette;
    }
    
    // Noise
    if (u_noise > 0.0) {
      float noiseVal = random(uv + u_time * 0.01);
      color.rgb += (noiseVal - 0.5) * (u_noise / 100.0);
    }
    
    gl_FragColor = color;
  }
`;

export class WebGLShaderProcessor {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms: Map<string, WebGLUniformLocation> = new Map();
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized = false;

  constructor() {}

  initialize(canvas: HTMLCanvasElement): boolean {
    if (this.isInitialized && this.canvas === canvas) return true;
    
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      alpha: true,
      antialias: false,
    });
    
    if (!gl) {
      console.warn('WebGL not supported');
      return false;
    }
    
    this.gl = gl;
    
    // Create shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      return false;
    }
    
    // Create program
    this.program = this.createProgram(vertexShader, fragmentShader);
    if (!this.program) return false;
    
    // Get attribute locations and create buffers
    this.setupBuffers();
    
    // Get uniform locations
    this.cacheUniforms();
    
    // Create texture
    this.texture = gl.createTexture();
    
    this.isInitialized = true;
    return true;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    if (!this.gl) return null;
    const program = this.gl.createProgram();
    if (!program) return null;
    
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      return null;
    }
    
    return program;
  }

  private setupBuffers(): void {
    if (!this.gl || !this.program) return;
    
    // Position buffer (full screen quad)
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    
    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    // Texture coordinate buffer
    const texCoords = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      0, 0,
      1, 1,
      1, 0,
    ]);
    
    this.texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
    
    const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  private cacheUniforms(): void {
    if (!this.gl || !this.program) return;
    
    const uniformNames = [
      'u_image',
      'u_resolution',
      'u_time',
      'u_chromaticAberration',
      'u_scanlines',
      'u_vignette',
      'u_distortion',
      'u_rgbShift',
      'u_noise',
      'u_pixelate',
      'u_heatHaze',
    ];
    
    for (const name of uniformNames) {
      const location = this.gl.getUniformLocation(this.program, name);
      if (location) this.uniforms.set(name, location);
    }
  }

  process(
    source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    params: ShaderEffectParams,
    time: number = 0
  ): void {
    if (!this.gl || !this.program || !this.texture || !this.canvas) return;
    
    const gl = this.gl;
    
    // Resize canvas if needed
    const width = source instanceof HTMLVideoElement ? source.videoWidth : 
                  (source as HTMLImageElement).naturalWidth || source.width;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : 
                   (source as HTMLImageElement).naturalHeight || source.height;
    
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    
    gl.useProgram(this.program);
    
    // Update texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Set uniforms
    const getUniform = (name: string): WebGLUniformLocation | null => {
      return this.uniforms.get(name) ?? null;
    };
    
    gl.uniform1i(getUniform('u_image'), 0);
    gl.uniform2f(getUniform('u_resolution'), width, height);
    gl.uniform1f(getUniform('u_time'), time);
    
    gl.uniform1f(getUniform('u_chromaticAberration'), params.chromaticAberration);
    gl.uniform1f(getUniform('u_scanlines'), params.scanlines);
    gl.uniform1f(getUniform('u_vignette'), params.vignette);
    gl.uniform1f(getUniform('u_distortion'), params.distortion);
    gl.uniform1f(getUniform('u_rgbShift'), params.rgbShift);
    gl.uniform1f(getUniform('u_noise'), params.noise);
    gl.uniform1f(getUniform('u_pixelate'), params.pixelate);
    gl.uniform1f(getUniform('u_heatHaze'), params.heatHaze);
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  isSupported(): boolean {
    return this.isInitialized;
  }

  dispose(): void {
    if (!this.gl) return;
    
    if (this.texture) this.gl.deleteTexture(this.texture);
    if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) this.gl.deleteBuffer(this.texCoordBuffer);
    if (this.program) this.gl.deleteProgram(this.program);
    
    this.isInitialized = false;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.positionBuffer = null;
    this.texCoordBuffer = null;
  }
}

// Singleton instance
let shaderProcessor: WebGLShaderProcessor | null = null;

export function getShaderProcessor(): WebGLShaderProcessor {
  if (!shaderProcessor) {
    shaderProcessor = new WebGLShaderProcessor();
  }
  return shaderProcessor;
}

export function disposeShaderProcessor(): void {
  if (shaderProcessor) {
    shaderProcessor.dispose();
    shaderProcessor = null;
  }
}
