import { buildDiagnosisResult } from "../../src/scoring";
import { generatePaidReport } from "../../src/report/generate";
import { activeSessionAnswers, type DiagnosisSession } from "../../src/ui/session";
import { finishDiagnosis, questionsForIds } from "../../src/ui/engine";

export function paidReportForStoredSession(session: DiagnosisSession) {
  const finished = finishDiagnosis(session);
  if (!finished.freeReport || !finished.route) throw new Error("Diagnosis is incomplete");
  const answers = activeSessionAnswers(finished);
  const questions = questionsForIds(finished.route.questionIds);
  const result = buildDiagnosisResult({ questions, answers, routingState: finished.route, expressionIsGeneric: finished.route.route === "low-confidence" });
  return generatePaidReport({ result, route: finished.route, answers, questions }, finished.freeReport);
}

export function paidReportView(report: ReturnType<typeof paidReportForStoredSession>) {
  return { label: report.label, subtitle: report.subtitle, sections: report.sections.map((section) => ({ title: section.title, paragraphs: section.paragraphs.map((paragraph) => paragraph.text) })) };
}
