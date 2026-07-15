import { useEffect, useState } from "react";

export function legalEffectiveDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return undefined;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

export function LegalDocumentDate() {
  const [effectiveDate, setEffectiveDate] = useState<string>();
  useEffect(() => {
    let active = true;
    void fetch("/api/legal", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : undefined)
      .then((value: unknown) => {
        if (!active || !value || typeof value !== "object") return;
        setEffectiveDate(legalEffectiveDate((value as { effectiveDate?: unknown }).effectiveDate));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return effectiveDate ? <p className="legal-effective-date">制定日：{effectiveDate}</p> : null;
}
