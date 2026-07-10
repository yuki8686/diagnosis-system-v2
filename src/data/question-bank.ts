import type { ChoiceOption, DefenseCategory, QuestionDefinition, TypeId } from "../types";
import type { QuestionBankSections } from "./question-bank-contract";

const LIKERT_OPTIONS: ChoiceOption[] = [1,2,3,4,5].map((value) => ({ id: String(value), label: String(value), score: value }));
const likert = (args: Omit<QuestionDefinition, "version" | "format" | "options" | "evidenceLevel">): QuestionDefinition => ({ ...args, version: 1, format: "likert-5", options: LIKERT_OPTIONS, evidenceLevel: "direct" });
const choice = (args: Omit<QuestionDefinition, "version" | "format" | "evidenceLevel">): QuestionDefinition => ({ ...args, version: 1, format: "single-choice", evidenceLevel: "direct" });

export const commonTypeQuestions: QuestionDefinition[] = [
  choice({ id: "C01", block: "common-type", prompt: `何かを頑張るとき、一番のエネルギー源になるのは?`, metric: "type", options: [{ id: "A", label: `勝負に勝つこと、結果で示すこと`, typeId: "win" as TypeId },{ id: "B", label: `周りが喜んで盛り上がること`, typeId: "connect" as TypeId },{ id: "C", label: `分からなかったことが分かる瞬間`, typeId: "analyze" as TypeId },{ id: "D", label: `理想の形に近づいていく実感`, typeId: "axis" as TypeId }] }),
  choice({ id: "C02", block: "common-type", prompt: `丸一日自由に使えるなら?`, metric: "type", options: [{ id: "A", label: `腕試しになることに時間を使う`, typeId: "win" as TypeId },{ id: "B", label: `気の合う人と集まって楽しむ`, typeId: "connect" as TypeId },{ id: "C", label: `一人で興味のあることを掘り下げる`, typeId: "analyze" as TypeId },{ id: "D", label: `自分が積み上げているものに向き合う`, typeId: "axis" as TypeId }] }),
  choice({ id: "C03", block: "common-type", prompt: `グループの空気が悪くなったとき、真っ先に頭に浮かぶのは?`, metric: "type", options: [{ id: "A", label: `この流れをどう立て直すか、次の段取り`, typeId: "win" as TypeId },{ id: "B", label: `みんなが気まずくならない一言`, typeId: "connect" as TypeId },{ id: "C", label: `なぜこうなったのか、原因の整理`, typeId: "analyze" as TypeId },{ id: "D", label: `本来どうあるべきだったか、という違和感`, typeId: "axis" as TypeId }] }),
  choice({ id: "C04", block: "common-type", prompt: `長く続いたとき一番つらいのは?`, metric: "type", options: [{ id: "A", label: `決定権がなく、言われた通りに動くだけの状態`, typeId: "win" as TypeId },{ id: "B", label: `誰からも頼られず、居場所を感じられない状態`, typeId: "connect" as TypeId },{ id: "C", label: `自分のペースに絶えず割り込まれる状態`, typeId: "analyze" as TypeId },{ id: "D", label: `意味を感じられない作業を続ける状態`, typeId: "axis" as TypeId }] }),
  choice({ id: "C05", block: "common-type", prompt: `高い買い物の決め手は?`, metric: "type", options: [{ id: "A", label: `良いものを持っている、と胸を張れるか`, typeId: "win" as TypeId },{ id: "B", label: `使う場面を想像してワクワクするか`, typeId: "connect" as TypeId },{ id: "C", label: `調べ尽くして納得できるか`, typeId: "analyze" as TypeId },{ id: "D", label: `自分のこだわりに合っているか`, typeId: "axis" as TypeId }] }),
  choice({ id: "C06", block: "common-type", prompt: `昔の自分と比べて一番「成長した」と感じるのは?`, metric: "type", options: [{ id: "A", label: `勝負どころや交渉に強くなった`, typeId: "win" as TypeId },{ id: "B", label: `人との輪が広がった`, typeId: "connect" as TypeId },{ id: "C", label: `物事を構造で捉えられるようになった`, typeId: "analyze" as TypeId },{ id: "D", label: `自分の軸がぶれなくなった`, typeId: "axis" as TypeId }] }),
  choice({ id: "C07", block: "common-type", prompt: `友人から相談されたとき、無意識にやりがちなのは?`, metric: "type", options: [{ id: "A", label: `どう動けば形勢が変わるか、打ち手を一緒に考える`, typeId: "win" as TypeId },{ id: "B", label: `まず気持ちに寄り添い、一緒に怒ったり笑ったりする`, typeId: "connect" as TypeId },{ id: "C", label: `状況を整理して選択肢を並べる`, typeId: "analyze" as TypeId },{ id: "D", label: `そもそもどうありたいのかを一緒に掘る`, typeId: "axis" as TypeId }] }),
  choice({ id: "C08", block: "common-type", prompt: `新しい取り組みが始まるとき、最初に気になるのは?`, metric: "type", options: [{ id: "A", label: `誰が決めるのか、自分は何を任されるのか`, typeId: "win" as TypeId },{ id: "B", label: `誰と一緒にやるのか`, typeId: "connect" as TypeId },{ id: "C", label: `全体像と進め方`, typeId: "analyze" as TypeId },{ id: "D", label: `その取り組みに意味があるか`, typeId: "axis" as TypeId }] }),
  choice({ id: "C09", block: "common-type", prompt: `「もうやめたい」と感じやすいのは?`, metric: "type", options: [{ id: "A", label: `頑張っても報われず、割を食っていると感じたとき`, typeId: "win" as TypeId },{ id: "B", label: `一緒にやる人との関係が冷めたとき`, typeId: "connect" as TypeId },{ id: "C", label: `やり方に細かく口を出されたとき`, typeId: "analyze" as TypeId },{ id: "D", label: `やっていることの意味を見失ったとき`, typeId: "axis" as TypeId }] }),
  choice({ id: "C10", block: "common-type", prompt: `初対面の集まりで自然にやっているのは?`, metric: "type", options: [{ id: "A", label: `場の中心や流れがどこにあるかを見る`, typeId: "win" as TypeId },{ id: "B", label: `話しやすい空気を作る`, typeId: "connect" as TypeId },{ id: "C", label: `まず全体を静かに観察する`, typeId: "analyze" as TypeId },{ id: "D", label: `深く話せそうな一人を探す`, typeId: "axis" as TypeId }] }),
  choice({ id: "C11", block: "common-type", prompt: `「幸せ」に一番近いイメージは?`, metric: "type", options: [{ id: "A", label: `実力を認められ、対等以上に扱われている状態`, typeId: "win" as TypeId },{ id: "B", label: `好きな人たちと笑い合える毎日`, typeId: "connect" as TypeId },{ id: "C", label: `誰にも邪魔されず興味を追える状態`, typeId: "analyze" as TypeId },{ id: "D", label: `理想とする生き方を体現できている状態`, typeId: "axis" as TypeId }] }),
  choice({ id: "C12", block: "common-type", prompt: `人生で一度は経験してみたいのは?`, metric: "type", options: [{ id: "A", label: `大一番で結果を出して、場を沸かせる`, typeId: "win" as TypeId },{ id: "B", label: `一生の思い出になる最高の瞬間を、みんなで共有する`, typeId: "connect" as TypeId },{ id: "C", label: `誰も解けなかった問いを自分の力で解く`, typeId: "analyze" as TypeId },{ id: "D", label: `「あの人の生き方は本物だ」と言われる域に達する`, typeId: "axis" as TypeId }] }),
];

