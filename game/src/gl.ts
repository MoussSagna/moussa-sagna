/** Petits utilitaires WebGL partagés par le décor et le personnage. */

export function createProgram(gl: WebGLRenderingContext, vertex: string, fragment: string): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader))
      return null
    }
    return shader
  }
  const vs = compile(gl.VERTEX_SHADER, vertex)
  const fs = compile(gl.FRAGMENT_SHADER, fragment)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  return program
}

/** Un quad plein écran sur l'attribut `a`, à dessiner en TRIANGLE_STRIP. */
export function bindQuad(gl: WebGLRenderingContext, program: WebGLProgram): void {
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const location = gl.getAttribLocation(program, 'a')
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
}

export function uniforms<T extends string>(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  names: readonly T[],
): Record<T, WebGLUniformLocation | null> {
  const out = {} as Record<T, WebGLUniformLocation | null>
  for (const name of names) out[name] = gl.getUniformLocation(program, name)
  return out
}

interface TextureOptions {
  alpha?: boolean
  premultiply?: boolean
  mipmap?: boolean
}

/** Images demandées et images arrivées (chargées ou introuvables), pour l'écran de chargement. */
const loading = { started: 0, done: 0, listeners: new Set<(done: number, started: number) => void>() }

/** S'abonne à l'avancée du chargement des images ; retourne la fonction qui désabonne. */
export function onLoadProgress(listener: (done: number, started: number) => void): () => void {
  loading.listeners.add(listener)
  listener(loading.done, loading.started)
  return () => loading.listeners.delete(listener)
}

const notify = () => {
  for (const listener of loading.listeners) listener(loading.done, loading.started)
}

/** Charge et décode une image. Résout `null` si elle est introuvable. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  loading.started += 1
  notify()
  return new Promise((resolve) => {
    const image = new Image()
    const finish = (result: HTMLImageElement | null) => {
      loading.done += 1
      notify()
      resolve(result)
    }
    image.onload = () => finish(image)
    image.onerror = () => finish(null)
    image.src = src
  })
}

/** Envoie une image déjà chargée dans une nouvelle texture, laissée liée à l'unité `unit`. */
export function uploadTexture(gl: WebGLRenderingContext, unit: number, image: HTMLImageElement, options: TextureOptions = {}): WebGLTexture | null {
  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, options.premultiply ? 1 : 0)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  const format = options.alpha ? gl.RGBA : gl.RGB
  gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, image)
  // les mipmaps demandent une image dont les côtés sont des puissances de deux
  if (options.mipmap) gl.generateMipmap(gl.TEXTURE_2D)
  return texture
}

/** Charge une image dans une unité de texture, où elle reste. Résout `false` si l'image est introuvable. */
export async function loadTexture(gl: WebGLRenderingContext, unit: number, src: string, options: TextureOptions = {}): Promise<boolean> {
  const image = await loadImage(src)
  return image !== null && uploadTexture(gl, unit, image, options) !== null
}

export const asset = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`
