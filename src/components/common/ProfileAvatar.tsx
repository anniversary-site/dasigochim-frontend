import BrandMark from "./BrandMark";

interface ProfileAvatarProps {
  /** 정사각형 한 변 길이(px) */
  size?: number;
  className?: string;
}

/** 프로필 이미지 — 공통 브랜드 아이콘 */
export default function ProfileAvatar({ size = 60, className = "" }: ProfileAvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-sogang-50 ${className}`}
      style={{ width: size, height: size }}
    >
      <BrandMark size={size * 0.65} />
    </div>
  );
}