export const comparisonQuestions: Record<string, QuestionDefinition[]> = {
  "connect-win": [
    choice({ id: "VS-WC-1", block: "type-comparison", prompt: `勝てるけれど場の空気が固くなるか、負けを受け入れて輪を守るか、どちらかしか選べないなら?`, metric: "type", options: [{ id: "A", label: `勝ちに行く`, typeId: "win" }, { id: "B", label: `輪を守る`, typeId: "connect" }] }),
    choice({ id: "VS-WC-2", block: "type-comparison", prompt: `評価がはっきり付く一人仕事と、評価は目立たないが好きな仲間との仕事、どちらかだけ選ぶなら?`, metric: "type", options: [{ id: "A", label: `評価が付く一人仕事`, typeId: "win" }, { id: "B", label: `仲間との仕事`, typeId: "connect" }] }),
  ],
  "analyze-win": [
    choice({ id: "VS-WR-1", block: "type-comparison", prompt: `主導して全体を動かす役と、誰にも口を出されず自分の持ち場を極める役、どちらかなら?`, metric: "type", options: [{ id: "A", label: `主導する役`, typeId: "win" }, { id: "B", label: `持ち場を極める役`, typeId: "analyze" }] }),
    choice({ id: "VS-WR-2", block: "type-comparison", prompt: `締切間際。多少粗くても先に形にして流れを取るか、納得いくまで確かめてから出すか?`, metric: "type", options: [{ id: "A", label: `先に形にする`, typeId: "win" }, { id: "B", label: `確かめてから出す`, typeId: "analyze" }] }),
  ],
  "axis-win": [
    choice({ id: "VS-WJ-1", block: "type-comparison", prompt: `勝ち筋はあるが自分の流儀に反するやり方と、流儀は守れるが負けが濃厚な道、どちらかなら?`, metric: "type", options: [{ id: "A", label: `勝ち筋を取る`, typeId: "win" }, { id: "B", label: `流儀を守る`, typeId: "axis" }] }),
    choice({ id: "VS-WJ-2", block: "type-comparison", prompt: `周囲から高く評価される仕事と、自分が意味を感じる仕事、どちらか一方しか取れないなら?`, metric: "type", options: [{ id: "A", label: `評価される仕事`, typeId: "win" }, { id: "B", label: `意味を感じる仕事`, typeId: "axis" }] }),
  ],
  "analyze-connect": [
    choice({ id: "VS-CR-1", block: "type-comparison", prompt: `みんなと一緒に進められるが途中で予定変更が多い活動と、一人で落ち着いて進められる活動なら?`, metric: "type", options: [{ id: "A", label: `人と一緒に進める`, typeId: "connect" }, { id: "B", label: `一人で落ち着いて進める`, typeId: "analyze" }] }),
    choice({ id: "VS-CR-2", block: "type-comparison", prompt: `相手の気持ちにまず寄り添うことと、状況を正確に整理することの片方しかできないなら?`, metric: "type", options: [{ id: "A", label: `まず気持ちへ寄り添う`, typeId: "connect" }, { id: "B", label: `まず状況を整理する`, typeId: "analyze" }] }),
  ],
  "axis-connect": [
    choice({ id: "VS-CJ-1", block: "type-comparison", prompt: `周囲が喜ぶ形だが自分の理想とは少し違う案と、自分の理想には近いが周囲の賛同が少ない案なら?`, metric: "type", options: [{ id: "A", label: `周囲が喜ぶ形を選ぶ`, typeId: "connect" }, { id: "B", label: `自分の理想に近い形を選ぶ`, typeId: "axis" }] }),
    choice({ id: "VS-CJ-2", block: "type-comparison", prompt: `大勢と楽しく過ごせる浅い関係と、人数は少ないが価値観まで語れる関係なら?`, metric: "type", options: [{ id: "A", label: `大勢と楽しく過ごせる関係`, typeId: "connect" }, { id: "B", label: `少人数でも深く語れる関係`, typeId: "axis" }] }),
  ],
  "analyze-axis": [
    choice({ id: "VS-RJ-1", block: "type-comparison", prompt: `根拠は十分だが自分の美学には合わない選択と、根拠はまだ弱いが自分の信念に沿う選択なら?`, metric: "type", options: [{ id: "A", label: `根拠が十分な選択`, typeId: "analyze" }, { id: "B", label: `信念に沿う選択`, typeId: "axis" }] }),
    choice({ id: "VS-RJ-2", block: "type-comparison", prompt: `興味のあることを自由に掘り下げる時間と、一つの理想を形にするための鍛錬時間なら?`, metric: "type", options: [{ id: "A", label: `自由に掘り下げる`, typeId: "analyze" }, { id: "B", label: `理想を形にする鍛錬`, typeId: "axis" }] }),
  ],
};

