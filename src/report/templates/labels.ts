import { EXPRESSION_LABELS, TYPE_LABELS, TYPE_PURPOSES } from "../../constants";
import type { ExpressionId, TypeId } from "../../types";

export interface TypeReportTemplate {
  headline: string;
  core: string;
  strength: string;
  friction: string;
  action: string;
  observation: string;
}

export const TYPE_REPORT_TEMPLATES: Record<TypeId, TypeReportTemplate> = {
  win: {
    headline: "停滞を動かし、結果へつなげる力を使う人",
    core: "立場や形勢を見ながら、結果を前へ動かせる状態を大切にします。",
    strength: "決めるべき場面で前進のきっかけを作りやすいことが強みです。",
    friction: "前進を急ぐ場面では、周囲の納得に必要な時間とのずれが生じる可能性があります。",
    action: "次に結論を急ぎたくなった場面で、決める前に懸念を一つだけ尋ねてください。",
    observation: "前進の速さと周囲の反応が両立したかを、一度だけ振り返ってください。",
  },
  connect: {
    headline: "人と人のあいだに温度を生み出す人",
    core: "関係の温度や反応を捉え、つながりが保たれる状態を大切にします。",
    strength: "場の反応を受け取り、関係を育てる働きかけが強みになり得ます。",
    friction: "関係を整える場面では、自分の希望を後回しにする可能性があります。",
    action: "次に場を整えようとしたとき、自分の希望を一文だけ添えてください。",
    observation: "関係を保ちながら、自分の希望も場に残せたかを観察してください。",
  },
  analyze: {
    headline: "曖昧さをほどき、理解できる形へ整える人",
    core: "情報や構造を確かめ、自分で理解できる状態と考える余白を大切にします。",
    strength: "複雑な内容から筋道を見つけ、理解可能な形にすることが強みです。",
    friction: "十分に理解してから進みたい場面では、着手までに時間を使う可能性があります。",
    action: "次に不明点が残った場面で、完成した質問ではなく現在の理解を一文で共有してください。",
    observation: "理解の途中を共有したことで、認識違いを早く見つけられたかを観察してください。",
  },
  axis: {
    headline: "意味と基準を言葉にし、望む形へ近づける人",
    core: "自分の基準と行動が食い違わず、意味のある形へ近づくことを大切にします。",
    strength: "見過ごされやすい基準を言葉にし、方向を整えることが強みです。",
    friction: "望む形が明確な場面では、現在の良さが相手へ伝わりにくい可能性があります。",
    action: "次に改善を提案するとき、残したい良さを一つ伝えてから提案してください。",
    observation: "基準を下げずに、相手が提案へ参加しやすくなったかを観察してください。",
  },
};

export const EXPRESSION_COPY: Record<ExpressionId, string> = {
  outward: "大切にしたいことを言葉や行動として外へ出しやすい回答パターンです。",
  inward: "大切にしたいことを内側で保ち、表へ出す前に慎重になりやすい回答パターンです。",
  adaptive: "場面に合わせた出し方が確認されたときに用いる回答パターンです。",
};

export function resolvedLabel(type: TypeId, expression: ExpressionId): string {
  return `${TYPE_LABELS[type]}・${EXPRESSION_LABELS[expression]}`;
}

export function resolvedSubtitle(type: TypeId): string {
  return `${TYPE_PURPOSES[type]}ことを大切にする傾向`;
}
