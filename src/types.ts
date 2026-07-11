export const TYPE_IDS = ["win", "connect", "analyze", "axis"] as const;
export type TypeId = (typeof TYPE_IDS)[number];

export const EXPRESSION_IDS = ["outward", "inward", "adaptive"] as const;
export type ExpressionId = (typeof EXPRESSION_IDS)[number];

export type Confidence = "high" | "medium" | "low";
export type EvidenceLevel = "direct" | "derived" | "inferred" | "possibility";
export type WordingStrength = "direct" | "moderate" | "soft";
export type ScenarioScope = "general" | "work" | "romance" | "friendship" | "family" | "relationship";

export type QuestionBlock =
  | "common-type"
  | "type-comparison"
  | "expression"
  | "generic-expression"
  | "defense"
  | "gap-inner"
  | "gap-public"
  | "generic-gap-inner"
  | "generic-gap-public"
  | "utilization"
  | "confirmation";

export type QuestionFormat = "single-choice" | "likert-5";
export type QuestionId = string;

export interface ChoiceOption {
  id: string;
  label: string;
  typeId?: TypeId;
  defenseCategory?: DefenseCategory;
  score?: number;
}

export interface QuestionDefinition {
  id: string;
  version: number;
  block: QuestionBlock;
  format: QuestionFormat;
  prompt: string;
  options: ChoiceOption[];
  targetType?: TypeId;
  pairId?: string;
  polarity?: "positive" | "negative" | "fit" | "reverse" | "switch";
  metric?: "type" | "expression" | "gap" | "defense" | "awareness" | "utilization" | "fit";
  fitSignalRole?: "primary" | "secondary" | "block";
  isConfirmation?: boolean;
  isGeneric?: boolean;
  evidenceLevel: "direct";
}

export interface AnswerRecord {
  questionId: string;
  questionVersion: number;
  optionId: string;
  numericValue?: number;
  displayedPosition?: number;
  answeredAt: string;
  durationMs?: number;
}

export interface TypeScores {
  win: number;
  connect: number;
  analyze: number;
  axis: number;
}

export type ComparisonPhase = "initial" | "additional" | "completed";

export interface ComparisonInput {
  expectedPair: [TypeId, TypeId];
  initialQuestionIds: [QuestionId, QuestionId];
  additionalQuestionIds: [QuestionId, QuestionId];
  answers: AnswerRecord[];
  phase: ComparisonPhase;
}

export interface ComparisonRawAnswer {
  questionId: string;
  selectedType: TypeId;
}

interface ComparisonResolutionBase {
  pair: [TypeId, TypeId];
  initialQuestionIds: [QuestionId, QuestionId];
  additionalQuestionIds: [QuestionId, QuestionId];
  counts: TypeScores;
  rawAnswers: ComparisonRawAnswer[];
  nextQuestionIds: string[];
}

export type ComparisonResolution =
  | (ComparisonResolutionBase & { status: "resolved"; phase: "completed"; winner: TypeId })
  | (ComparisonResolutionBase & { status: "needs_more"; phase: "initial" | "additional" })
  | (ComparisonResolutionBase & { status: "low_confidence"; phase: "completed" });

export type TypeResolution =
  | { kind: "resolved"; primary: TypeId; secondary?: TypeId; source: "base" | "comparison" }
  | { kind: "low-confidence"; candidates: [TypeId, TypeId] | [TypeId, TypeId, TypeId] };

export interface ExpressionResult {
  pattern: ExpressionId;
  rawScore: number;
  switchScore?: number;
  confidence: Confidence;
  requiresConfirmation: boolean;
  confirmationStatus: ConfirmationStatus;
  usedQuestionIds: string[];
  isGeneric: boolean;
}

export type GapPattern = "small" | "suppression" | "amplification" | "reversal" | "unclear";
export type GapStrength = "light" | "medium" | "strong" | null;
export type GapDirection = "none" | "negative" | "positive" | "mixed" | "unclear";
export type ConfirmationStatus = "not_needed" | "pending" | "resolved" | "unresolved" | "skipped";