export const defenseQuestions: QuestionDefinition[] = [
  choice({ id: "D1", block: "defense", prompt: `信頼していた人が裏であなたの不利になる動きをしていたと分かった。最初に出るのは?`, metric: "defense", options: [{ id: "A", label: `言い返したい、問い詰めたい`, defenseCategory: "counterattack" as DefenseCategory },{ id: "B", label: `その人から静かに離れたくなる`, defenseCategory: "distance" as DefenseCategory },{ id: "C", label: `まず事実を確かめたくなる`, defenseCategory: "analyze" as DefenseCategory },{ id: "D", label: `自分に原因があったのかと考え始める`, defenseCategory: "self-blame" as DefenseCategory }] }),
  choice({ id: "D2", block: "defense", prompt: `その後、数日のうちに実際に取りそうな行動は?`, metric: "defense", options: [{ id: "A", label: `行動や成果で状態を立て直そうとする`, defenseCategory: "prove" as DefenseCategory },{ id: "B", label: `自分の不満は抑えて、相手が望む形へ合わせようとする`, defenseCategory: "self-efface" as DefenseCategory },{ id: "C", label: `接点を減らして様子を見る`, defenseCategory: "distance" as DefenseCategory },{ id: "D", label: `気持ちに蓋をして日常を続ける`, defenseCategory: "numb" as DefenseCategory }] }),
  choice({ id: "D3", block: "defense", prompt: `大事な場面で失敗し、大勢の前で恥をかいた。直後の頭の中は?`, metric: "defense", options: [{ id: "A", label: `すぐに挽回できる行動を探している`, defenseCategory: "prove" as DefenseCategory },{ id: "B", label: `自分の気持ちは抑えて、その場に合わせようとする`, defenseCategory: "self-efface" as DefenseCategory },{ id: "C", label: `頭が真っ白になって動けない`, defenseCategory: "freeze" as DefenseCategory },{ id: "D", label: `原因の整理が勝手に始まっている`, defenseCategory: "analyze" as DefenseCategory }] }),
  choice({ id: "D4", block: "defense", prompt: `その夜、家に帰ってからのあなたは?`, metric: "defense", options: [{ id: "A", label: `次に備えて行動や準備を始める`, defenseCategory: "prove" as DefenseCategory },{ id: "B", label: `周囲に合わせられるよう、自分の振る舞いを調整する`, defenseCategory: "self-efface" as DefenseCategory },{ id: "C", label: `一人で事実と反省点を整理する`, defenseCategory: "analyze" as DefenseCategory },{ id: "D", label: `同じ場面を何度も反芻して自分を責める`, defenseCategory: "self-blame" as DefenseCategory }] }),
  choice({ id: "D5", block: "defense", prompt: `何をやってもうまくいかない時期が数か月続いている。起きやすいのは?`, metric: "defense", options: [{ id: "A", label: `状況を変えるため、目に見える行動を増やしたくなる`, defenseCategory: "prove" as DefenseCategory },{ id: "B", label: `自分の希望を抑えて、周囲が求める役割へ合わせる`, defenseCategory: "self-efface" as DefenseCategory },{ id: "C", label: `予定や接点を減らして考え込む時間が増える`, defenseCategory: "distance" as DefenseCategory },{ id: "D", label: `感情が動かなくなり、淡々とこなすだけになる`, defenseCategory: "numb" as DefenseCategory }] }),
  choice({ id: "D6", block: "defense", prompt: `その状態から抜けるきっかけになりやすいのは?`, metric: "defense", options: [{ id: "A", label: `小さくても成果が見える行動を始めること`, defenseCategory: "prove" as DefenseCategory },{ id: "B", label: `自分の希望より、周囲が求めることへ合わせ直すこと`, defenseCategory: "self-efface" as DefenseCategory },{ id: "C", label: `状況を整理し直し、次の手順が見えること`, defenseCategory: "analyze" as DefenseCategory },{ id: "D", label: `一度すべてから離れて刺激を減らすこと`, defenseCategory: "distance" as DefenseCategory }] }),
  choice({ id: "D7", block: "defense", prompt: `あなたが大切にしてきたものを、真っ向から「無意味だ」と否定された。反射的に出るのは?`, metric: "defense", options: [{ id: "A", label: `その場で反論したくなる`, defenseCategory: "counterattack" as DefenseCategory },{ id: "B", label: `深く傷つくが、その場は流して距離を置く`, defenseCategory: "distance" as DefenseCategory },{ id: "C", label: `相手がなぜそう思うのか根拠を確かめたくなる`, defenseCategory: "analyze" as DefenseCategory },{ id: "D", label: `「本当にそうかもしれない」と矛先が自分に向く`, defenseCategory: "self-blame" as DefenseCategory }] }),
];

