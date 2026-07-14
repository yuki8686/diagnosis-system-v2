import { EXPRESSION_LABELS, TYPE_LABELS } from "../../constants";
import type { Confidence, ExpressionId, TypeId } from "../../types";

export type LabelTemplateKey = `${TypeId}:${ExpressionId}`;

interface BaseLabelReportTemplate {
  characterName: string;
  headline: string;
  coreDesire: string;
  expressionDescription: string;
  core: string;
  expression: string;
  protects: string;
  impression: string;
  misunderstanding: string;
  strength: string;
  friction: string;
  action: string;
  observation: string;
}

export interface LabelReportTemplate extends BaseLabelReportTemplate {
  coreFocus: string;
  protectedFocus: string;
  relationshipPossibility: string;
  workPossibility: string;
}

export type ConfidenceCopy = Record<Confidence, string>;
export type ConfidenceCopyField = "core" | "expression" | "protects" | "impression" | "misunderstanding" | "strength" | "friction" | "relationshipPossibility" | "workPossibility";

export interface CharacterDisplayCopy {
  type: TypeId;
  expression: ExpressionId;
  characterName: string;
  headline: string;
  coreDesire: string;
  expressionDescription: string;
}

const LABEL_TEMPLATE_COPY: Record<LabelTemplateKey, BaseLabelReportTemplate> = {
  "win:outward": {
    characterName: "戦車",
    headline: "立ち止まった流れを見ると、自分が先頭に立って動かしたくなる人。",
    coreDesire: "自分の力で状況を動かし、望む結果をつかみたい。",
    expressionDescription: "意志や目標をはっきりと外へ示し、周囲を巻き込みながら前へ進む。",
    core: "対等以上に扱われることや、自分の貢献が結果として認められることへ反応しやすい傾向があります。",
    expression: "取りたい結果や前へ出たい気持ちを、言葉や行動として周囲へ示しやすい出し方です。",
    protects: "自分で流れを動かせる立場と、実力が結果へ反映される状態を守ろうとしやすい人です。",
    impression: "決断が速く、勝負どころで頼れる人として見られやすいでしょう。",
    misunderstanding: "前進を急ぐ姿勢が、相手によっては張り合われているように映る可能性があります。",
    strength: "停滞した場面で決断を引き受け、前進のきっかけを作れることが強みです。",
    friction: "結果へ集中するほど、周囲が納得するまでに必要な時間を見落とすことがあります。",
    action: "次に結論を出す前に、周囲の懸念を一つだけ尋ねてください。",
    observation: "前進の速さと周囲の納得が同時に保てたかを観察してください。",
  },
  "win:inward": {
    characterName: "力",
    headline: "静かに見えても、心の奥では誰よりも負けたくない人。",
    coreDesire: "自分の力で状況を動かし、望む結果をつかみたい。",
    expressionDescription: "強い意志を内側に保ち、必要な瞬間まで力を蓄えながら粘り強く進む。",
    core: "軽く扱われないことや、自分の実力と貢献が正当に扱われることを大切にしやすい傾向があります。",
    expression: "取りたい結果への熱量を内側に保ち、表へ出す前に状況を見極めやすい出し方です。",
    protects: "自分の価値を不用意に下げず、確かな形で結果を示せる機会を守ろうとしやすい人です。",
    impression: "穏やかで競争心が薄い人に見られ、内側の狙いは気づかれにくいでしょう。",
    misunderstanding: "希望を言葉にしないため、結果への関心が低いと誤解される可能性があります。",
    strength: "熱量をすぐに消費せず、必要な場面へ集中して結果で示せることが強みです。",
    friction: "欲しい立場や評価を伝えないまま、悔しさだけを内側へ残すことがあります。",
    action: "次に譲ろうとした場面で、希望する結果だけを一文で伝えてください。",
    observation: "熱量を全部見せなくても、希望が相手へ伝わったかを観察してください。",
  },
  "win:adaptive": {
    characterName: "魔術師",
    headline: "勝ち方をひとつに決めず、その場で最適な一手を生み出す人。",
    coreDesire: "自分の力で状況を動かし、望む結果をつかみたい。",
    expressionDescription: "相手や環境を読み、使う力や立ち位置を柔軟に切り替えて結果へつなげる。",
    core: "結果を取りにいける立場と、無駄に自分の価値を下げないことの両方を大切にしやすい傾向があります。",
    expression: "相手、場面、見通しを見ながら、前へ出るか全体を見るかを選び分ける出し方です。",
    protects: "取りにいく価値のある結果と、力を使う場面を自分で選べる余地を守ろうとしやすい人です。",
    impression: "慎重な観察役にも、強く前へ出る推進役にも見られやすいでしょう。",
    misunderstanding: "場面で積極性が変わるため、判断基準が一定しないと誤解される可能性があります。",
    strength: "状況を読み、動く局面と待つ局面へ熱量を配分できることが強みです。",
    friction: "切り替えの基準を共有しないと、周囲には急な方針変更に見えることがあります。",
    action: "次に前へ出るか迷った場面で、動く条件を一つ言葉にしてください。",
    observation: "切り替えの理由を共有したことで、周囲が判断を追いやすくなったかを観察してください。",
  },
  "connect:outward": {
    characterName: "太陽",
    headline: "自分が心から楽しむことで、いつの間にか周りまで明るくしている人。",
    coreDesire: "人の心を動かし、関係の中で特別な存在になりたい。",
    expressionDescription: "感情や魅力を素直に表し、場全体へ熱や明るさを広げていく。",
    core: "関係の温度が保たれ、自分の働きかけに反応が返ることを大切にしやすい傾向があります。",
    expression: "会いたい、話したい、反応がほしいという気持ちを、言葉や態度へ出しやすい出し方です。",
    protects: "人とのつながりと、互いの反応が行き来する状態を守ろうとしやすい人です。",
    impression: "親しみやすく、場を明るくできる人として見られやすいでしょう。",
    misunderstanding: "場を保つ働きかけが自然なため、本人の疲れは見逃される可能性があります。",
    strength: "反応を返し、関係が動き始める入口を作れることが強みです。",
    friction: "場の温度を整えることへ集中し、自分の希望を後回しにすることがあります。",
    action: "次に場を整えるとき、自分の希望も一文だけ添えてください。",
    observation: "関係を保ちながら、自分の希望も場に残せたかを観察してください。",
  },
  "connect:inward": {
    characterName: "恋人",
    headline: "広く好かれることより、大切な相手と深く結ばれたい人。",
    coreDesire: "人の心を動かし、関係の中で特別な存在になりたい。",
    expressionDescription: "少人数との信頼を丁寧に育て、互いに深く理解し合える関係を築く。",
    core: "大切な人とのつながりと、自分から求めたことで関係が崩れないことを大切にしやすい傾向があります。",
    expression: "関わりたい気持ちを内側で育て、相手へ見せる前に慎重になりやすい出し方です。",
    protects: "つながりを失わないことと、自分だけが傷つく状況を避けることを守ろうとしやすい人です。",
    impression: "一人でも平気で、人を強く求めない人に見られやすいでしょう。",
    misunderstanding: "静かに待つため、関係への期待や寂しさがないと誤解される可能性があります。",
    strength: "相手の余地を尊重しながら、関係を急がず大切にできることが強みです。",
    friction: "相手の反応を待つうちに、関わりたい気持ちが伝わらないことがあります。",
    action: "次に連絡を迷ったとき、短い問いかけを一件だけ送ってください。",
    observation: "大きく求めなくても、関係へ小さな入口を作れたかを観察してください。",
  },
  "connect:adaptive": {
    characterName: "節制",
    headline: "相手に合わせて温度を変えながら、人と人の間に心地よい流れを作る人。",
    coreDesire: "人の心を動かし、関係の中で特別な存在になりたい。",
    expressionDescription: "相手や場の空気を読み、距離感や役割を調整しながら自然につながりを作る。",
    core: "つながりを保つことと、関係の中で一人だけ傷つかないことの両方を大切にしやすい傾向があります。",
    expression: "相手との距離や反応を見ながら、自分から近づくか少し待つかを選び分ける出し方です。",
    protects: "関係の温度と、自分が安心して関われる距離の両方を守ろうとしやすい人です。",
    impression: "親しい相手には積極的に、距離のある相手には控えめに見られやすいでしょう。",
    misunderstanding: "相手によって関わり方が変わるため、親しさにむらがあると誤解される可能性があります。",
    strength: "関係の状態を読み、近づく量を調整できることが強みです。",
    friction: "反応を読みすぎると、自分の希望を出す機会を逃すことがあります。",
    action: "次に距離を測る場面で、自分から出せる小さな働きかけを一つ選んでください。",
    observation: "相手の反応だけでなく、自分が無理なく関われたかも観察してください。",
  },
  "analyze:outward": {
    characterName: "正義",
    headline: "曖昧な状況でも、何が事実かを切り分けて進むべき道を示す人。",
    coreDesire: "物事の仕組みを理解し、表面の奥にある答えを見つけたい。",
    expressionDescription: "集めた情報を整理し、判断基準や見通しとして周囲へ分かりやすく示す。",
    core: "納得できる情報と、自分で考えられる余白を大切にしやすい傾向があります。",
    expression: "疑問や必要な時間、任せてほしい範囲を、質問や境界線として外へ出しやすい出し方です。",
    protects: "理解できる状態と、筋道を自分で確かめられる余地を守ろうとしやすい人です。",
    impression: "整理が得意で、冷静に判断できる人として見られやすいでしょう。",
    misunderstanding: "確認を重ねる姿勢が、細かい、慎重すぎると映る可能性があります。",
    strength: "複雑な内容から筋道を見つけ、周囲にも分かる形へ整えられることが強みです。",
    friction: "理解の精度を求めるほど、相手にも同じ速度を求めることがあります。",
    action: "説明を始める前に、相手が必要とする詳しさを一度確認してください。",
    observation: "整理の深さと相手の必要量が合っていたかを観察してください。",
  },
  "analyze:inward": {
    characterName: "隠者",
    headline: "誰も気づかない違和感を、答えが見えるまで一人で追い続ける人。",
    coreDesire: "物事の仕組みを理解し、表面の奥にある答えを見つけたい。",
    expressionDescription: "静かな環境で深く考え、自分が納得できるまで答えを内側で研ぎ澄ます。",
    core: "理解できる状態と、自分のペースを崩されないことを大切にしやすい傾向があります。",
    expression: "疑問や違和感を内側で処理し、納得できるまで一人で考えやすい出し方です。",
    protects: "途中の理解を急かされず、自分の中で筋道を確かめられる時間を守ろうとしやすい人です。",
    impression: "静かに受け入れ、説明をすぐ理解できる人に見られやすいでしょう。",
    misunderstanding: "疑問を表へ出さないため、追加の説明が不要だと誤解される可能性があります。",
    strength: "一人で深く考え、表面だけでは見えない構造を見つけられることが強みです。",
    friction: "確認を持ち帰るほど、認識違いの修正が遅れることがあります。",
    action: "次に不明点が残ったら、現在の理解を一文だけ共有してください。",
    observation: "完成した質問でなくても、認識違いを早く見つけられたかを観察してください。",
  },
  "analyze:adaptive": {
    characterName: "吊るされた男",
    headline: "世界を逆さから眺めることで、誰も気づかなかった答えを見つける人。",
    coreDesire: "物事の仕組みを理解し、表面の奥にある答えを見つけたい。",
    expressionDescription: "相手や状況に応じて視点を切り替え、複数の角度から意味を読み直す。",
    core: "理解できる状態と、不十分なまま自分をさらさないことの両方を大切にしやすい傾向があります。",
    expression: "相手、立場、得意不得意を見ながら、質問するか持ち帰って考えるかを選び分ける出し方です。",
    protects: "必要な理解と、途中の考えを安心して扱える条件の両方を守ろうとしやすい人です。",
    impression: "ある場では説明役、別の場では静かな観察役に見られやすいでしょう。",
    misunderstanding: "場面で発言量が変わるため、知識や関心にむらがあると誤解される可能性があります。",
    strength: "情報量と相手を見て、質問と観察の比重を調整できることが強みです。",
    friction: "安全な条件を待ちすぎると、必要な確認が後へ回ることがあります。",
    action: "次に質問を保留するとき、持ち帰る理由と確認時期を一文で伝えてください。",
    observation: "考える時間を守りながら、相手との認識もつなげられたかを観察してください。",
  },
  "axis:outward": {
    characterName: "女帝",
    headline: "自分の「好き」を育て、周りの世界まで豊かに変えていく人。",
    coreDesire: "自分の理想や美学を、納得できる形で現実に残したい。",
    expressionDescription: "感性や価値観を外へ表現し、人や環境へ広げながら新しい価値を育てる。",
    core: "自分の基準と行動が食い違わず、意味のある形へ近づくことを大切にしやすい傾向があります。",
    expression: "大切にする基準や目指す形を、言葉や提案として外へ出しやすい出し方です。",
    protects: "意味のある方向と、自分の基準が現実へ反映される状態を守ろうとしやすい人です。",
    impression: "方向性を示し、質を上げる人として見られやすいでしょう。",
    misunderstanding: "改善への熱量が、正しさや完成度を求める評価に映る可能性があります。",
    strength: "曖昧だった基準を言葉にし、理想を改善案へ変えられることが強みです。",
    friction: "完成像へ集中するほど、現在ある良さが相手へ伝わりにくくなることがあります。",
    action: "改善案の前に、残したい良さを一つ伝えてください。",
    observation: "基準を下げずに、相手が改善へ参加しやすくなったかを観察してください。",
  },
  "axis:inward": {
    characterName: "星",
    headline: "まだ誰にも見えていない理想を、現実になるまで静かに守り続ける人。",
    coreDesire: "自分の理想や美学を、納得できる形で現実に残したい。",
    expressionDescription: "理想を内側で丁寧に育て、妥協せず完成度を高めてから外へ表す。",
    core: "自分の基準や意味を失わず、外へ出したことで関係が崩れないことを大切にしやすい傾向があります。",
    expression: "理想や違和感を内側に保ち、語る前に周囲との関係を見極めやすい出し方です。",
    protects: "大切な基準と、それを否定されずに保てる内側の領域を守ろうとしやすい人です。",
    impression: "柔軟で周囲に合わせられる人として見られやすいでしょう。",
    misunderstanding: "基準を語らないため、こだわりや目指す方向がないと誤解される可能性があります。",
    strength: "周囲の流れに飲まれず、大切な基準を長く保てることが強みです。",
    friction: "違和感を伝えないまま、意味を感じられない状態から静かに離れることがあります。",
    action: "次に納得できない場面で、残したい基準を一つだけ伝えてください。",
    observation: "理想をすべて説明しなくても、大切な核を共有できたかを観察してください。",
  },
  "axis:adaptive": {
    characterName: "運命の輪",
    headline: "大切なものは変えずに、届く形へ何度でも自分を更新できる人。",
    coreDesire: "自分の理想や美学を、納得できる形で現実に残したい。",
    expressionDescription: "自分の核を保ちながら、環境や時代に合わせて形や表現方法を変えていく。",
    core: "自分らしさや意味を失わず、現実の中で理想を生き残らせることを大切にしやすい傾向があります。",
    expression: "相手、場面、テーマの重要度を見ながら、基準を語るか内側で保つかを選び分ける出し方です。",
    protects: "譲れない核と、理想を現実へつなぐための柔軟さの両方を守ろうとしやすい人です。",
    impression: "重要な場面では強く、その他では柔軟な人として見られやすいでしょう。",
    misunderstanding: "譲る範囲が場面で変わるため、基準が都合よく変わると誤解される可能性があります。",
    strength: "重要度を見分け、守る核と調整できる部分を分けられることが強みです。",
    friction: "何を重要と判断したかを共有しないと、急に譲らなくなったように映ることがあります。",
    action: "次に基準を示すとき、譲れない点と調整できる点を一つずつ伝えてください。",
    observation: "理想を守りながら、現実的な合意へ近づけたかを観察してください。",
  },
};

