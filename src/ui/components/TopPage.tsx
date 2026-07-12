import { useState } from "react";
import { ShareButton } from "./ShareButton";

interface TopPageProps {
  hasSavedProgress: boolean;
  onStart: () => void;
  onResume: () => void;
  onRestart: () => void;
}

export function TopPage({ hasSavedProgress, onStart, onResume, onRestart }: TopPageProps) {
  const [revealInner, setRevealInner] = useState(false);
  return <section className="screen active" id="home">
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"/>INNER NOTE</div>
        <div className="header-actions"><ShareButton/><button className="linkbtn" onClick={onStart}>診断を始める</button></div>
      </header>
      <main className="hero">
        <div>
          <div className="kicker">Public self / Private self</div>
          <h1>人に見せている私と、<br/>本当の私のあいだ。</h1>
          <p>性格だけでは説明できなかった、あなたの求め方と反応のくせ。<br/>人前の自分と、心の奥で動いている自分の違いまで読み解きます。</p>
          <div className="actions">{hasSavedProgress ? <><button className="primary" onClick={onResume}>診断を続ける</button><button className="secondary" onClick={onRestart}>最初からやり直す</button></> : <><button className="primary" onClick={onStart}>無料で診断する</button><button className="secondary" onClick={() => document.getElementById("value")?.scrollIntoView()}>この診断でわかること</button></>}</div>
          <div className="note">約10分前後・途中保存対応</div>
          {hasSavedProgress && <div className="resume-banner show"><strong>前回の診断が途中で保存されています。</strong><div>同じブラウザから、未回答の続きへ戻れます。</div></div>}
        </div>
        <div className={revealInner ? "social-stage reveal" : "social-stage"} id="socialStage">
          <div className="float-note fn1">人には、こう見えている</div><div className="float-note fn2">でも本当は、どうしたい？</div><div className="float-note fn3">そのズレに、理由がある</div>
          <article className="private-card"><div className="private-label">PRIVATE NOTE</div><div className="private-title">まだ誰にも見せていない、<br/>本当の気持ち。</div><Memo label="本当に求めていること" text="自分で納得して、選びたい。"/><Memo label="傷ついたとき" text="分かってもらえないと、急に距離を置く。"/><Memo label="今の自分" text="我慢ではなく、理解されることを求めている。"/></article>
          <article className="public-card"><div className="profile-top"><div className="avatar"/><div><div className="handle">@my_public_self</div><div className="sub">人に見せている自分</div></div></div><div className="public-bio">しっかりしている。<br/>冷静で、周りを見て動ける。<br/>あまり感情を表に出さない。</div><div className="feed-grid"><div className="tile">頼られる<br/>ことが多い</div><div className="tile">自分のことは<br/>後回し</div><div className="tile">平気そうに<br/>見られる</div></div><div className="social-bar"><span>♡</span><span>◇</span><span>↗</span><span>□</span></div></article>
          <button className="reveal-btn" aria-pressed={revealInner} onClick={() => setRevealInner((value) => !value)}>{revealInner ? "人に見せている自分を見る" : "本当の自分を見る"}</button>
        </div>
      </main>
      <section id="value" className="value-section"><div className="section-head"><div className="kicker">Not only personality</div><h2>わかるのは、性格だけではありません。</h2><p>人間関係から仕事での判断まで、あなたの反応を行動パターンとして整理します。</p></div><div className="value-grid"><ValueCard icon="◎" title="人間関係" text="なぜ同じ相手や場面で疲れるのか。距離の取り方や満たされ方を見つけます。"/><ValueCard icon="□" title="仕事" text="力を発揮しやすい環境と、無理が積み重なる条件を整理します。"/><ValueCard icon="◇" title="ストレス反応" text="傷ついたときにどう変わるのか。防衛の出方と立て直し方を見つけます。"/><ValueCard icon="↗" title="意思決定" text="迷うとき、急ぐとき、譲れないとき。選択を動かす基準を読み解きます。"/></div></section>
      <section className="feature-section"><div className="section-head"><div className="kicker">What this diagnosis reads</div><h2>あなたの内側を、4つの視点から読む。</h2></div><div className="feature-grid"><FeatureCard no="01 / INNER MOTIVE" title="あなたを動かしているもの" text="何を求めて選び、どんなときに強く反応するのかを整理します。"/><FeatureCard no="02 / PUBLIC SELF" title="人に見せている自分" text="周囲に合わせる中で、どんな自分を表に出しやすいかを読み取ります。"/><FeatureCard no="03 / GAP" title="本音とのズレ" text="内側で求めていることと、実際の振る舞いが離れやすい場面を見つけます。"/><FeatureCard no="04 / DEFENSE" title="心を守るときの反応" text="傷ついたときや追い込まれたときに出やすい防衛パターンを整理します。"/></div></section>
      <section className="cta-section"><h2>まだ言葉になっていない自分を、見つける。</h2><p>約10分前後。途中から再開できます。</p><div className="actions"><button className="primary" onClick={onStart}>無料で診断する</button></div></section>
      <div className="cta-share-below"><ShareButton className="secondary" label="↗ シェアする"/></div>
      <footer className="footer"><div className="footer-inner"><div className="brand"><span className="brand-mark"/>INNER NOTE</div><div className="footer-links"><a href="#">利用規約</a><a href="#">プライバシーポリシー</a><a href="#">診断に関する注意事項</a><a href="#">お問い合わせ</a></div><div>© INNER NOTE</div></div></footer>
    </div>
  </section>;
}

function Memo({ label, text }: { label: string; text: string }) { return <div className="memo"><small>{label}</small><strong>{text}</strong></div>; }
function ValueCard({ icon, title, text }: { icon: string; title: string; text: string }) { return <article className="value-card"><div className="icon-wrap">{icon}</div><h3>{title}</h3><p>{text}</p></article>; }
function FeatureCard({ no, title, text }: { no: string; title: string; text: string }) { return <article className="feature-card"><div className="num">{no}</div><h3>{title}</h3><p>{text}</p></article>; }