export const genericExpressionQuestions: QuestionDefinition[] = [
  likert({ id: "GE01", block: "generic-expression", prompt: `自分が望んでいることを、周囲へ言葉で伝えることが多い`, metric: "expression", polarity: "positive", isGeneric: true }),
  likert({ id: "GE02", block: "generic-expression", prompt: `本当に欲しいものほど、表には出さず自分の中にしまっておく`, metric: "expression", polarity: "negative", isGeneric: true }),
  likert({ id: "GE03", block: "generic-expression", prompt: `納得していないことがあると、態度や行動に表れやすい`, metric: "expression", polarity: "positive", isGeneric: true }),
  likert({ id: "GE04", block: "generic-expression", prompt: `相手や場面によって、自分の希望を見せるか隠すかを意識的に変えている`, metric: "expression", polarity: "switch", isConfirmation: true, isGeneric: true }),
];

export const genericGapQuestions: QuestionDefinition[] = [
  likert({ id: "GZ1-H", block: "generic-gap-inner", prompt: `本音では、自分の希望をもっと優先してほしいと思うことがある`, metric: "gap", pairId: "GZ1", isGeneric: true }),
  likert({ id: "GZ1-P", block: "generic-gap-public", prompt: `実際に、自分の希望を相手へ言葉で伝えている`, metric: "gap", pairId: "GZ1", isGeneric: true }),
  likert({ id: "GZ2-H", block: "generic-gap-inner", prompt: `本音では、納得できないときは違うと言いたい`, metric: "gap", pairId: "GZ2", isGeneric: true }),
  likert({ id: "GZ2-P", block: "generic-gap-public", prompt: `実際に、納得できないときは異論を示している`, metric: "gap", pairId: "GZ2", isGeneric: true }),
  likert({ id: "GZ3-H", block: "generic-gap-inner", prompt: `本音では、無理な頼みや負担は断りたい`, metric: "gap", pairId: "GZ3", isGeneric: true }),
  likert({ id: "GZ3-P", block: "generic-gap-public", prompt: `実際に、難しい依頼には断る・条件を伝える行動を取っている`, metric: "gap", pairId: "GZ3", isGeneric: true }),
  likert({ id: "GZ4-H", block: "generic-gap-inner", prompt: `本音では、自分の努力や貢献に気づいてほしい`, metric: "gap", pairId: "GZ4", isGeneric: true }),
  likert({ id: "GZ4-P", block: "generic-gap-public", prompt: `実際に、自分が行ったことを必要な相手へ伝えている`, metric: "gap", pairId: "GZ4", isGeneric: true }),
  likert({ id: "GZ5-H", block: "generic-gap-inner", prompt: `本音では、困ったときは誰かに助けてほしい`, metric: "gap", pairId: "GZ5", isGeneric: true }),
  likert({ id: "GZ5-P", block: "generic-gap-public", prompt: `実際に、困ったときは助けを求めている`, metric: "gap", pairId: "GZ5", isGeneric: true }),
  likert({ id: "GZ6-H", block: "generic-gap-inner", prompt: `本音では、自分の都合や余裕も尊重してほしい`, metric: "gap", pairId: "GZ6", isConfirmation: true, isGeneric: true }),
  likert({ id: "GZ6-P", block: "generic-gap-public", prompt: `実際に、予定や負担の調整を相手へ申し出ている`, metric: "gap", pairId: "GZ6", isConfirmation: true, isGeneric: true }),
];