const TYPE_FOCUS: Record<TypeId, { coreFocus: string; protectedFocus: string }> = {
  win: { coreFocus: "結果と貢献が正当に扱われること", protectedFocus: "自分で流れを動かせる立場" },
  connect: { coreFocus: "関係の温度と反応が行き来すること", protectedFocus: "安心して人とつながれる距離" },
  analyze: { coreFocus: "情報や構造を理解できること", protectedFocus: "自分のペースで考えられる余地" },
  axis: { coreFocus: "意味や基準と行動が一致すること", protectedFocus: "大切な理想を現実へ残せること" },
};

const DOMAIN_FOCUS: Record<LabelTemplateKey, { relationshipPossibility: string; workPossibility: string }> = {
  "win:outward": { relationshipPossibility: "関係場面では、結論を前へ進める働きかけが頼もしさとして伝わる可能性があります。", workPossibility: "仕事場面では、停滞時に決断を引き受ける力が表れる可能性があります。" },
  "win:inward": { relationshipPossibility: "関係場面では、表に出さない熱量が相手からは落ち着きとして見える可能性があります。", workPossibility: "仕事場面では、狙いを内側で練り、必要な局面で結果として示す力が表れる可能性があります。" },
  "win:adaptive": { relationshipPossibility: "関係場面では、相手と状況を見て主導する量を変える可能性があります。", workPossibility: "仕事場面では、動く局面と待つ局面を選び、熱量を配分する力が表れる可能性があります。" },
  "connect:outward": { relationshipPossibility: "関係場面では、自分から反応を返し、交流の入口を作る可能性があります。", workPossibility: "仕事場面では、周囲の反応を拾い、協力しやすい温度を作る力が表れる可能性があります。" },
  "connect:inward": { relationshipPossibility: "関係場面では、相手の余地を尊重しながら静かに関わりを保つ可能性があります。", workPossibility: "仕事場面では、周囲の状態を見ながら必要な支えを目立たない形で続ける可能性があります。" },
  "connect:adaptive": { relationshipPossibility: "関係場面では、相手との距離を見て近づき方を調整する可能性があります。", workPossibility: "仕事場面では、相手の反応に合わせて声のかけ方や協力の量を変える可能性があります。" },
  "analyze:outward": { relationshipPossibility: "関係場面では、疑問を言葉にして認識のずれを整える可能性があります。", workPossibility: "仕事場面では、複雑な情報を整理し、判断できる形へ変える力が表れる可能性があります。" },
  "analyze:inward": { relationshipPossibility: "関係場面では、すぐに答えず、一度考えてから丁寧に応じる可能性があります。", workPossibility: "仕事場面では、表に出る前に情報を深く検討し、構造を見つける力が表れる可能性があります。" },
  "analyze:adaptive": { relationshipPossibility: "関係場面では、質問する時と静かに観察する時を選び分ける可能性があります。", workPossibility: "仕事場面では、情報量と状況を見て、確認と持ち帰りを切り替える可能性があります。" },
  "axis:outward": { relationshipPossibility: "関係場面では、大切にしたい基準を言葉にし、より良い形を提案する可能性があります。", workPossibility: "仕事場面では、曖昧な基準を言語化し、改善の方向を示す力が表れる可能性があります。" },
  "axis:inward": { relationshipPossibility: "関係場面では、大切な基準を内側に保ちながら、相手との調和を優先する可能性があります。", workPossibility: "仕事場面では、表立って主張せずとも、意味や品質の基準を長く保つ可能性があります。" },
  "axis:adaptive": { relationshipPossibility: "関係場面では、重要な価値だけを選んで伝え、それ以外は柔軟に調整する可能性があります。", workPossibility: "仕事場面では、守る基準と調整できる部分を分け、理想を現実へつなぐ可能性があります。" },
};