export interface GapPairResult {
  pairId: string;
  inner: number;
  public: number;
  diff: number;
  innerQuestionId: string;
  publicQuestionId: string;
}

export interface GapResult {
  pattern: GapPattern;
  direction: GapDirection;
  magnitude: number;
  directionConsistency: number | null;
  breadth: number;
  strength: GapStrength;
  pairs: GapPairResult[];
  maxGapPair?: GapPairResult;
  confidence: Confidence;
  confirmationStatus: ConfirmationStatus;
  usedQuestionIds: string[];
}

export const DEFENSE_CATEGORIES = [
  "counterattack",
  "prove",
  "distance",
  "self-efface",
  "analyze",
  "self-blame",
  "numb",
  "freeze",
] as const;
export type DefenseCategory = (typeof DEFENSE_CATEGORIES)[number];

export interface DefenseResult {
  counts: Record<DefenseCategory, number>;
  primary?: DefenseCategory;
  secondary?: DefenseCategory;
  tied: DefenseCategory[];
  primaryTied: DefenseCategory[];
  secondaryTied: DefenseCategory[];
  confidence: Confidence;
  opportunities: Record<DefenseCategory, number>;
  selectionRates: Record<DefenseCategory, number>;
  opportunityLimited: DefenseCategory[];
  observedReactions: Array<{ questionId: string; category: DefenseCategory }>;
  usedQuestionIds: string[];
}

export interface UtilizationResult {
  awareness: number;
  utilization: number;
  awarenessBand: "high" | "middle" | "growth";
  utilizationBand: "high" | "middle" | "growth";
  gap: number;
  confidence: Confidence;
  requiresConfirmation: boolean;
  contradictionMetrics: Array<"awareness" | "utilization">;
  confirmationStatus: ConfirmationStatus;
  usedQuestionIds: string[];
}

export interface ReliabilityFlags {
  fastResponse: boolean;
  positionStreak: boolean;
  semanticMonotony: boolean;
  likertSameValueStreak: boolean;
  reverseContradiction: boolean;
  similarQuestionMismatch: boolean;
  issues: ReliabilityIssue[];
}

export type DiagnosisBlock = "type" | "expression" | "gap" | "defense" | "utilization";
export type ReliabilityFlag = "fastResponse" | "positionStreak" | "semanticMonotony" | "likertSameValueStreak" | "reverseContradiction" | "similarQuestionMismatch";

export interface ReliabilityIssue {
  flag: ReliabilityFlag;
  affectedBlocks: DiagnosisBlock[];
  severity: "info" | "warning" | "major";
  sourceQuestionIds: string[];
}

export interface ReliabilityAssessment {
  mainSignalCount: number;
  overallWeakening: boolean;
  blockContradictions: Array<"reverseContradiction" | "similarQuestionMismatch">;
  weakenedBlocks: DiagnosisBlock[];
}

export interface TypeFitSignals {
  fitItemLow: boolean;
  baseMarginSmall: boolean;
  secondFitSignalLow: boolean;
  blockInconsistency?: boolean;
  feedbackMismatch?: boolean;
}

export interface TypeFitResult {
  incompatible: boolean;
  signals: TypeFitSignals;
}

export interface BlockConfidences {
  type: Confidence;
  expression: Confidence;
  gap: Confidence;
  defense: Confidence;
  utilization: Confidence;
}

export interface ResultMetadata {
  questionBankVersion: string;
  scoringVersion: string;
  engineVersion: string;
  reportTemplateVersion: string;
}

export type ConfirmationKind = "expression" | "utilization" | "gap";
export type DiagnosisStep = "common-type" | "comparison" | "expression" | "defense" | "gap" | "utilization" | "confirmation" | "complete";
export type DiagnosisRouteKind = "pending-comparison" | "resolved" | "low-confidence";
export type ConfirmationActivationReason = "expression_mid_band" | "utilization_contradiction" | "gap_direction_unclear";
export type ConfirmationSkipReason = "not_applicable" | "no_contradiction" | "budget_exceeded" | "already_activated" | "route_disallowed";