const winExpression: QuestionDefinition[] = [
  likert({ id: "DS1", block: "expression", prompt: `勝ちたい・優位に立ちたいという気持ちを、周囲に隠さず見せている`, targetType: "win", metric: "expression", polarity: "positive" }),
  likert({ id: "DS2", block: "expression", prompt: `競争心は表に出さず、結果でだけ示したい`, targetType: "win", metric: "expression", polarity: "negative" }),
  likert({ id: "DS3", block: "expression", prompt: `「負けたくない」と口に出して言うことがある`, targetType: "win", metric: "expression", polarity: "positive" }),
  likert({ id: "DS-FIT", block: "expression", prompt: `周囲に見せるかどうかとは別に、自分の中では「負けたくない」「優位でいたい」という感覚が強い`, targetType: "win", metric: "fit", polarity: "fit" }),
  likert({ id: "DS-M1", block: "expression", prompt: `相手や場面によって、競争心を見せるか隠すかを使い分けている`, targetType: "win", metric: "expression", polarity: "switch", isConfirmation: true }),
  likert({ id: "DS-M2", block: "expression", prompt: `競争心を出すかどうかは、勝てる見込みがあるかどうかで変わる`, targetType: "win", metric: "expression", polarity: "switch", isConfirmation: true }),
];
const winGap: QuestionDefinition[] = [
  likert({ id: "Z1-H", block: "gap-inner", prompt: `本音では、会議や話し合いで自分が流れを握りたい`, targetType: "win", metric: "gap", pairId: "Z1" }),
  likert({ id: "Z1-P", block: "gap-public", prompt: `実際の場では、自分から流れを取りにいくことが多い`, targetType: "win", metric: "gap", pairId: "Z1" }),
  likert({ id: "Z2-H", block: "gap-inner", prompt: `本音では、自分の貢献はきちんと自分の手柄として扱われたい`, targetType: "win", metric: "gap", pairId: "Z2" }),
  likert({ id: "Z2-P", block: "gap-public", prompt: `実際には、自分の貢献を自分から伝えている`, targetType: "win", metric: "gap", pairId: "Z2" }),
  likert({ id: "Z3-H", block: "gap-inner", prompt: `本音では、身近な相手にも負けたくないと思っている`, targetType: "win", metric: "gap", pairId: "Z3" }),
  likert({ id: "Z3-P", block: "gap-public", prompt: `実際に、張り合う姿勢を相手に見せている`, targetType: "win", metric: "gap", pairId: "Z3" }),
  likert({ id: "Z4-H", block: "gap-inner", prompt: `本音では、押し切ってでも自分の案で進めたいことがある`, targetType: "win", metric: "gap", pairId: "Z4" }),
  likert({ id: "Z4-P", block: "gap-public", prompt: `実際の場では、反対されても自分の案を押している`, targetType: "win", metric: "gap", pairId: "Z4" }),
  likert({ id: "Z5-H", block: "gap-inner", prompt: `本音では、軽く扱われたらその場で立場をはっきりさせたい`, targetType: "win", metric: "gap", pairId: "Z5" }),
  likert({ id: "Z5-P", block: "gap-public", prompt: `実際に、軽く扱われたときはその場で示している`, targetType: "win", metric: "gap", pairId: "Z5" }),
  likert({ id: "Z6-H", block: "gap-inner", prompt: `本音では、交渉ごとでは譲りたくない`, targetType: "win", metric: "gap", pairId: "Z6", isConfirmation: true }),
  likert({ id: "Z6-P", block: "gap-public", prompt: `実際の交渉で、簡単には譲らない姿勢を見せている`, targetType: "win", metric: "gap", pairId: "Z6", isConfirmation: true }),
];
const winUtilization: QuestionDefinition[] = [
  likert({ id: "U-A1", block: "utilization", prompt: `競争心や「負けたくない」が動いた瞬間に、自分で気づけている実感がある`, targetType: "win", metric: "awareness", polarity: "positive" }),
  likert({ id: "U-A2", block: "utilization", prompt: `勝ち負けにこだわりすぎているとき、途中でそれを自覚できることが多い`, targetType: "win", metric: "awareness", polarity: "positive" }),
  likert({ id: "U-R1", block: "utilization", prompt: `あとから振り返って初めて「あのとき張り合っていたな」と気づくことが多い`, targetType: "win", metric: "awareness", polarity: "reverse" }),
  likert({ id: "U-O1", block: "utilization", prompt: `競争心を出す場面と抑える場面を、自分で選べている実感がある`, targetType: "win", metric: "utilization", polarity: "positive" }),
  likert({ id: "U-O2", block: "utilization", prompt: `「負けたくない」を、人にぶつけずに行動の燃料へ回せている実感がある`, targetType: "win", metric: "utilization", polarity: "positive" }),
  likert({ id: "U-R2", block: "utilization", prompt: `この1か月で、勝ち負けへのこだわりが人間関係をぎくしゃくさせたと感じたことがある`, targetType: "win", metric: "utilization", polarity: "reverse" }),
  likert({ id: "U-C1", block: "utilization", prompt: `直近で、競争心が動いたことに自分で気づいた場面を、具体的に思い出せる`, targetType: "win", metric: "awareness", polarity: "positive", isConfirmation: true }),
  likert({ id: "U-C2", block: "utilization", prompt: `直近で、競争心をうまく力に変えられた場面を、具体的に思い出せる`, targetType: "win", metric: "utilization", polarity: "positive", isConfirmation: true }),
];