export const LABEL_TEMPLATES = Object.fromEntries(
  (Object.keys(LABEL_TEMPLATE_COPY) as LabelTemplateKey[]).map((key) => {
    const type = key.split(":")[0] as TypeId;
    return [key, { ...LABEL_TEMPLATE_COPY[key], ...TYPE_FOCUS[type], ...DOMAIN_FOCUS[key] }];
  }),
) as Record<LabelTemplateKey, LabelReportTemplate>;

export interface ConditionTemplate {
  energizing: [string, string] | [string, string, string];
  blocking: [string, string] | [string, string, string];
}

export const CONDITION_TEMPLATES: Record<LabelTemplateKey, ConditionTemplate> = {
  "win:outward": {
    energizing: ["目標と任せる範囲が見え、判断を動かせる余地があるとき", "取り組みの結果が共有され、次の一手を選べるとき"],
    blocking: ["目的や評価の基準が見えないまま、結論だけを急がれるとき", "前へ進める意図を示す余地がないとき"],
  },
  "win:inward": {
    energizing: ["結果を出すまでの準備を自分のペースで整えられるとき", "貢献を確かな形で示す時間と役割があるとき"],
    blocking: ["期待される結果だけが先に置かれ、考える余地がないとき", "希望や狙いを言葉にしないまま判断を任されるとき"],
  },
  "win:adaptive": {
    energizing: ["動く局面と待つ局面を自分で選べるとき", "周囲の見通しを確かめながら、力を使う場所を決められるとき"],
    blocking: ["切り替える理由を共有できず、判断だけを急がれるとき", "状況の変化に合わせて役割を選び直せないとき"],
  },
  "connect:outward": {
    energizing: ["働きかけに反応が返り、関係の温度を確かめられるとき", "人と協力する入口を自分から作れるとき"],
    blocking: ["周囲の反応を整える役割だけを抱え続けるとき", "自分の希望を伝える余地なく、関係の維持を急がれるとき"],
  },
  "connect:inward": {
    energizing: ["相手の余地を尊重しながら、関わる量を選べるとき", "急がずに関係を育てる時間があるとき"],
    blocking: ["反応を待つだけで、自分の気持ちを確かめる機会がないとき", "関係を急いで決めることを求められるとき"],
  },
  "connect:adaptive": {
    energizing: ["相手との距離や反応に合わせて、近づき方を調整できるとき", "無理のない関わり方を選び直せるとき"],
    blocking: ["関わり方を切り替える理由を説明できないとき", "相手の反応だけを基準に、距離を決め続けるとき"],
  },
  "analyze:outward": {
    energizing: ["必要な情報を確かめ、疑問を言葉にできるとき", "複雑な内容を整理して、判断できる形に変えられるとき"],
    blocking: ["確認に必要な情報がないまま、即答を求められるとき", "整理の深さを共有できず、結論だけを急がれるとき"],
  },
  "analyze:inward": {
    energizing: ["考えるための静かな余地と、自分のペースが保たれるとき", "理解した内容を十分に確かめてから示せるとき"],
    blocking: ["分からなさを抱えたまま、すぐに答えを出すことを求められるとき", "考える時間を取れず、判断の根拠を整えられないとき"],
  },
  "analyze:adaptive": {
    energizing: ["確認して進む場面と、いったん動く場面を選べるとき", "情報量に合わせて、質問や持ち帰りを調整できるとき"],
    blocking: ["考える量を切り替える基準を共有できないとき", "必要な確認と行動の速さを両立できないとき"],
  },
  "axis:outward": {
    energizing: ["大切にしたい基準を言葉にし、改善の方向を示せるとき", "譲れない点と調整できる点を分けて提案できるとき"],
    blocking: ["意味や基準を確かめないまま、形だけを合わせることを求められるとき", "違和感を示す余地なく、方針への同意を急がれるとき"],
  },
  "axis:inward": {
    energizing: ["大切な基準を内側に保ちながら、納得できる形を考えられるとき", "意味や品質を確かめる時間があるとき"],
    blocking: ["納得できない方針へ合わせることを急がれるとき", "大切にしたい基準を伝えないまま調整を続けるとき"],
  },
  "axis:adaptive": {
    energizing: ["守る基準と柔軟に調整する部分を選べるとき", "状況に合わせて、重要な価値だけを言葉にできるとき"],
    blocking: ["何を守り何を調整するかを決められないとき", "基準を切り替える理由を共有できないとき"],
  },
};

