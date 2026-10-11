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

/**
 * Charge une image dans une texture et la laisse liée à l'unité `unit`.
 * Résout `null` si l'image est introuvable.
 */
export function createTexture(
  gl: WebGLRenderingContext,
  unit: number,
  src: string,
  options: TextureOptions = {},
): Promise<WebGLTexture | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
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
      resolve(texture)
    }
    image.onerror = () => resolve(null)
    image.src = src
  })
}

/** Charge une image dans une unité de texture, où elle reste. Résout `false` si l'image est introuvable. */
export async function loadTexture(gl: WebGLRenderingContext, unit: number, src: string, options: TextureOptions = {}): Promise<boolean> {
  return (await createTexture(gl, unit, src, options)) !== null
}

export const asset = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`