const connectExpression: QuestionDefinition[] = [
  likert({ id: "TS1", block: "expression", prompt: `誰かとつながりたい、関わってほしいという気持ちを、言葉や態度に出すことが多い`, targetType: "connect", metric: "expression", polarity: "positive" }),
  likert({ id: "TS2", block: "expression", prompt: `寂しさや「もっと関わってほしい」という気持ちは、相手に見せず自分の中へしまう`, targetType: "connect", metric: "expression", polarity: "negative" }),
  likert({ id: "TS3", block: "expression", prompt: `うれしい・寂しい・会いたいなど、関係にまつわる気持ちは相手へ伝えるほうだ`, targetType: "connect", metric: "expression", polarity: "positive" }),
  likert({ id: "TS-FIT", block: "expression", prompt: `周囲に見せるかどうかとは別に、自分の中では「人と気持ちを分かち合いたい」「必要とされたい」という感覚が強い`, targetType: "connect", metric: "fit", polarity: "fit" }),
  likert({ id: "TS-M1", block: "expression", prompt: `相手との距離や関係によって、つながりたい気持ちを見せるか隠すかを変えている`, targetType: "connect", metric: "expression", polarity: "switch", isConfirmation: true }),
  likert({ id: "TS-M2", block: "expression", prompt: `相手から反応が返ってきそうなときだけ、自分から関わりにいくことが多い`, targetType: "connect", metric: "expression", polarity: "switch", isConfirmation: true }),
];
const connectGap: QuestionDefinition[] = [
  likert({ id: "TZ1-H", block: "gap-inner", prompt: `本音では、会いたい人には自分から声をかけたい`, targetType: "connect", metric: "gap", pairId: "TZ1" }),
  likert({ id: "TZ1-P", block: "gap-public", prompt: `実際に、会いたい人へ自分から連絡や誘いをしている`, targetType: "connect", metric: "gap", pairId: "TZ1" }),
  likert({ id: "TZ2-H", block: "gap-inner", prompt: `本音では、自分の話や働きかけにもっと反応してほしい`, targetType: "connect", metric: "gap", pairId: "TZ2" }),
  likert({ id: "TZ2-P", block: "gap-public", prompt: `実際に、反応がほしいことを相手へ伝えている`, targetType: "connect", metric: "gap", pairId: "TZ2" }),
  likert({ id: "TZ3-H", block: "gap-inner", prompt: `本音では、寂しいときは誰かに気づいてほしい`, targetType: "connect", metric: "gap", pairId: "TZ3" }),
  likert({ id: "TZ3-P", block: "gap-public", prompt: `実際に、寂しいときは態度や言葉で相手へ示している`, targetType: "connect", metric: "gap", pairId: "TZ3" }),
  likert({ id: "TZ4-H", block: "gap-inner", prompt: `本音では、誰かの役に立ち、必要とされたい`, targetType: "connect", metric: "gap", pairId: "TZ4" }),
  likert({ id: "TZ4-P", block: "gap-public", prompt: `実際に、自分から人の輪や役割へ入っている`, targetType: "connect", metric: "gap", pairId: "TZ4" }),
  likert({ id: "TZ5-H", block: "gap-inner", prompt: `本音では、関係が冷えたときは早く元へ戻したい`, targetType: "connect", metric: "gap", pairId: "TZ5" }),
  likert({ id: "TZ5-P", block: "gap-public", prompt: `実際に、気まずい相手へ自分から関係修復の働きかけをしている`, targetType: "connect", metric: "gap", pairId: "TZ5" }),
  likert({ id: "TZ6-H", block: "gap-inner", prompt: `本音では、大切な人とはもっと気持ちを共有したい`, targetType: "connect", metric: "gap", pairId: "TZ6", isConfirmation: true }),
  likert({ id: "TZ6-P", block: "gap-public", prompt: `実際に、大切な人へ自分の気持ちを言葉で伝えている`, targetType: "connect", metric: "gap", pairId: "TZ6", isConfirmation: true }),
];
const connectUtilization: QuestionDefinition[] = [
  likert({ id: "T-U-A1", block: "utilization", prompt: `つながりたい、反応がほしいという気持ちが動いた瞬間に、自分で気づけている実感がある`, targetType: "connect", metric: "awareness", polarity: "positive" }),
  likert({ id: "T-U-A2", block: "utilization", prompt: `相手の反応を求めすぎているとき、途中でそれを自覚できることが多い`, targetType: "connect", metric: "awareness", polarity: "positive" }),
  likert({ id: "T-U-R1", block: "utilization", prompt: `あとから振り返って初めて、「反応がほしくて動いていた」と気づくことが多い`, targetType: "connect", metric: "awareness", polarity: "reverse" }),
  likert({ id: "T-U-O1", block: "utilization", prompt: `関わりにいく場面と、相手を待つ場面を、自分で選べている実感がある`, targetType: "connect", metric: "utilization", polarity: "positive" }),
  likert({ id: "T-U-O2", block: "utilization", prompt: `つながりたい気持ちを、相手へ無理をさせず関係を育てる行動へ回せている実感がある`, targetType: "connect", metric: "utilization", polarity: "positive" }),
  likert({ id: "T-U-R2", block: "utilization", prompt: `この1か月で、反応を求めすぎたことで相手との距離が不自然になったと感じたことがある`, targetType: "connect", metric: "utilization", polarity: "reverse" }),
  likert({ id: "T-U-C1", block: "utilization", prompt: `直近で、反応がほしい自分に気づいた場面を具体的に思い出せる`, targetType: "connect", metric: "awareness", polarity: "positive", isConfirmation: true }),
  likert({ id: "T-U-C2", block: "utilization", prompt: `直近で、つながりたい気持ちを関係づくりへうまく使えた場面を具体的に思い出せる`, targetType: "connect", metric: "utilization", polarity: "positive", isConfirmation: true }),
];

