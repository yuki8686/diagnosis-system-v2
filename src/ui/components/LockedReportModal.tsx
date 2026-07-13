import { useEffect, useRef } from "react";
import { lockedReportModalContent } from "../locked-report";

interface LockedReportModalProps {
  topic: string;
  onClose: () => void;
  onShowOffer: () => void;
}

export function LockedReportModal({ topic, onClose, onShowOffer }: LockedReportModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const copy = lockedReportModalContent(topic);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="locked-report-title">
      <p className="confirm-banner">{copy.eyebrow}</p>
      <h1 id="locked-report-title">{copy.title}</h1>
      <p>{copy.body}</p>
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{copy.close}</button><button type="button" className="primary" onClick={onShowOffer}>{copy.showOffer}</button></div>
    </section>
  </div>;
}
