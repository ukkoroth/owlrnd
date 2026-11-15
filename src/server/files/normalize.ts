import "server-only";
import decodeHeic from "heic-decode";
import sharp from "sharp";

export type Upload = { name: string; type: string; data: Buffer };

/** The long edge photos are resized to, like the browser does before upload (src/lib/resizeImage.ts). */
const MAX_EDGE = 2000;
/** Photos above this are resized on the server (the browser normally shrinks them first). */
const RESIZE_ABOVE_BYTES = 4 * 1024 * 1024;

/** HEIC/HEIF (iPhone photos): by type, by name, or by the file's own header (some browsers send no type). */
export function isHeic(f: Upload) {
  if (/^image\/hei[cf](-sequence)?$/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) return true;
  const brand = f.data.subarray(4, 12).toString("latin1");
  return brand.startsWith("ftyp") && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand.slice(4));
}

const asJpegName = (name: string) => name.replace(/\.[^.]+$/, "") + ".jpg";

/**
 * Makes an upload something Claude can read and that fits its limits:
 * - HEIC/HEIF photos (which Chrome can't decode, so they arrive unresized) become JPEG, at most 2000 px;
 * - any other photo still over 4 MB is resized the same way.
 * Anything else, or a file that can't be decoded, is returned unchanged (the usual checks then apply).
 */
export async function normalizeUpload(f: Upload): Promise<Upload> {
  try {
    if (isHeic(f)) {
      const { width, height, data } = await decodeHeic({ buffer: f.data });
      const jpeg = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } })
        .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      return { name: asJpegName(f.name), type: "image/jpeg", data: jpeg };
    }
    if (/^image\/(jpeg|png|webp)$/.test(f.type) && f.data.length > RESIZE_ABOVE_BYTES) {
      const jpeg = await sharp(f.data).rotate().resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      return { name: asJpegName(f.name), type: "image/jpeg", data: jpeg };
    }
  } catch (err) {
    console.error(`[owlrnd files] could not convert ${f.name} (${f.type || "no type"})`, err);
  }
  return f;
}
