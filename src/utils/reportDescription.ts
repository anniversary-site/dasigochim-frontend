/**
 * 개선 제안 사항 임시 분리
 *
 * 서버에 개선 제안을 담을 필드가 없어 ReportFlowPage가 description에
 * 이어붙여 저장한다. 상세 화면에서 두 항목으로 나눠 보여주기 위한 임시 처리다.
 *
 * 백엔드에 improvementSuggestion 필드가 생기면 이 파일과 사용처,
 * ReportFlowPage의 이어붙이기를 함께 제거한다.
 */
export const IMPROVEMENT_MARKER = "\n\n개선 제안 사항: ";

export interface SplitDescription {
  /** 안전·보건 유해/위험/시설/장소 내용 */
  hazard: string;
  /** 개선 제안 사항. 구분자가 없는 과거 신고는 null */
  improvement: string | null;
}

export function splitDescription(raw: string): SplitDescription {
  // 근본 요구 JSON 이면 원문만 꺼내 쓴다 (아래 parseComplaintMeta).
  const description = complaintText(raw);
  const at = description.indexOf(IMPROVEMENT_MARKER);
  if (at === -1) return { hazard: description, improvement: null };
  return {
    hazard: description.slice(0, at),
    improvement: description.slice(at + IMPROVEMENT_MARKER.length),
  };
}

/**
 * 근본 요구 분석 항목 — 팀 데이터(eseo_50_values.sql)는 description 에 아래 JSON 을 담는다.
 *   {"raw_text": 원문, "category": 공간 유형, "root_need": 근본 요구,
 *    "root_need_code": 근본 요구 코드, "surface_request": 표면 요청}
 * 화면에는 원문(raw_text)만 보여주고, 나머지는 관리자 챗봇 엑셀 내보내기에만 쓴다.
 */
export interface ComplaintMeta {
  rawText: string;
  category: string | null;
  rootNeed: string | null;
  rootNeedCode: string | null;
  surfaceRequest: string | null;
}

export function parseComplaintMeta(description: string | null | undefined): ComplaintMeta | null {
  const text = description?.trim();
  if (!text || !text.startsWith("{")) return null;
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (typeof data.raw_text !== "string") return null;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
    return {
      rawText: data.raw_text,
      category: str(data.category),
      rootNeed: str(data.root_need),
      rootNeedCode: str(data.root_need_code),
      surfaceRequest: str(data.surface_request),
    };
  } catch {
    return null;
  }
}

/** 화면에 보여줄 민원 내용 — JSON 이면 원문만, 아니면 그대로 */
export function complaintText(description: string | null | undefined): string {
  return parseComplaintMeta(description)?.rawText ?? description ?? "";
}
