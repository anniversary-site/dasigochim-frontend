import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildingApi, meApi } from "@/api";
import { useAuth } from "@/auth";
import type { Building, Region } from "@/types";

interface LocationState {
  from?: string;
}

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, isAuthLoading, user, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [housings, setHousings] = useState<Building[]>([]);
  const [buildingId, setBuildingId] = useState<number | "">("");
  const [dong, setDong] = useState("");
  const [ho, setHo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      navigate("/login", { replace: true, state: { from: "/profile" } });
    }
  }, [isAuthLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
    setBuildingId(user.building?.id ?? "");
    setDong(user.dong ?? "");
    setHo(user.ho ?? "");
  }, [user]);

  // 지역 목록과, 이미 등록한 거주지가 있으면 그 지역을 미리 고른다.
  const residenceId = user?.building?.id;
  useEffect(() => {
    let cancelled = false;
    Promise.all([buildingApi.regions(), residenceId ? buildingApi.get(residenceId) : Promise.resolve(null)])
      .then(([items, residence]) => {
        if (cancelled) return;
        setRegions(items);
        if (residence?.sido) setSido(residence.sido);
        if (residence?.sigungu) setSigungu(residence.sigungu);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "지역 목록을 불러오지 못했습니다.");
      });
    return () => { cancelled = true; };
  }, [residenceId]);

  useEffect(() => {
    if (!sido || !sigungu) return;
    let cancelled = false;
    buildingApi.list(sido, sigungu)
      .then((items) => { if (!cancelled) setHousings(items); })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "청년주택 목록을 불러오지 못했습니다.");
      });
    return () => { cancelled = true; };
  }, [sido, sigungu]);

  const sigungus = regions.find((region) => region.sido === sido)?.sigungus ?? [];
  const visibleHousings = sido && sigungu ? housings : [];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (buildingId === "") return;
      await meApi.updateProfile({ name, phone, buildingId, dong: dong.trim() || undefined, ho: ho.trim() });
      await refreshProfile();
      const from = (location.state as LocationState | null)?.from;
      navigate(from ?? "/home", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="app-shell min-h-svh bg-gray-10 px-5 pb-8 pt-3">
      <button
        type="button"
        aria-label="뒤로"
        onClick={() => navigate("/home")}
        className="flex size-10 items-center justify-center rounded-full transition active:bg-neutral-100"
      >
        <ChevronLeft className="size-6 text-neutral-800" />
      </button>

      <section className="mx-auto mt-10 max-w-sm">
        <h1 className="text-2xl font-bold tracking-[-0.6px] text-neutral-800">프로필 정보를 입력해 주세요</h1>
        <p className="mt-3 text-sm leading-6 tracking-[-0.3px] text-neutral-600">
          신고 확인과 안내에 쓰고, 같은 청년주택 입주민의 신고를 볼 때 사용합니다.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-5">
          <Field label="이름" value={name} onChange={setName} autoComplete="name" />
          <Field label="연락처" value={phone} onChange={setPhone} inputMode="tel" autoComplete="tel" placeholder="예: 010-1234-5678" />
          <div className="block">
            <span className="mb-2 block text-sm font-semibold text-neutral-800">거주 지역</span>
            <div className="flex gap-3">
              <select
                aria-label="시·도"
                value={sido}
                onChange={(event) => { setSido(event.target.value); setSigungu(""); setBuildingId(""); }}
                className="select-chevron h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-neutral-800 outline-none transition focus:border-sogang-500"
              >
                <option value="">시·도</option>
                {regions.map((region) => (
                  <option key={region.sido} value={region.sido}>{region.sido}</option>
                ))}
              </select>
              <select
                aria-label="시·군·구"
                value={sigungu}
                disabled={!sido}
                onChange={(event) => { setSigungu(event.target.value); setBuildingId(""); }}
                className="select-chevron h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-neutral-800 outline-none transition focus:border-sogang-500"
              >
                <option value="">시·군·구</option>
                {sigungus.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-neutral-800">거주 청년주택</span>
            <select
              required
              value={buildingId}
              onChange={(event) => setBuildingId(event.target.value ? Number(event.target.value) : "")}
              className="select-chevron h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-neutral-800 outline-none transition focus:border-sogang-500"
            >
              <option value="">
                {!sido || !sigungu ? "지역을 먼저 골라 주세요" : visibleHousings.length ? "청년주택을 선택해 주세요" : "이 지역에는 등록된 청년주택이 없어요"}
              </option>
              {visibleHousings.map((housing) => (
                <option key={housing.id} value={housing.id}>{housing.name}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-3">
            <div className="w-[38%]">
              <Field label="동 (선택)" value={dong} onChange={setDong} inputMode="numeric" placeholder="없으면 비워 두기" required={false} />
            </div>
            <div className="flex-1">
              <Field label="호수" value={ho} onChange={setHo} inputMode="numeric" placeholder="예: 1203" />
            </div>
          </div>
          {error && <p className="text-sm text-sogang-500">{error}</p>}
          <button
            type="submit"
            disabled={saving || !name.trim() || !phone.trim() || buildingId === "" || !ho.trim()}
            className="mt-4 h-12 w-full rounded-xl bg-sogang-500 text-sm font-semibold text-white transition disabled:bg-neutral-300 active:brightness-95"
          >
            {saving ? "저장 중..." : "저장하고 시작하기"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, required = true, ...inputProps }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "required">) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-neutral-800">{label}</span>
      <input
        {...inputProps}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-sogang-500"
      />
    </label>
  );
}