const analyzeExpression: QuestionDefinition[] = [
  likert({ id: "RS1", block: "expression", prompt: `分からないことや納得できない点があると、周囲へ質問や確認をすることが多い`, targetType: "analyze", metric: "expression", polarity: "positive" }),
  likert({ id: "RS2", block: "expression", prompt: `理解できていないことがあっても、その場では言わず一人で調べて処理する`, targetType: "analyze", metric: "expression", polarity: "negative" }),
  likert({ id: "RS3", block: "expression", prompt: `自分のペースや考える時間が必要なときは、周囲へはっきり伝えるほうだ`, targetType: "analyze", metric: "expression", polarity: "positive" }),
  likert({ id: "RS-FIT", block: "expression", prompt: `周囲に見せるかどうかとは別に、自分の中では「きちんと理解したい」「自分のペースを守りたい」という感覚が強い`, targetType: "analyze", metric: "fit", polarity: "fit" }),
  likert({ id: "RS-M1", block: "expression", prompt: `相手や立場によって、疑問を口にするか一人で調べるかを変えている`, targetType: "analyze", metric: "expression", polarity: "switch", isConfirmation: true }),
  likert({ id: "RS-M2", block: "expression", prompt: `質問しても安全だと感じる場では外へ出し、評価される場では黙ることが多い`, targetType: "analyze", metric: "expression", polarity: "switch", isConfirmation: true }),
];
const analyzeGap: QuestionDefinition[] = [
  likert({ id: "RZ1-H", block: "gap-inner", prompt: `本音では、分からない点は納得できるまで確認したい`, targetType: "analyze", metric: "gap", pairId: "RZ1" }),
  likert({ id: "RZ1-P", block: "gap-public", prompt: `実際に、分からない点はその場で質問している`, targetType: "analyze", metric: "gap", pairId: "RZ1" }),
  likert({ id: "RZ2-H", block: "gap-inner", prompt: `本音では、考える時間を十分に確保してから答えたい`, targetType: "analyze", metric: "gap", pairId: "RZ2" }),
  likert({ id: "RZ2-P", block: "gap-public", prompt: `実際に、すぐ答えず考える時間が必要だと伝えている`, targetType: "analyze", metric: "gap", pairId: "RZ2" }),
  likert({ id: "RZ3-H", block: "gap-inner", prompt: `本音では、自分のやり方へ細かく口を出してほしくない`, targetType: "analyze", metric: "gap", pairId: "RZ3" }),
  likert({ id: "RZ3-P", block: "gap-public", prompt: `実際に、任せてほしい範囲を相手へ伝えている`, targetType: "analyze", metric: "gap", pairId: "RZ3" }),
  likert({ id: "RZ4-H", block: "gap-inner", prompt: `本音では、理由が分からない指示には従いたくない`, targetType: "analyze", metric: "gap", pairId: "RZ4" }),
  likert({ id: "RZ4-P", block: "gap-public", prompt: `実際に、理由や根拠を確認してから動いている`, targetType: "analyze", metric: "gap", pairId: "RZ4" }),
  likert({ id: "RZ5-H", block: "gap-inner", prompt: `本音では、集中しているときは人に割り込まれたくない`, targetType: "analyze", metric: "gap", pairId: "RZ5" }),
  likert({ id: "RZ5-P", block: "gap-public", prompt: `実際に、集中時間や連絡可能な時間を周囲へ示している`, targetType: "analyze", metric: "gap", pairId: "RZ5" }),
  likert({ id: "RZ6-H", block: "gap-inner", prompt: `本音では、情報が足りないまま結論を出したくない`, targetType: "analyze", metric: "gap", pairId: "RZ6", isConfirmation: true }),
  likert({ id: "RZ6-P", block: "gap-public", prompt: `実際に、情報不足を伝えて判断を保留している`, targetType: "analyze", metric: "gap", pairId: "RZ6", isConfirmation: true }),
];
const analyzeUtilization: QuestionDefinition[] = [
  likert({ id: "R-U-A1", block: "utilization", prompt: `理解できていないことへの不安や違和感が動いた瞬間に、自分で気づけている実感がある`, targetType: "analyze", metric: "awareness", polarity: "positive" }),
  likert({ id: "R-U-A2", block: "utilization", prompt: `調べ続けることで行動を先送りしているとき、途中でそれを自覚できることが多い`, targetType: "analyze", metric: "awareness", polarity: "positive" }),
  likert({ id: "R-U-R1", block: "utilization", prompt: `あとから振り返って初めて、「分からないことが怖くて止まっていた」と気づくことが多い`, targetType: "analyze", metric: "awareness", polarity: "reverse" }),
  likert({ id: "R-U-O1", block: "utilization", prompt: `深く考える場面と、十分でなくても一度動く場面を、自分で選べている実感がある`, targetType: "analyze", metric: "utilization", polarity: "positive" }),
  likert({ id: "R-U-O2", block: "utilization", prompt: `理解したい気持ちを、相手を遠ざけず質問や整理へ変えられている実感がある`, targetType: "analyze", metric: "utilization", polarity: "positive" }),
  likert({ id: "R-U-R2", block: "utilization", prompt: `この1か月で、考えすぎや説明不足によって周囲との進み方がずれたと感じたことがある`, targetType: "analyze", metric: "utilization", polarity: "reverse" }),
  likert({ id: "R-U-C1", block: "utilization", prompt: `直近で、分からなさへの反応に自分で気づいた場面を具体的に思い出せる`, targetType: "analyze", metric: "awareness", polarity: "positive", isConfirmation: true }),
  likert({ id: "R-U-C2", block: "utilization", prompt: `直近で、理解したい気持ちを前進へうまく使えた場面を具体的に思い出せる`, targetType: "analyze", metric: "utilization", polarity: "positive", isConfirmation: true }),
];

