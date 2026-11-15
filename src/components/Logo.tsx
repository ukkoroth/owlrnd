import Image from "next/image";

/**
 * The owlrnd logo from the logo kit (docs/brand/logo-kit.md): eight squares forming an "o" on a 4 × 4 grid,
 * plus the outlined wordmark. Files live in public/brand/.
 */
const RATIO = 183.19 / 44; // the logo's viewBox

const SOURCES = {
  onBlue: "/brand/owlrnd-logo-on-blue.svg",
  light: "/brand/owlrnd-logo.svg",
};

export function Logo({ height = 30, on = "onBlue" }: { height?: number; on?: keyof typeof SOURCES }) {
  return (
    <Image
      src={SOURCES[on]}
      alt="owlrnd"
      width={Math.round(height * RATIO)}
      height={height}
      unoptimized // SVG: served as is
      priority
      className="block"
    />
  );
}
