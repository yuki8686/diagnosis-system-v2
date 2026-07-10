import type { Confidence, ConfirmationStatus, DefenseCategory, GapDirection, GapPattern, GapStrength, UtilizationResult } from "../../types";
import { DEFENSE_LABELS } from "../../constants";

export const GAP_PATTERN_TEXT: Record<GapPattern, string> = {
  small: "本音と対人場面の出し方が比較的近い状態",
  suppression: "本音より対人場面で控えめに出す傾向",
  amplification: "本音より対人場面で強めに出す傾向",
  reversal: "場面によって強く出す方向と控える方向が入れ替わる傾向",
  unclear: "回答場面ごとに方向が分かれ、現時点では一方向にまとめにくい状態",
};

export const GAP_DIRECTION_TEXT: Record<GapDirection, string> = {
  none: "本音と対人場面が近い方向",
  negative: "対人場面で控える方向",
  positive: "対人場面で強める方向",
  mixed: "場面によって方向が入れ替わる状態",
  unclear: "一方向には定めにくい状態",
};

export const GAP_STRENGTH_TEXT: Record<NonNullable<GapStrength>, string> = {
  light: "小さな差",
  medium: "はっきり分かる差",
  strong: "大きく表れた差",
};

export const CONFIRMATION_STATUS_TEXT: Record<ConfirmationStatus, string> = {
  not_needed: "基本回答だけで方向を確認できました",
  pending: "追加の確認回答を待っている状態です",
  resolved: "追加の確認回答を反映して方向を整理しました",
  unresolved: "追加確認後も場面による幅が残りました",
  skipped: "質問数の範囲内で追加確認を行わず、限定的な表現にしています",
};

export const CONFIDENCE_TEXT: Record<Confidence, string> = {
  high: "回答が比較的一貫しています",
  medium: "今回の回答では一定の傾向が見られました",
  low: "今回確認できた範囲に限った見立てです",
};

export const DEFENSE_TEXT: Record<DefenseCategory, string> = DEFENSE_LABELS;

export const OPPORTUNITY_TEXT = {
  limited: "回答できる場面が限られた反応",
  sufficient: "複数の場面で確認できる反応",
} as const;

export const UTILIZATION_BAND_TEXT: Record<UtilizationResult["awarenessBand"], string> = {
  high: "動いた瞬間を比較的捉えられている",
  middle: "振り返ると気づける場面がある",
  growth: "動いている最中にはまだ捉えにくい",
};

export const UTILIZATION_USE_BAND_TEXT: Record<UtilizationResult["utilizationBand"], string> = {
  high: "選び直す行動へつなげやすい",
  middle: "場面によって行動へつなげられる",
  growth: "気づいても行動へ移すまでに間が生まれやすい",
};

export function utilizationGapText(gap: number): string {
  if (Math.abs(gap) < 0.5) return "気づきと活用の間は比較的近い状態です";
  if (gap > 1) return "気づけていても、実際の選び直しへ移すところに大きめの間があります";
  if (gap > 0) return "気づきから実際の選び直しへ移るまでに、少し間が生まれています";
  return "行動できたあとで、自分の欲求に気づく場面があるようです";
}

export function breadthText(breadth: number): string {
  if (breadth >= 4) return "幅広い場面で見られます";
  if (breadth >= 2) return "複数の場面で見られます";
  if (breadth === 1) return "一部の場面で見られます";
  return "大きな広がりは見られません";
}

export function confidenceSentence(confidence: Confidence, direct: string, moderate: string, soft: string): string {
  return confidence === "high" ? direct : confidence === "medium" ? moderate : soft;
}

export function gapStrengthText(strength: GapStrength): string {
  return strength ? GAP_STRENGTH_TEXT[strength] : "方向ごとの強さを一つには定めていません";
}
