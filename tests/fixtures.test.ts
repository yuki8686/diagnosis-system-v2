import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { buildDiagnosisResult, scoreExpression, scoreGap } from "../src/scoring";
import type { AnswerRecord, QuestionDefinition } from "../src/types";

const at = (questionId: string, optionId: string, numericValue?: number): AnswerRecord => ({
  questionId,
  questionVersion: 1,
  optionId,
  numericValue,
  displayedPosition: 0,
  answeredAt: "2026-07-10T00:00:00.000Z",
  durationMs: 5000,
});

const find = (ids: string[]): QuestionDefinition[] => {
  const all = [
    ...questionBank.commonType,
    ...questionBank.defense,
    ...questionBank.genericExpression,
    ...questionBank.genericGap,
    ...Object.values(questionBank.byType).flatMap((s) => [...s.expression, ...s.gap, ...s.utilization]),
  ];
  return ids.map((id) => {
    const q = all.find((item) => item.id === id);
    if (!q) throw new Error(`Missing fixture question: ${id}`);
    return q;
  });
};

// Pattern A: win 7/connect 3/analyze 1/axis 1, outward, light amplification.
const commonA = ["A","A","A","A","A","A","A","B","B","B","C","D"].map((opt, i) => at(`C${String(i+1).padStart(2,"0")}`, opt));
const exprA = [at("DS1","5",5),at("DS2","2",2),at("DS3","4",4),at("DS-FIT","5",5)];
const gapAValues: Array<[string,number,number]> = [["Z1",3,4],["Z2",3,4],["Z3",3,3],["Z4",3,4],["Z5",3,5]];
const gapA = gapAValues.flatMap(([id,h,p]) => [at(`${id}-H`,String(h),h),at(`${id}-P`,String(p),p)]);
const defenseA = [at("D1","A"),at("D2","A"),at("D3","A"),at("D4","A"),at("D5","C"),at("D6","C"),at("D7","C")];
const utilA = [at("U-A1","5",5),at("U-A2","4",4),at("U-R1","2",2),at("U-O1","4",4),at("U-O2","5",5),at("U-R2","3",3)];
const idsA = [...commonA,...exprA,...gapA,...defenseA,...utilA].map((a) => a.questionId);
const resultA = buildDiagnosisResult({ questions: find(idsA), answers: [...commonA,...exprA,...gapA,...defenseA,...utilA], expressionIsGeneric: false, typeFitSignals: { fitItemLow:false,baseMarginSmall:false,secondFitSignalLow:false } });
assert.equal(resultA.resolution.kind, "resolved");
assert.equal(resultA.resolution.kind === "resolved" && resultA.resolution.primary, "win");
assert.equal(resultA.expression.pattern, "outward");
assert.equal(resultA.gap.pattern, "amplification");
assert.equal(resultA.gap.strength, "light");
assert.equal(resultA.confidence.type, "high");

// Pattern B: inward and suppression.
const exprB = [at("DS1","2",2),at("DS2","5",5),at("DS3","1",1),at("DS-FIT","5",5)];
const gapBValues: Array<[string,number,number]> = [["Z1",5,3],["Z2",5,3],["Z3",4,3],["Z4",5,3],["Z5",5,2]];
const gapB = gapBValues.flatMap(([id,h,p]) => [at(`${id}-H`,String(h),h),at(`${id}-P`,String(p),p)]);
assert.equal(scoreExpression(find(exprB.map((a)=>a.questionId)),exprB,false).pattern,"inward");
assert.equal(scoreGap(find(gapB.map((a)=>a.questionId)),gapB).pattern,"suppression");

// Pattern C: low confidence, generic adaptive expression, reversal gap.
const commonC = ["A","A","A","A","A","B","B","B","B","C","C","D"].map((opt, i) => at(`C${String(i+1).padStart(2,"0")}`, opt));
const genericExpr = [at("GE01","3",3),at("GE02","3",3),at("GE03","3",3),at("GE04","5",5)];
const genericGapValues: Array<[string,number,number]> = [["GZ1",2,4],["GZ2",4,2],["GZ3",3,4],["GZ4",4,2],["GZ5",3,3]];
const genericGap = genericGapValues.flatMap(([id,h,p]) => [at(`${id}-H`,String(h),h),at(`${id}-P`,String(p),p)]);
const lowUtil = [at("U-A1","3",3),at("U-R1","3",3),at("U-O1","3",3),at("T-U-A1","3",3),at("T-U-R1","3",3),at("T-U-O1","4",4)];
const idsC = [...commonC,...genericExpr,...genericGap,...defenseA,...lowUtil].map((a)=>a.questionId);
const resultC = buildDiagnosisResult({ questions: find(idsC), answers:[...commonC,...genericExpr,...genericGap,...defenseA,...lowUtil], comparisons:[{pair:["win","connect"],answers:["win","connect","win","connect"]}], expressionIsGeneric:true, typeFitSignals:{fitItemLow:false,baseMarginSmall:true,secondFitSignalLow:false} });
assert.equal(resultC.route,"low-confidence");
assert.equal(resultC.expression.pattern,"adaptive");
assert.equal(resultC.expression.switchScore,5);
assert.equal(resultC.gap.pattern,"reversal");
assert.equal(resultC.confidence.type,"low");

console.log("fixture A/B/C tests passed");
