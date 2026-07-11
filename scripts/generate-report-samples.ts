import { EXPRESSION_IDS, TYPE_IDS } from "../src/types";
import { generateFreeReport, generatePaidReport } from "../src/report";
import { makeReportInput, type ReportFixtureOptions } from "../tests/report-test-helpers";

function sample(id: string, options: ReportFixtureOptions) {
  const input = makeReportInput(options);
  const free = generateFreeReport(input);
  const paid = generatePaidReport(input, free);
  return { id, free, paid };
}

const samples = [
  ...TYPE_IDS.flatMap((type) => EXPRESSION_IDS.map((expression) => sample(`label-${type}-${expression}`, { type, expression }))),
  sample("low-confidence", { route: "low-confidence", expression: "adaptive", gapPattern: "reversal" }),
  sample("defense-tie", { defenseMode: "tie", confidences: { defense: "low" } }),
  sample("opportunity-limited", { defenseMode: "opportunity-limited", confidences: { defense: "low" } }),
  sample("confirmation", { expression: "adaptive", confirmation: true, confidences: { expression: "medium" } }),
  sample("confidence-low", { defenseMode: "low", confidences: { type: "low", expression: "low", gap: "low", defense: "low", utilization: "low" } }),
];

process.stdout.write(`${JSON.stringify({ generatedFor: "development-review", sampleCount: samples.length, samples }, null, 2)}\n`);