export interface RouteTransition {
  from: DiagnosisRouteKind | "uninitialized";
  to: DiagnosisRouteKind;
  reason: string;
  sequence: number;
  triggeringQuestionIds: string[];
}

export interface DiagnosisRoute {
  sessionId: string;
  sessionSeed: string;
  questionBankVersion: string;
  scoringVersion: string;
  engineVersion: string;
  reportTemplateVersion: string;
  route: DiagnosisRouteKind;
  routeLocked: boolean;
  routeLockedAt?: number;
  typeResolution: TypeResolution;
  comparisonPhase?: ComparisonPhase;
  expectedComparisonPair?: [TypeId, TypeId];
  currentStep: DiagnosisStep;
  questionIds: string[];
  askedQuestionIds: string[];
  answeredQuestionIds: string[];
  nextQuestionId?: string;
  provisionalType: TypeId;
  comparison?: ComparisonResolution;
  activatedConfirmations: ConfirmationKind[];
  confirmationActivationReasons: Partial<Record<ConfirmationKind, ConfirmationActivationReason>>;
  skippedConfirmations: ConfirmationKind[];
  confirmationSkipReasons: Partial<Record<ConfirmationKind, ConfirmationSkipReason>>;
  confirmationConfidenceHints: Partial<Record<ConfirmationKind, "low">>;
  operationalLimit: 47;
  hardLimit: 48;
  basePlannedCount: number;
  structuralComparisonCount: number;
  consumedConditionalCount: number;
  remainingOperationalBudget: number;
  remainingConditionalBudget: number;
  remainingAdditionalBudget: number;
  limits: { operationalMaximum: 47; hardMaximum: 48 };
  transitionHistory: RouteTransition[];
}

export interface DiagnosisResult {
  engineVersion: string;
  scoringVersion: string;
  questionBankVersion: string;
  reportTemplateVersion: string;
  metadata: ResultMetadata;
  resolution: TypeResolution;
  baseTypeScores: TypeScores;
  comparison?: ComparisonResolution;
  expression: ExpressionResult;
  gap: GapResult;
  defense: DefenseResult;
  utilization: UtilizationResult;
  typeFit: TypeFitResult;
  reliability: ReliabilityFlags;
  confidence: BlockConfidences;
  route: "resolved" | "low-confidence";
  answeredQuestionIds: string[];
}

export interface InsightEvidence {
  evidenceLevel: EvidenceLevel;
  sourceQuestionIds: string[];
  sourceScores: string[];
  confidence: Confidence;
  scenarioScope: ScenarioScope;
  wordingStrength: WordingStrength;
}

export interface ReportFragment {
  id: string;
  section:
    | "opening"
    | "label"
    | "core"
    | "expression"
    | "impression"
    | "misunderstanding"
    | "gap"
    | "defense"
    | "awareness"
    | "utilization"
    | "strength"
    | "risk"
    | "action"
    | "module-cta";
  text: string;
  evidence: InsightEvidence;
}

export type ReportKind = "free" | "paid";
export type ReportRoute = "resolved" | "low_confidence";
export type ReportSectionId =
  | "headline"
  | "core_desire"
  | "expression"
  | "gap"
  | "defense"
  | "utilization"
  | "strengths"
  | "friction"
  | "relationships"
  | "work"
  | "action"
  | "observation"
  | "disclaimer";

export type ReportScenarioScope = "general" | "specific_answer" | "work_possibility" | "relationship_possibility";

export interface AnswerReference {
  questionId: string;
  questionVersion: number;
  prompt: string;
  selectedOptionId: string;
  selectedOptionText: string;
  numericValue?: number;
  metric?: string;
  scenario?: string;
}

