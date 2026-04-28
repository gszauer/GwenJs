// Texture — port of `Gwen::Texture` (Texture.h).
//
// A plain data record. The `data` field is a backend-specific handle
// (e.g. `WebGLTexture` for `WebGL2Renderer`) and is therefore typed as
// `unknown` in the shared interface; backends narrow it internally.

export interface Texture {
  name: string;
  data: unknown;
  failed: boolean;
  width: number;
  height: number;
}

export function texture(name = ''): Texture {
  return { name, data: null, failed: false, width: 0, height: 0 };
}
