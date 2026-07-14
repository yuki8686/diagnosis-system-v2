export const DIAGNOSIS_DISPLAY_NAME = "本音キャラ診断";

export const DIAGNOSIS_DESCRIPTION =
  "質問への回答から、あなたの根本欲求とその表れ方を12の本音キャラとして読み解く診断です。";

export function diagnosisShareText(characterName?: string): string {
  return characterName
    ? `${DIAGNOSIS_DISPLAY_NAME}をやったら「${characterName}」でした。\nあなたの本音キャラも診断する。`
    : `${DIAGNOSIS_DESCRIPTION}\nカードを引く占いではなく、回答傾向をもとに判定します。`;
}
