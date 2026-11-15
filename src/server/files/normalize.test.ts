import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { isHeic, normalizeUpload } from "./normalize";

const heic = readFileSync("tests/fixtures-files/sample-page.heic"); // 928 x 1100, made with macOS sips

describe("uploads Claude can read", () => {
  it("turns an iPhone HEIC photo into a JPEG of the same picture", async () => {
    const out = await normalizeUpload({ name: "IMG_0684.HEIC", type: "image/heic", data: heic });
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("IMG_0684.jpg");
    const meta = await sharp(out.data).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 928, 1100]);
  });

  it("recognises HEIC even when the browser sends no type and an odd name", async () => {
    expect(isHeic({ name: "photo", type: "", data: heic })).toBe(true);
    const out = await normalizeUpload({ name: "photo", type: "", data: heic });
    expect(out.type).toBe("image/jpeg");
  });

  it("shrinks a large photo the browser didn't resize to at most 2000 px", async () => {
    const big = await sharp({ create: { width: 4032, height: 3024, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 60 } } }).png().toBuffer();
    expect(big.length).toBeGreaterThan(4 * 1024 * 1024);
    const out = await normalizeUpload({ name: "scan.png", type: "image/png", data: big });
    const meta = await sharp(out.data).metadata();
    expect([out.type, Math.max(meta.width!, meta.height!)]).toEqual(["image/jpeg", 2000]);
  });

  it("leaves small photos, PDFs and undecodable files alone", async () => {
    const small = { name: "page.jpg", type: "image/jpeg", data: Buffer.from("small jpeg bytes") };
    expect(await normalizeUpload(small)).toBe(small);
    const pdf = { name: "syllabus.pdf", type: "application/pdf", data: Buffer.from("%PDF-1.4") };
    expect(await normalizeUpload(pdf)).toBe(pdf);
    const broken = { name: "broken.heic", type: "image/heic", data: Buffer.from("not really a heic") };
    expect(await normalizeUpload(broken)).toBe(broken);
  });
});
