import { Heart } from "lucide-react";
import ShareIcon from "@/components/common/ShareIcon";
import { splitDescription } from "@/utils/reportDescription";
import DepartmentChip from "@/components/common/DepartmentChip";
import MyBadge from "@/components/common/MyBadge";
import ReportStatusBadge from "@/components/common/ReportStatusBadge";
import { resolveApiAssetUrl } from "@/api/http";
import type { ReportSpace, ReportStatus } from "@/types";
import SceneViewer from "@/components/scene/SceneViewer";

export interface ReportDetailData {
  title: string;
  description: string;
  departmentName: string;
  status: ReportStatus;
  date: string;
  imageUrl?: string;
  /** 3D 장면과 핀. 위치를 3D 로 찍은 신고만 있다 */
  space?: ReportSpace | null;
}

interface ReportDetailViewProps {
  report: ReportDetailData;
  /** 내 신고 목록처럼 전부 본인 신고인 화면에서는 숨긴다 */
  showMyBadge?: boolean;
}

/** 신고 상세 (Figma 155:1413) — 메인 화면의 내 신고·다른 신고에서 공용 */
export default function ReportDetailView({ report, showMyBadge = false }: ReportDetailViewProps) {
  const { hazard, improvement } = splitDescription(report.description);

  return (
    <>
      {/* 사진 */}
      <div className="px-1.5 pt-1.5">
        <div className="w-full aspect-square bg-neutral-50 rounded-[10px] overflow-hidden">
          {report.imageUrl && (
            <img src={resolveApiAssetUrl(report.imageUrl)} alt="신고 사진" className="w-full h-full object-cover" />
          )}
        </div>
      </div>

      {/* 정보 */}
      <div className="px-4 pt-5 pb-12 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DepartmentChip label={report.departmentName} />
            {showMyBadge && <MyBadge />}
            <ReportStatusBadge status={report.status} />
          </div>
          <div className="flex items-center gap-2.5">
            <button className="size-10 rounded-full bg-sogang-10 flex items-center justify-center transition active:scale-95">
              <ShareIcon className="size-5 text-sogang-500" />
            </button>
            <button className="size-10 rounded-full bg-sogang-10 flex items-center justify-center transition active:scale-95">
              <Heart className="w-5 h-5 text-sogang-500" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-[17px] font-bold text-[#1d1d1f] tracking-[-0.425px] leading-[1.4]">
            {report.title}
          </h3>
          <span className="text-[11px] font-medium text-neutral-500 tracking-[-0.275px] whitespace-nowrap shrink-0">
            {report.date}
          </span>
        </div>

        <div className="flex flex-col gap-5 mt-1">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-neutral-400 tracking-[-0.28px]">신고 위치</span>
            <span className="text-sm font-medium text-neutral-800 tracking-[-0.28px] leading-[1.4]">{report.title}</span>
            {report.space?.sceneId && report.space.pin && (
              <SceneViewer
                sceneId={report.space.sceneId}
                mode="view"
                pin={report.space.pin}
                className="mt-1 h-[240px] w-full border border-gray-200"
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-neutral-400 tracking-[-0.28px]">
              안전·보건 유해/위험/시설/장소 내용
            </span>
            <span className="text-sm font-medium text-neutral-800 tracking-[-0.28px] leading-[1.4]">
              {hazard}
            </span>
          </div>
          {improvement && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-neutral-400 tracking-[-0.28px]">개선 제안 사항</span>
              <span className="text-sm font-medium text-neutral-800 tracking-[-0.28px] leading-[1.4]">
                {improvement}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