export interface PersonalizationAnchor {
  id: string;
  kind: "answer" | "gap_pair" | "defense" | "observed_reaction" | "utilization" | "comparison" | "confirmation";
  sourceQuestionIds: string[];
  summary: string;
  confidence: Confidence;
  opportunityLimited?: boolean;
  defenseCategory?: DefenseCategory;
}

export interface ReportEvidence {
  block: DiagnosisBlock;
  evidenceLevel: EvidenceLevel;
  sourceQuestionIds: string[];
  sourceScores?: Record<string, number | string | boolean>;
  confidence: Confidence;
  wordingStrength: WordingStrength;
  scenarioScope: ReportScenarioScope;
}

export interface ReportParagraph {
  id: string;
  text: string;
  evidence: ReportEvidence;
  anchorIds: string[];
  layer: ReportLayer;
  claimKind?: DefenseClaimKind;
  claimCategory?: DefenseCategory;
}

export type ReportLayer = "type" | "expression" | "gap" | "defense_utilization" | "personalization";
export type DefenseClaimKind = "primary_defense" | "observed_reaction" | "defense_tie" | "scenario_limited";

export interface ReportSection {
  id: ReportSectionId;
  title: string;
  paragraphs: ReportParagraph[];
}

export interface ReportMetadata {
  sessionId: string;
  generatedAt?: string;
  questionBankVersion: string;
  scoringVersion: string;
  engineVersion: string;
  reportTemplateVersion: string;
  typeConfidence: Confidence;
  expressionConfidence: Confidence;
  gapConfidence: Confidence;
  defenseConfidence: Confidence;
  utilizationConfidence: Confidence;
  effectiveWording: Record<DiagnosisBlock, WordingStrength>;
  reliabilityDowngradedBlocks: DiagnosisBlock[];
}

export interface ActionProposal {
  id: string;
  text: string;
  targetSignal: string;
  sourceQuestionIds: string[];
  expectedObservation: string;
}

interface ReportBase {
  route: ReportRoute;
  label: string;
  subtitle: string;
  anchors: PersonalizationAnchor[];
  sections: ReportSection[];
  metadata: ReportMetadata;
}

export interface FreeReport extends ReportBase {
  kind: "free";
  summary: string;
}

export type PaidReportQualityCode =
  | "missing_version"
  | "missing_section"
  | "missing_evidence"
  | "insufficient_answer_references"
  | "missing_max_gap"
  | "defense_overclaim"
  | "opportunity_limited_overclaim"
  | "low_confidence_overclaim"
  | "wording_mismatch"
  | "prohibited_expression"
  | "excessive_free_overlap"
  | "missing_action"
  | "missing_action_evidence"
  | "scenario_scope_mismatch"
  | "internal_value_leak";

export interface PaidReportQualityIssue {
  code: PaidReportQualityCode;
  message: string;
  sectionId?: ReportSectionId;
  paragraphId?: string;
}

export type PaidReportQualityResult =
  | { passed: true; issues: [] }
  | { passed: false; issues: PaidReportQualityIssue[] };

export interface PaidReport extends ReportBase {
  kind: "paid";
  answerReferences: AnswerReference[];
  actionProposals: ActionProposal[];
  qualityGate: PaidReportQualityResult;
  defenseContext: {
    primary?: DefenseCategory;
    primaryTied: DefenseCategory[];
    confidence: Confidence;
    opportunityLimited: DefenseCategory[];
  };
}

export interface ReportInput {
  result: DiagnosisResult;
  route: DiagnosisRoute;
  answers: AnswerRecord[];
  questions: QuestionDefinition[];
  freeAnchorLimit?: 0 | 1 | 2;
}

export type ProhibitedCategory = "inner_truth" | "causal_history" | "medical" | "deterministic_future" | "relationship_mindreading" | "type_superiority";

export interface ProhibitedFinding {
  category: ProhibitedCategory;
  matchedText: string;
  pattern: string;
}