function mediumCopy(text: string): string {
  return text
    .replace(/(.+)ことが強みです。$/, "$1傾向が比較的見られました。")
    .replace(/見られやすいでしょう。$/, "見られやすい傾向が比較的示されています。")
    .replace(/傾向があります。$/, "傾向が比較的見られました。")
    .replace(/出し方です。$/, "出し方が比較的見られました。")
    .replace(/人です。$/, "特徴が比較的見られました。")
    .replace(/ことがあります。$/, "傾向が比較的見られました。")
    .replace(/可能性があります。$/, "可能性が考えられます。");
}

function lowCopy(text: string): string {
  return text
    .replace(/(.+)ことが強みです。$/, "場面によって、$1力が表れる可能性があります。")
    .replace(/見られやすいでしょう。$/, "見られやすい可能性があります。")
    .replace(/傾向があります。$/, "傾向が場面によって表れる可能性があります。")
    .replace(/出し方です。$/, "出し方になる可能性があります。")
    .replace(/人です。$/, "特徴が表れる可能性があります。")
    .replace(/ことがあります。$/, "ことがあるかもしれません。")
    .replace(/です。$/, "可能性があります。")
    .replace(/でしょう。$/, "可能性があります。");
}

export function confidenceCopies(text: string): ConfidenceCopy {
  return {
    high: text,
    medium: `今回の回答では、${mediumCopy(text)}`,
    low: `今回確認できた範囲では、${lowCopy(text)}`,
  };
}

