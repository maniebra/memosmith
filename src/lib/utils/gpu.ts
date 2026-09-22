/** Renderer names that mean the GPU is being emulated on the CPU. */
const SOFTWARE =
  /swiftshader|llvmpipe|softpipe|software|swrast|microsoft basic/i;

export const isSoftwareRenderer = (renderer: string) => SOFTWARE.test(renderer);

/**
 * Whether this machine has a GPU worth drawing on, asked once through WebGL.
 * A software rasteriser answers WebGL calls just as happily as a real card, so
 * the renderer name is the only thing that tells them apart.
 */
export function hasGpu() {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;

    if (!gl) {
      return false;
    }

    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(
        info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
      ) as string,
    );

    // The probe context is of no further use, and contexts are a scarce
    // resource in a webview.
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    return !isSoftwareRenderer(renderer);
  } catch {
    return false;
  }
}
