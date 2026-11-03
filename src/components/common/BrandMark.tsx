import icon from "@/assets/icon.png";

/** Figma logo: preserve the source image and its original crop. */
export default function BrandMark({ className = "", size }: { className?: string; size?: number }) {
  return <span className={`brand-mark ${className}`} style={size ? { width: size, height: size } : undefined} aria-hidden="true"><img src={icon} alt="" /></span>;
}
