export const lockedReportOffer = {
  eyebrow: "DEEP REPORT",
  title: "あなたの内側を、もう一段深く読み解く",
  body: "詳しいレポートでは、欲望の満たし方、ズレが起きる場面、防衛反応、人間関係での誤解、仕事で力を発揮しやすい環境まで、あなた専用の形で整理します。",
} as const;

export function lockedReportModalContent(topic: string) {
  return {
    eyebrow: "DEEP REPORT",
    title: `「${topic}」は詳しい診断レポートで確認できます。`,
    body: "無料結果では概要までをお伝えしています。詳しいレポートでは、起きやすい場面、その背景、反応から戻るためのヒントまで整理します。",
    close: "無料結果に戻る",
    showOffer: "詳しいレポートを見る",
  } as const;
}
