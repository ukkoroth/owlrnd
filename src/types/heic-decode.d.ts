// heic-decode ships without types. Decodes the primary image of a HEIC/HEIF file to RGBA pixels.
declare module "heic-decode" {
  function decode(input: { buffer: Buffer | ArrayBuffer | Uint8Array }): Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
  export default decode;
}