const axisExpression: QuestionDefinition[] = [
  likert({ id: "JS1", block: "expression", prompt: `自分が大事にしている基準や「こうありたい」を、周囲へ言葉で伝えることが多い`, targetType: "axis", metric: "expression", polarity: "positive" }),
  likert({ id: "JS2", block: "expression", prompt: `自分の理想や違和感は、周囲には言わず自分の中だけで守る`, targetType: "axis", metric: "expression", polarity: "negative" }),
  likert({ id: "JS3", block: "expression", prompt: `意味がない、筋が違うと感じたときは、その違和感を相手へ示すほうだ`, targetType: "axis", metric: "expression", polarity: "positive" }),
  likert({ id: "JS-FIT", block: "expression", prompt: `周囲に見せるかどうかとは別に、自分の中では「納得できる生き方をしたい」「意味のある形に近づけたい」という感覚が強い`, targetType: "axis", metric: "fit", polarity: "fit" }),
  likert({ id: "JS-M1", block: "expression", prompt: `相手や場面によって、自分の基準を表へ出すか内側だけで守るかを変えている`, targetType: "axis", metric: "expression", polarity: "switch", isConfirmation: true }),
  likert({ id: "JS-M2", block: "expression", prompt: `関係が壊れないと判断した場面では理想を語り、そうでない場面では黙ることが多い`, targetType: "axis", metric: "expression", polarity: "switch", isConfirmation: true }),
];
const axisGap: QuestionDefinition[] = [
  likert({ id: "JZ1-H", block: "gap-inner", prompt: `本音では、意味を感じないことは続けたくない`, targetType: "axis", metric: "gap", pairId: "JZ1" }),
  likert({ id: "JZ1-P", block: "gap-public", prompt: `実際に、意味や目的が分からないときは相手へ確認している`, targetType: "axis", metric: "gap", pairId: "JZ1" }),
  likert({ id: "JZ2-H", block: "gap-inner", prompt: `本音では、自分が大切にする基準は曲げたくない`, targetType: "axis", metric: "gap", pairId: "JZ2" }),
  likert({ id: "JZ2-P", block: "gap-public", prompt: `実際に、自分の基準を周囲へ言葉で示している`, targetType: "axis", metric: "gap", pairId: "JZ2" }),
  likert({ id: "JZ3-H", block: "gap-inner", prompt: `本音では、妥協せず理想の形へ近づけたい`, targetType: "axis", metric: "gap", pairId: "JZ3" }),
  likert({ id: "JZ3-P", block: "gap-public", prompt: `実際に、理想へ近づける提案や修正を周囲へ伝えている`, targetType: "axis", metric: "gap", pairId: "JZ3" }),
  likert({ id: "JZ4-H", block: "gap-inner", prompt: `本音では、筋が通らないと感じたことは見過ごしたくない`, targetType: "axis", metric: "gap", pairId: "JZ4" }),
  likert({ id: "JZ4-P", block: "gap-public", prompt: `実際に、違和感があるときはその場で伝えている`, targetType: "axis", metric: "gap", pairId: "JZ4" }),
  likert({ id: "JZ5-H", block: "gap-inner", prompt: `本音では、自分らしくない役割を長く演じたくない`, targetType: "axis", metric: "gap", pairId: "JZ5" }),
  likert({ id: "JZ5-P", block: "gap-public", prompt: `実際に、自分に合わない役割や期待には断り・調整を伝えている`, targetType: "axis", metric: "gap", pairId: "JZ5" }),
  likert({ id: "JZ6-H", block: "gap-inner", prompt: `本音では、納得できない方針へ自分を合わせたくない`, targetType: "axis", metric: "gap", pairId: "JZ6", isConfirmation: true }),
  likert({ id: "JZ6-P", block: "gap-public", prompt: `実際に、納得できない方針には代案や異論を示している`, targetType: "axis", metric: "gap", pairId: "JZ6", isConfirmation: true }),
];
const axisUtilization: QuestionDefinition[] = [
  likert({ id: "J-U-A1", block: "utilization", prompt: `理想や自分の基準が反応した瞬間に、自分で気づけている実感がある`, targetType: "axis", metric: "awareness", polarity: "positive" }),
  likert({ id: "J-U-A2", block: "utilization", prompt: `「こうあるべき」にこだわりすぎているとき、途中でそれを自覚できることが多い`, targetType: "axis", metric: "awareness", polarity: "positive" }),
  likert({ id: "J-U-R1", block: "utilization", prompt: `あとから振り返って初めて、「自分の理想を相手にも求めていた」と気づくことが多い`, targetType: "axis", metric: "awareness", polarity: "reverse" }),
  likert({ id: "J-U-O1", block: "utilization", prompt: `基準を守る場面と、現実に合わせて調整する場面を、自分で選べている実感がある`, targetType: "axis", metric: "utilization", polarity: "positive" }),
  likert({ id: "J-U-O2", block: "utilization", prompt: `理想を、相手を否定せず改善案や作品へ変えられている実感がある`, targetType: "axis", metric: "utilization", polarity: "positive" }),
  likert({ id: "J-U-R2", block: "utilization", prompt: `この1か月で、理想や正しさへのこだわりが人との距離を作ったと感じたことがある`, targetType: "axis", metric: "utilization", polarity: "reverse" }),
  likert({ id: "J-U-C1", block: "utilization", prompt: `直近で、自分の基準が強く反応した場面を具体的に思い出せる`, targetType: "axis", metric: "awareness", polarity: "positive", isConfirmation: true }),
  likert({ id: "J-U-C2", block: "utilization", prompt: `直近で、理想を現実的な一歩へ変えられた場面を具体的に思い出せる`, targetType: "axis", metric: "utilization", polarity: "positive", isConfirmation: true }),
];

export const questionBank: QuestionBankSections = {
  commonType: commonTypeQuestions,
  comparisons: comparisonQuestions,
  defense: defenseQuestions,
  genericExpression: genericExpressionQuestions,
  genericGap: genericGapQuestions,
  byType: {
    win: { expression: winExpression, gap: winGap, utilization: winUtilization },
    connect: { expression: connectExpression, gap: connectGap, utilization: connectUtilization },
    analyze: { expression: analyzeExpression, gap: analyzeGap, utilization: analyzeUtilization },
    axis: { expression: axisExpression, gap: axisGap, utilization: axisUtilization },
  },
};