export function renderLabelCopy(template: LabelReportTemplate, field: ConfidenceCopyField, confidence: Confidence): string {
  return confidenceCopies(template[field])[confidence];
}

export const ANSWER_PUNCH_LEADS: Record<TypeId, string> = {
  win: "結果だけでなく",
  connect: "目の前の選択だけでなく",
  analyze: "結論だけでなく",
  axis: "その場を収めることだけでなく",
};

export function labelTemplate(type: TypeId, expression: ExpressionId): LabelReportTemplate {
  return LABEL_TEMPLATES[`${type}:${expression}`];
}

export function conditionTemplate(type: TypeId, expression: ExpressionId): ConditionTemplate {
  return CONDITION_TEMPLATES[`${type}:${expression}`];
}

export function characterNameFor(type: TypeId, expression: ExpressionId): string {
  return labelTemplate(type, expression).characterName;
}

export function characterDisplayCopyForLabel(label: string): CharacterDisplayCopy | undefined {
  for (const [key, template] of Object.entries(LABEL_TEMPLATES) as Array<[LabelTemplateKey, LabelReportTemplate]>) {
    const [type, expression] = key.split(":") as [TypeId, ExpressionId];
    const legacyLabel = `${TYPE_LABELS[type]}・${EXPRESSION_LABELS[expression]}`;
    if (label === template.characterName || label === legacyLabel) {
      const { characterName, headline, coreDesire, expressionDescription } = template;
      return { type, expression, characterName, headline, coreDesire, expressionDescription };
    }
  }
  return undefined;
}

export function resolvedLabel(type: TypeId, expression: ExpressionId): string {
  return characterNameFor(type, expression);
}

export function resolvedSubtitle(type: TypeId, expression: ExpressionId): string {
  return labelTemplate(type, expression).expressionDescription;
}
