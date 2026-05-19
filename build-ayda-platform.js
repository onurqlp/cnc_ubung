const fs = require("fs");
const path = require("path");

const workspace = process.cwd();
const statePath = path.join(process.env.USERPROFILE || "", ".codex", ".codex-global-state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const history =
  state["electron-persisted-atom-state"]?.["prompt-history"]?.["new-conversation"] || [];

const sourcePrompt = [...history]
  .reverse()
  .find((item) => item.includes("CNC Mesleki Almanca Kelime Platformu") && item.includes("const vocabulary"));

if (!sourcePrompt) {
  throw new Error("Original AYDA HTML prompt could not be found in local prompt history.");
}

function extractHtml(prompt) {
  const start = prompt.search(/<!doctype html>/i);
  const end = prompt.search(/<\/html>/i);
  if (start < 0 || end < 0) throw new Error("Could not locate full HTML in prompt.");
  return prompt.slice(start, end + "</html>".length);
}

function extractArray(source, name) {
  const anchor = `const ${name} =`;
  const idx = source.indexOf(anchor);
  if (idx < 0) throw new Error(`Could not find ${name}.`);
  const start = source.indexOf("[", idx);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not parse ${name} array.`);
}

const originalHtml = extractHtml(sourcePrompt);
const topics = JSON.parse(extractArray(originalHtml, "topics"));
const rawVocabulary = JSON.parse(extractArray(originalHtml, "vocabulary"));
const rawExercises = JSON.parse(extractArray(originalHtml, "exercises"));

const pronunciationOverrides = new Map([
  ["der Betriebsunfall", "dea Betriibs-unfal"],
  ["die Berufserkrankung", "dii Berufz-erkrankung"],
  ["das Gebotszeichen", "das Geboots-tsayhın"],
  ["der Messschieber", "dea Mess-şiibır"],
  ["die Schutzausrüstung", "dii Şuts-aus-rüstung"],
  ["schlichten", "şlihtın"],
  ["schruppen", "şrupın"],
  ["Fräsen", "freezın"],
  ["das Fräsen", "das freezın"],
  ["Drehen", "dreeın"],
  ["das Drehen", "das dreeın"],
  ["die Gefahr", "dii Gefaar"],
  ["die Vorschrift", "dii Foğşrift"],
  ["der Fertigungsauftrag", "dea Fertigungs-auftraag"],
  ["die Kreissäge", "dii Krays-zeege"],
  ["die Fläche", "dii Flehe"],
  ["die Nut", "dii Nuut"],
  ["der Winkel", "dea Vinkel"],
  ["anreißen", "an-raysın"],
  ["die Bandsäge", "dii Bant-zeege"],
]);

function pronounceToken(token) {
  if (!token) return "";
  const direct = pronunciationOverrides.get(token);
  if (direct) return direct;

  const keep = token.match(/^[0-9.,/+\-·=()Ø°κγεπA-Z]+$/);
  if (keep) return token;

  let out = token;
  const leading = out.match(/^[([{"]+/)?.[0] || "";
  const trailing = out.match(/[)\]}".,;:!?]+$/)?.[0] || "";
  if (leading) out = out.slice(leading.length);
  if (trailing) out = out.slice(0, -trailing.length);

  const article = { der: "dea", die: "dii", das: "das" }[out.toLowerCase()];
  if (article) return leading + article + trailing;

  const wasCapitalized = /^[A-ZÄÖÜ]/.test(out);
  out = out.toLowerCase();
  out = out
    .replace(/äu/g, "oy")
    .replace(/eu/g, "oy")
    .replace(/ei/g, "ay")
    .replace(/ie/g, "ii")
    .replace(/au/g, "au")
    .replace(/sch/g, "ş")
    .replace(/tsch/g, "ç")
    .replace(/\bst/g, "şt")
    .replace(/\bsp/g, "şp")
    .replace(/ch/g, "h")
    .replace(/ck/g, "k")
    .replace(/ph/g, "f")
    .replace(/qu/g, "kv")
    .replace(/z/g, "ts")
    .replace(/w/g, "v")
    .replace(/v/g, "f")
    .replace(/j/g, "y")
    .replace(/ß/g, "s")
    .replace(/ä/g, "e")
    .replace(/ö/g, "ö")
    .replace(/ü/g, "ü")
    .replace(/c/g, "k")
    .replace(/th/g, "t")
    .replace(/tion\b/g, "tsiyon")
    .replace(/ung\b/g, "ung")
    .replace(/er\b/g, "ır")
    .replace(/en\b/g, "ın")
    .replace(/e\b/g, "e")
    .replace(/h([aeiouöü])/g, "$1")
    .replace(/aa/g, "aa")
    .replace(/ee/g, "ee")
    .replace(/oo/g, "oo");

  if (wasCapitalized && out) out = out[0].toUpperCase() + out.slice(1);
  return leading + out + trailing;
}

function pronounceGermanText(text) {
  if (!text) return "";
  const direct = pronunciationOverrides.get(text);
  if (direct) return direct;
  return String(text)
    .split(/(\s+|[-/])/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === "-" || part === "/") return part;
      return pronounceToken(part);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

const vocabulary = rawVocabulary.map((word) => ({
  ...word,
  pronunciationTr: pronunciationOverrides.get(word.german) || pronounceGermanText(word.german),
  examplePronunciationTr: word.exampleDe ? pronounceGermanText(word.exampleDe) : "",
}));

const exercises = rawExercises.map((exercise) => ({
  ...exercise,
  questionPronunciationTr: exercise.questionDe ? pronounceGermanText(exercise.questionDe) : "",
  answerPronunciationTr: exercise.answerDe ? pronounceGermanText(exercise.answerDe) : "",
}));

for (const word of vocabulary) {
  if (!word.pronunciationTr) throw new Error(`Missing pronunciation for word id ${word.id}`);
  if (word.exampleDe && !word.examplePronunciationTr) {
    throw new Error(`Missing example pronunciation for word id ${word.id}`);
  }
}

const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AYDA Dil Akademisi | CNC Mesleki Almanca Kelime Platformu</title>
  <meta name="description" content="Türk CNC uzmanları için Almanca teknik sözlük, kelime kartları ve alıştırmalar.">
  <style>
    :root {
      --navy:#234078;
      --navy-dark:#162B55;
      --blue-soft:#EAF1FF;
      --red:#C92032;
      --gold:#F2B705;
      --white:#FFFFFF;
      --bg:#F5F7FA;
      --text:#1F2937;
      --muted:#667085;
      --line:#D8DEE9;
      --green:#16803C;
      --green-soft:#E8F7EE;
      --red-soft:#FCECEF;
      --shadow:0 14px 32px rgba(22,43,85,.12);
      --radius:8px;
    }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
      margin:0;
      font-family:Poppins, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color:var(--text);
      background:var(--bg);
      line-height:1.5;
    }
    button,input,select { font:inherit; }
    button { cursor:pointer; }
    a { color:inherit; }
    .wrap { width:min(1180px, calc(100% - 32px)); margin:0 auto; }
    .hero {
      color:var(--white);
      background:
        linear-gradient(135deg, rgba(22,43,85,.98), rgba(35,64,120,.94)),
        repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 72px),
        repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 72px);
      position:relative;
      overflow:hidden;
    }
    .hero:after {
      content:"";
      position:absolute;
      right:0;
      bottom:0;
      width:min(58vw,620px);
      height:44%;
      background:
        linear-gradient(135deg, transparent 0 30%, rgba(242,183,5,.95) 30% 44%, transparent 44%),
        linear-gradient(135deg, transparent 0 52%, rgba(201,32,50,.92) 52% 66%, transparent 66%);
      pointer-events:none;
    }
    .topbar {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:16px;
      padding:18px 0;
      position:relative;
      z-index:2;
    }
    .brand { display:flex; align-items:center; gap:12px; font-weight:900; }
    .brand-mark {
      width:42px;
      height:42px;
      display:grid;
      place-items:center;
      border:2px solid rgba(255,255,255,.8);
      background:rgba(255,255,255,.1);
      border-radius:var(--radius);
      color:var(--gold);
    }
    .top-links { display:flex; flex-wrap:wrap; gap:14px; color:rgba(255,255,255,.88); font-size:14px; }
    .top-links a { text-decoration:none; border-bottom:1px solid rgba(255,255,255,.25); }
    .hero-content { padding:34px 0 56px; position:relative; z-index:1; max-width:850px; }
    .eyebrow {
      display:inline-flex;
      align-items:center;
      gap:10px;
      padding:7px 11px;
      border:1px solid rgba(255,255,255,.28);
      border-radius:999px;
      background:rgba(255,255,255,.09);
      font-size:13px;
      font-weight:800;
      margin-bottom:14px;
    }
    .eyebrow:before { content:""; width:9px; height:9px; background:var(--gold); border-radius:50%; }
    h1 {
      font-size:clamp(34px,5vw,58px);
      line-height:1.04;
      margin:0 0 14px;
      max-width:850px;
      letter-spacing:0;
    }
    .hero-subtitle { font-size:clamp(17px,2.2vw,22px); color:rgba(255,255,255,.92); margin:0 0 10px; max-width:780px; }
    .hero-note { color:rgba(255,255,255,.84); max-width:760px; margin:0; }
    main { margin-top:-28px; position:relative; z-index:3; }
    section { margin:24px 0; }
    .panel {
      background:var(--white);
      border:1px solid rgba(216,222,233,.9);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:clamp(18px,3vw,28px);
    }
    .home-layout { display:grid; grid-template-columns:minmax(0,1fr); gap:18px; }
    .section-head {
      display:flex;
      justify-content:space-between;
      align-items:flex-end;
      gap:16px;
      margin-bottom:16px;
    }
    .section-head h2 { margin:0; color:var(--navy-dark); font-size:clamp(22px,3vw,32px); line-height:1.15; }
    .section-head p { margin:6px 0 0; color:var(--muted); }
    .simple-help {
      background:var(--blue-soft);
      border-left:5px solid var(--gold);
      border-radius:var(--radius);
      padding:15px;
      font-weight:700;
      color:var(--navy-dark);
    }
    .stats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
    .stat-card {
      background:var(--white);
      border:1px solid var(--line);
      border-left:5px solid var(--navy);
      border-radius:var(--radius);
      padding:18px;
      min-height:112px;
      display:grid;
      align-content:space-between;
    }
    .stat-card:nth-child(2) { border-left-color:var(--gold); }
    .stat-card:nth-child(3) { border-left-color:var(--green); }
    .stat-card:nth-child(4) { border-left-color:var(--red); }
    .stat-label { color:var(--muted); font-weight:800; font-size:13px; }
    .stat-value { font-size:clamp(28px,4vw,42px); color:var(--navy-dark); font-weight:900; line-height:1; }
    .controls { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:end; }
    .dictionary-controls { display:grid; grid-template-columns:1.2fr .8fr auto; gap:12px; align-items:end; margin-bottom:16px; }
    .field label { display:block; font-size:14px; font-weight:900; color:var(--navy-dark); margin-bottom:7px; }
    .input,.select {
      width:100%;
      min-height:52px;
      border:1px solid var(--line);
      background:var(--white);
      border-radius:var(--radius);
      padding:12px 13px;
      color:var(--text);
      outline:none;
      font-size:16px;
    }
    .input:focus,.select:focus { border-color:var(--navy); box-shadow:0 0 0 3px rgba(35,64,120,.14); }
    .switch {
      min-height:52px;
      display:flex;
      align-items:center;
      gap:10px;
      border:1px solid var(--line);
      border-radius:var(--radius);
      padding:11px 13px;
      font-weight:900;
      color:var(--navy-dark);
      background:var(--blue-soft);
    }
    .switch input { width:20px; height:20px; accent-color:var(--navy); }
    .selected-pool {
      margin-top:14px;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:10px 12px;
      border-radius:var(--radius);
      background:#FFF7DF;
      border:1px solid rgba(242,183,5,.45);
      color:#7A5600;
      font-weight:900;
    }
    .mode-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
    .mode-card {
      min-height:172px;
      border:1px solid var(--line);
      background:var(--white);
      border-radius:var(--radius);
      padding:18px;
      text-align:left;
      display:grid;
      align-content:space-between;
      gap:14px;
      transition:border .15s ease, transform .15s ease, box-shadow .15s ease;
    }
    .mode-card:hover { border-color:var(--navy); transform:translateY(-2px); box-shadow:0 12px 24px rgba(22,43,85,.11); }
    .mode-card h3 { margin:0; color:var(--navy-dark); font-size:20px; line-height:1.18; }
    .mode-card p { margin:8px 0 0; color:var(--muted); font-weight:700; }
    .btn {
      min-height:48px;
      border:0;
      border-radius:var(--radius);
      padding:12px 17px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      font-weight:900;
      color:var(--white);
      background:var(--navy);
      transition:transform .15s ease, background .15s ease;
      text-decoration:none;
      box-shadow:0 8px 18px rgba(22,43,85,.16);
    }
    .btn:hover { background:var(--navy-dark); transform:translateY(-1px); }
    .btn:disabled { opacity:.55; cursor:not-allowed; transform:none; }
    .btn.secondary { background:var(--blue-soft); color:var(--navy); box-shadow:none; }
    .btn.secondary:hover { background:#DDE9FF; }
    .btn.red { background:var(--red); }
    .btn.gold { background:var(--gold); color:var(--navy-dark); }
    .btn.good { background:var(--green); }
    .btn.small { min-height:40px; padding:9px 12px; font-size:14px; }
    .view { display:none; }
    .view.active { display:block; }
    .study-shell { display:grid; gap:18px; }
    .study-top {
      background:var(--white);
      border:1px solid rgba(216,222,233,.9);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:18px;
      display:grid;
      gap:14px;
    }
    .study-title-row { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
    .study-title-row h2 { margin:0 0 6px; color:var(--navy-dark); font-size:clamp(24px,3.3vw,36px); }
    .study-title-row p { margin:0; color:var(--muted); font-weight:700; max-width:760px; }
    .study-actions { display:flex; flex-wrap:wrap; gap:10px; justify-content:flex-end; }
    .progress-pills { display:flex; flex-wrap:wrap; gap:9px; }
    .pill {
      display:inline-flex;
      align-items:center;
      gap:7px;
      padding:7px 10px;
      border-radius:999px;
      background:var(--blue-soft);
      color:var(--navy);
      font-weight:900;
      font-size:13px;
    }
    .pill.gold { background:#FFF7DF; color:#7A5600; }
    .pill.green { background:var(--green-soft); color:var(--green); }
    .pill.red { background:var(--red-soft); color:var(--red); }
    .mode-panel { display:none; }
    .mode-panel.active { display:block; }
    .study-grid { display:grid; grid-template-columns:1.05fr .95fr; gap:18px; align-items:start; }
    .learning-card,.quiz-card,.write-card,.quick-card,.exercise-card,.wrong-item,.dictionary-card {
      border:1px solid var(--line);
      border-radius:var(--radius);
      padding:18px;
      background:var(--white);
    }
    .learning-card {
      min-height:330px;
      display:grid;
      gap:14px;
      align-content:center;
      box-shadow:0 12px 26px rgba(22,43,85,.1);
    }
    .learning-card.back { background:var(--navy-dark); color:var(--white); border-color:var(--navy-dark); }
    .topic-chip { display:inline-flex; width:fit-content; padding:6px 10px; border-radius:999px; background:var(--blue-soft); color:var(--navy); font-weight:900; font-size:13px; }
    .learning-card.back .topic-chip { background:rgba(255,255,255,.14); color:var(--gold); }
    .word-main { font-size:clamp(32px,5vw,52px); font-weight:900; color:var(--navy-dark); line-height:1.05; word-break:break-word; }
    .learning-card.back .word-main { color:var(--white); }
    .meaning { font-size:24px; font-weight:900; }
    .example { color:var(--muted); font-size:17px; }
    .learning-card.back .example { color:rgba(255,255,255,.86); }
    .pronunciation-box,.sentence-pronunciation {
      width:fit-content;
      max-width:100%;
      padding:8px 10px;
      border-radius:var(--radius);
      background:var(--blue-soft);
      color:var(--navy-dark);
      font-weight:800;
      border:1px solid #D9E7FF;
    }
    .pronunciation-box span,.sentence-pronunciation span { color:var(--navy); margin-right:5px; }
    .sentence-pronunciation { font-size:14px; font-weight:700; }
    .learning-card.back .pronunciation-box,.learning-card.back .sentence-pronunciation {
      background:rgba(255,255,255,.12);
      color:var(--white);
      border-color:rgba(255,255,255,.18);
    }
    .card-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .quiz-meta { display:flex; justify-content:space-between; gap:12px; color:var(--muted); font-weight:900; margin-bottom:12px; }
    .question { font-size:clamp(24px,3.2vw,38px); color:var(--navy-dark); font-weight:900; margin:10px 0 12px; line-height:1.18; word-break:break-word; }
    .options { display:grid; gap:12px; margin-top:14px; }
    .option {
      min-height:56px;
      border:1px solid var(--line);
      background:#FBFCFF;
      color:var(--text);
      border-radius:var(--radius);
      padding:13px 14px;
      text-align:left;
      font-weight:900;
      font-size:16px;
    }
    .option:hover { border-color:var(--navy); }
    .option.correct { border-color:var(--green); background:var(--green-soft); color:var(--green); }
    .option.wrong { border-color:var(--red); background:var(--red-soft); color:var(--red); }
    .feedback { margin-top:14px; border-radius:var(--radius); padding:13px; font-weight:850; display:none; }
    .feedback.show { display:block; }
    .feedback.ok { background:var(--green-soft); color:var(--green); border:1px solid rgba(22,128,60,.2); }
    .feedback.no { background:var(--red-soft); color:var(--red); border:1px solid rgba(201,32,50,.2); }
    .feedback.warn { background:#FFF7DF; color:#8A6100; border:1px solid rgba(242,183,5,.4); }
    .write-row { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:end; margin-top:14px; }
    .quick-grid,.wrong-list,.exercise-list,.dictionary-cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .quick-card { display:grid; gap:10px; align-content:start; }
    .quick-card strong,.wrong-item strong,.dictionary-card strong { color:var(--navy-dark); font-size:20px; word-break:break-word; }
    .wrong-item { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; }
    .muted { color:var(--muted); }
    .empty { padding:24px; text-align:center; color:var(--muted); border:1px dashed var(--line); border-radius:var(--radius); background:#FBFCFF; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:var(--radius); background:var(--white); }
    table { width:100%; border-collapse:collapse; min-width:1120px; }
    th,td { padding:12px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; font-size:14px; }
    th { position:sticky; top:0; background:var(--navy); color:var(--white); z-index:1; }
    tbody tr:hover { background:#FBFCFF; }
    .article-pill { display:inline-flex; min-width:34px; justify-content:center; padding:3px 8px; border-radius:999px; background:var(--blue-soft); color:var(--navy); font-weight:900; }
    .dict-cards-title { display:none; }
    .exercise-card h3 { margin:0 0 10px; color:var(--navy-dark); font-size:19px; }
    .exercise-card p { margin:8px 0; }
    .solution { display:none; margin-top:12px; padding:12px; border-radius:var(--radius); background:var(--blue-soft); border-left:4px solid var(--gold); }
    .exercise-card.open .solution { display:block; }
    .contact-band { background:var(--navy-dark); color:var(--white); border-radius:var(--radius); padding:clamp(22px,4vw,34px); display:grid; grid-template-columns:1.3fr 1fr; gap:18px; align-items:center; }
    .contact-band h2 { margin:0 0 8px; font-size:clamp(24px,4vw,38px); }
    .contact-links { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .contact-links a { padding:10px 12px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); border-radius:var(--radius); text-decoration:none; font-weight:800; }
    footer { text-align:center; color:var(--muted); padding:28px 16px 38px; }
    .toast {
      position:fixed;
      right:18px;
      bottom:18px;
      z-index:20;
      max-width:min(420px, calc(100% - 36px));
      padding:13px 15px;
      border-radius:var(--radius);
      background:var(--navy-dark);
      color:var(--white);
      box-shadow:var(--shadow);
      transform:translateY(20px);
      opacity:0;
      pointer-events:none;
      transition:opacity .2s ease, transform .2s ease;
      font-weight:900;
    }
    .toast.show { transform:translateY(0); opacity:1; }
    @media (max-width:1050px) {
      .mode-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .study-grid,.contact-band { grid-template-columns:1fr; }
      .dictionary-controls { grid-template-columns:1fr 1fr; }
      .dictionary-controls .btn { grid-column:1 / -1; }
    }
    @media (max-width:760px) {
      .wrap { width:min(100% - 22px, 1180px); }
      main { margin-top:-18px; }
      .topbar { flex-direction:column; align-items:flex-start; gap:10px; }
      .top-links { gap:9px; }
      .hero-content { padding:28px 0 42px; }
      h1 { font-size:clamp(32px,11vw,48px); }
      .stats-grid,.mode-grid,.controls,.dictionary-controls,.quick-grid,.wrong-list,.exercise-list,.dictionary-cards,.contact-links,.write-row { grid-template-columns:1fr; }
      .section-head,.study-title-row { display:block; }
      .study-actions { justify-content:flex-start; margin-top:12px; }
      .panel,.study-top { padding:16px; }
      .word-main { font-size:34px; }
      .wrong-item { grid-template-columns:1fr; }
      .btn { width:100%; }
      .btn.small { width:auto; }
      .card-actions .btn { flex:1 1 145px; }
      .table-wrap { display:none; }
      .dict-cards-title { display:block; margin:16px 0 8px; color:var(--navy-dark); }
      .dictionary-card { display:grid; gap:8px; }
    }
  </style>
</head>
<body>
  <header class="hero" id="top">
    <div class="topbar wrap">
      <div class="brand"><span class="brand-mark">AY</span><span>AYDA Dil Akademisi</span></div>
      <nav class="top-links" aria-label="İletişim">
        <a href="https://www.aydadil.com">aydadil.com</a>
        <a href="mailto:info@aydadil.com">info@aydadil.com</a>
        <a href="tel:+905409112503">+90 540 911 25 03</a>
      </nav>
    </div>
    <div class="wrap hero-content">
      <div class="eyebrow">CNC Mesleki Almanca</div>
      <h1>CNC Mesleki Almanca Kelime Platformu</h1>
      <p class="hero-subtitle">Tek ekranda seçim yapın, sadece istediğiniz çalışmayı açın.</p>
      <p class="hero-note">Türk CNC uzmanları için teknik Almanca kelimeler, konu bazlı çalışma, testler ve her alıştırmada Türkçe okunuş desteği.</p>
    </div>
  </header>

  <main class="wrap">
    <section class="view active" id="homeView" aria-label="Ana menü">
      <div class="home-layout">
        <div class="stats-grid">
          <article class="stat-card"><span class="stat-label">Toplam kelime</span><strong class="stat-value" id="statTotal">0</strong></article>
          <article class="stat-card"><span class="stat-label">Seçili havuz</span><strong class="stat-value" id="statActive">0</strong></article>
          <article class="stat-card"><span class="stat-label">Biliyorum</span><strong class="stat-value" id="statKnown">0</strong></article>
          <article class="stat-card"><span class="stat-label">Başarı</span><strong class="stat-value" id="statSuccess">0%</strong></article>
        </div>

        <section class="panel">
          <div class="section-head">
            <div>
              <h2>Önce konuyu seçin</h2>
              <p>İsterseniz tüm konularla çalışabilir, isterseniz tek konuya odaklanabilirsiniz.</p>
            </div>
          </div>
          <div class="controls">
            <div class="field">
              <label for="topicSelect">Konu</label>
              <select class="select" id="topicSelect"></select>
            </div>
            <label class="switch"><input type="checkbox" id="wrongOnly"> Sadece yanlışlarım</label>
          </div>
          <div class="selected-pool" id="activeSummary">Seçili havuz: 0 kelime</div>
          <p class="simple-help">Kullanım: Konuyu seçin, sonra aşağıdaki büyük butonlardan bir çalışma modu açın. Açılan ekranda yalnızca seçtiğiniz çalışma görünür.</p>
        </section>

        <section class="panel">
          <div class="section-head">
            <div>
              <h2>Çalışma modu seçin</h2>
              <p>Her bölümde karıştırma ve ana menüye dönme butonu bulunur.</p>
            </div>
          </div>
          <div class="mode-grid" id="modeGrid"></div>
        </section>
      </div>
    </section>

    <section class="view" id="studyView" aria-live="polite">
      <div class="study-shell">
        <div class="study-top">
          <div class="study-title-row">
            <div>
              <h2 id="viewTitle">Çalışma</h2>
              <p id="viewDescription">Çalışma açıklaması</p>
            </div>
            <div class="study-actions">
              <button class="btn secondary" id="backHome">Ana Menüye Dön</button>
              <button class="btn gold" id="shuffleMode">Kelimeleri Karıştır</button>
            </div>
          </div>
          <div class="progress-pills">
            <span class="pill" id="viewProgress">İlerleme: 0 / 0</span>
            <span class="pill gold" id="viewPool">Seçili havuz: 0 kelime</span>
            <span class="pill green" id="viewKnown">Biliyorum: 0</span>
            <span class="pill red" id="viewWrong">Yanlış: 0</span>
          </div>
        </div>

        <section class="panel mode-panel" id="cardsPanel">
          <div class="study-grid">
            <div>
              <div id="flashStage"></div>
              <div class="card-actions">
                <button class="btn secondary" id="flipCard">Cevabı Göster</button>
                <button class="btn good" id="knowCard">Biliyorum</button>
                <button class="btn red" id="dontKnowCard">Tekrar Et</button>
                <button class="btn" id="nextCard">Sonraki Kelime</button>
              </div>
            </div>
            <aside class="learning-card">
              <span class="topic-chip">Kısa açıklama</span>
              <p class="meaning">Bu bölümde Almanca kelimeyi görüp Türkçe anlamını tahmin edeceksiniz.</p>
              <p class="muted">Okunuş kutusu kelimeyi Türkçe okuma mantığıyla seslendirmeye yardımcı olur.</p>
            </aside>
          </div>
        </section>

        <section class="panel mode-panel" id="quizPanel">
          <div class="quiz-card" id="quizCard"></div>
        </section>

        <section class="panel mode-panel" id="reversePanel">
          <div class="quiz-card" id="reverseQuizCard"></div>
        </section>

        <section class="panel mode-panel" id="writePanel">
          <div class="write-card" id="writeCard"></div>
        </section>

        <section class="panel mode-panel" id="quickPanel">
          <div class="section-head">
            <div><h2>Hızlı Tekrar</h2><p>Seçili havuzdan karışık kelimeler. Almanca, okunuş ve Türkçe anlam birlikte görünür.</p></div>
          </div>
          <div class="quick-grid" id="quickGrid"></div>
        </section>

        <section class="panel mode-panel" id="wrongPanel">
          <div class="section-head">
            <div><h2>Yanlışlarım</h2><p id="wrongSummary">Yanlış listesi boş.</p></div>
            <button class="btn red small" id="clearWrong">Yanlışları Sıfırla</button>
          </div>
          <div class="wrong-list" id="wrongList"></div>
        </section>

        <section class="panel mode-panel" id="dictionaryPanel">
          <div class="section-head">
            <div><h2>Sözlük / Kelime Listesi</h2><p id="tableSummary">İlk 25 kelime gösteriliyor.</p></div>
          </div>
          <div class="dictionary-controls">
            <div class="field">
              <label for="searchInput">Almanca veya Türkçe ara</label>
              <input class="input" id="searchInput" type="search" placeholder="Örn. Messschieber, kumpas, Korrosion">
            </div>
            <div class="field">
              <label for="dictionaryTopicSelect">Konu filtresi</label>
              <select class="select" id="dictionaryTopicSelect"></select>
            </div>
            <button class="btn secondary" id="showMoreWords">Daha Fazla Göster</button>
          </div>
          <div id="tableArea"></div>
        </section>

        <section class="panel mode-panel" id="exercisePanel">
          <div class="section-head">
            <div><h2>Mini Alıştırmalar</h2><p id="exerciseSummary">Alıştırmalar hazırlanıyor.</p></div>
          </div>
          <div class="exercise-list" id="exerciseList"></div>
        </section>
      </div>
    </section>

    <section id="iletisim">
      <div class="contact-band">
        <div>
          <h2>AYDA Dil Akademisi</h2>
          <p>CNC Mesleki Almanca kursu ve çalışma desteği için iletişime geçebilirsiniz.</p>
        </div>
        <div class="contact-links">
          <a href="tel:+905409112503">Telefon / WhatsApp<br>+90 540 911 25 03</a>
          <a href="https://www.aydadil.com">Web sitesi<br>www.aydadil.com</a>
          <a href="mailto:info@aydadil.com">E-posta<br>info@aydadil.com</a>
          <a href="https://www.instagram.com/aydadil">Instagram<br>@aydadil</a>
        </div>
      </div>
    </section>
  </main>

  <footer>© AYDA Dil Akademisi — CNC Mesleki Almanca Çalışma Platformu</footer>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    const topics = __TOPICS_JSON__;
    const vocabulary = __VOCABULARY_JSON__;
    const exercises = __EXERCISES_JSON__;

    const modes = {
      cards: {
        panel: 'cardsPanel',
        title: 'Kelime Kartları',
        description: 'Bu bölümde Almanca kelimeyi görüp Türkçe anlamını tahmin edeceksiniz.',
        button: 'Kelimeleri Karıştır',
        cardText: 'Almanca kelime, okunuş, Türkçe anlam ve örnek cümleyle çalış.'
      },
      quiz: {
        panel: 'quizPanel',
        title: 'Çoktan Seçmeli Test',
        description: 'Almanca kelimeyi okuyun, doğru Türkçe anlamı seçin.',
        button: 'Yeni Rastgele Soru',
        cardText: 'Almanca sorunun altında okunuş desteği görünür.'
      },
      reverse: {
        panel: 'reversePanel',
        title: 'Türkçe → Almanca Test',
        description: 'Türkçe anlamı okuyun, doğru Almanca kelimeyi seçin.',
        button: 'Yeni Rastgele Soru',
        cardText: 'Cevap sonrası doğru Almanca kelime ve okunuş gösterilir.'
      },
      write: {
        panel: 'writePanel',
        title: 'Yazmalı Alıştırma',
        description: 'Türkçe anlam için Almanca kelimeyi artikeliyle yazın.',
        button: 'Yeni Kelime',
        cardText: 'Cevap verdikten sonra doğru yazım ve okunuş desteği çıkar.'
      },
      quick: {
        panel: 'quickPanel',
        title: 'Hızlı Tekrar',
        description: 'Seçili havuzdan karışık kelimeleri hızlıca gözden geçirin.',
        button: 'Kelimeleri Karıştır',
        cardText: 'Her kartta Almanca, okunuş ve Türkçe anlam yan yana gelir.'
      },
      wrong: {
        panel: 'wrongPanel',
        title: 'Yanlışlarım',
        description: 'Yanlış yaptığınız kelimeleri okunuş desteğiyle tekrar edin.',
        button: 'Yanlışları Karıştır',
        cardText: 'LocalStorage içinde saklanan yanlış kelimeleri tekrar gösterir.'
      },
      dictionary: {
        panel: 'dictionaryPanel',
        title: 'Sözlük / Kelime Listesi',
        description: 'Kelime listesini arayın, filtreleyin ve örnek cümle okunuşlarını görün.',
        button: 'Listeyi Karıştır',
        cardText: 'İlk açılışta 25 kelime görünür, daha fazlasını siz açarsınız.'
      },
      exercises: {
        panel: 'exercisePanel',
        title: 'Mini Alıştırmalar',
        description: 'Konu bazlı kısa soruların çözümünü ve okunuş desteğini inceleyin.',
        button: 'Alıştırmaları Karıştır',
        cardText: 'Çözümü açınca cevap ve yaklaşık okunuş desteği görünür.'
      }
    };

    const els = {
      homeView: document.getElementById('homeView'),
      studyView: document.getElementById('studyView'),
      modeGrid: document.getElementById('modeGrid'),
      viewTitle: document.getElementById('viewTitle'),
      viewDescription: document.getElementById('viewDescription'),
      viewProgress: document.getElementById('viewProgress'),
      viewPool: document.getElementById('viewPool'),
      viewKnown: document.getElementById('viewKnown'),
      viewWrong: document.getElementById('viewWrong'),
      backHome: document.getElementById('backHome'),
      shuffleMode: document.getElementById('shuffleMode'),
      statTotal: document.getElementById('statTotal'),
      statActive: document.getElementById('statActive'),
      statKnown: document.getElementById('statKnown'),
      statSuccess: document.getElementById('statSuccess'),
      activeSummary: document.getElementById('activeSummary'),
      searchInput: document.getElementById('searchInput'),
      topicSelect: document.getElementById('topicSelect'),
      dictionaryTopicSelect: document.getElementById('dictionaryTopicSelect'),
      wrongOnly: document.getElementById('wrongOnly'),
      tableArea: document.getElementById('tableArea'),
      tableSummary: document.getElementById('tableSummary'),
      showMoreWords: document.getElementById('showMoreWords'),
      flashStage: document.getElementById('flashStage'),
      flipCard: document.getElementById('flipCard'),
      knowCard: document.getElementById('knowCard'),
      dontKnowCard: document.getElementById('dontKnowCard'),
      nextCard: document.getElementById('nextCard'),
      quickGrid: document.getElementById('quickGrid'),
      quizCard: document.getElementById('quizCard'),
      reverseQuizCard: document.getElementById('reverseQuizCard'),
      writeCard: document.getElementById('writeCard'),
      wrongList: document.getElementById('wrongList'),
      wrongSummary: document.getElementById('wrongSummary'),
      clearWrong: document.getElementById('clearWrong'),
      exerciseList: document.getElementById('exerciseList'),
      exerciseSummary: document.getElementById('exerciseSummary'),
      toast: document.getElementById('toast')
    };

    const STORAGE_KEY = 'aydaCncGermanPlatform.v2';
    const OLD_STORAGE_KEY = 'aydaCncGermanPlatform.v1';
    let progress = loadProgress();
    let selectedTopic = 'all';
    let wrongOnly = false;
    let searchTerm = '';
    let filteredWords = [];
    let currentView = 'home';
    let currentMode = null;
    let flashSet = [];
    let flashIndex = 0;
    let flashFlipped = false;
    let quizState = createQuizState();
    let reverseQuizState = createQuizState();
    let writeWord = null;
    let quickSet = [];
    let exerciseSet = [];
    let dictionaryWords = [];
    let dictionaryLimit = 25;
    let toastTimer = null;

    function loadProgress() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY) || '{}');
        return {
          known: saved.known || {},
          wrong: saved.wrong || {},
          attempts: Number(saved.attempts || 0),
          correct: Number(saved.correct || 0)
        };
      } catch (error) {
        return { known: {}, wrong: {}, attempts: 0, correct: 0 };
      }
    }

    function saveProgress() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }

    function createQuizState() {
      return { current: null, options: [], answered: false, score: 0, total: 0, feedback: '', selected: '' };
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, function(char) {
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char];
      });
    }

    function normalizeText(value) {
      return String(value || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
        .replace(/[.,;:!?()[\\]{}"'’“”„]/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
    }

    function shuffle(items) {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function sample(items) {
      return items.length ? items[Math.floor(Math.random() * items.length)] : null;
    }

    function uniqueBy(items, keyFn) {
      const seen = new Set();
      return items.filter(function(item) {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function topicById(id) {
      return topics.find(function(topic) { return topic.id === id; });
    }

    function getWordById(id) {
      return vocabulary.find(function(word) { return word.id === Number(id); });
    }

    function pronunciationBox(text, label) {
      if (!text) return '';
      return '<div class="pronunciation-box"><span>' + escapeHtml(label || 'Okunuş:') + '</span><strong>' + escapeHtml(text) + '</strong></div>';
    }

    function sentencePronunciation(text) {
      if (!text) return '';
      return '<div class="sentence-pronunciation"><span>Cümle okunuşu:</span><em>' + escapeHtml(text) + '</em></div>';
    }

    function getPool() {
      let pool = selectedTopic === 'all' ? [...vocabulary] : vocabulary.filter(function(word) { return word.topicId === selectedTopic; });
      if (wrongOnly) pool = pool.filter(function(word) { return progress.wrong[word.id]; });
      return pool;
    }

    function getDictionaryPool() {
      let pool = getPool();
      const term = normalizeText(searchTerm);
      if (term) {
        pool = pool.filter(function(word) {
          return [word.german, word.pronunciationTr, word.turkish, word.exampleDe, word.examplePronunciationTr, word.exampleTr, word.topic, word.topicTr]
            .some(function(value) { return normalizeText(value).includes(term); });
        });
      }
      return pool;
    }

    function refreshFilteredWords() {
      filteredWords = getPool();
      renderStats();
      updateViewPills();
    }

    function renderStats() {
      const success = progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : 0;
      els.statTotal.textContent = vocabulary.length;
      els.statActive.textContent = filteredWords.length;
      els.statKnown.textContent = Object.keys(progress.known).length;
      els.statSuccess.textContent = success + '%';
      els.activeSummary.textContent = 'Seçili havuz: ' + filteredWords.length + ' kelime';
    }

    function updateViewPills(extra) {
      const wrongCount = Object.keys(progress.wrong).length;
      const knownCount = Object.keys(progress.known).length;
      els.viewPool.textContent = 'Seçili havuz: ' + filteredWords.length + ' kelime';
      els.viewKnown.textContent = 'Biliyorum: ' + knownCount;
      els.viewWrong.textContent = 'Yanlış: ' + wrongCount;
      if (extra) els.viewProgress.textContent = extra;
    }

    function renderTopicSelect(select) {
      select.innerHTML = '<option value="all">Tüm konular</option>' + topics.map(function(topic) {
        const count = vocabulary.filter(function(word) { return word.topicId === topic.id; }).length;
        return '<option value="' + topic.id + '">' + escapeHtml(topic.titleDe + ' — ' + topic.titleTr + ' (' + count + ')') + '</option>';
      }).join('');
      select.value = selectedTopic;
    }

    function renderModeGrid() {
      els.modeGrid.innerHTML = Object.keys(modes).map(function(key) {
        const mode = modes[key];
        return '<button class="mode-card" data-view="' + key + '"><span><h3>' + escapeHtml(mode.title) + '</h3><p>' + escapeHtml(mode.cardText) + '</p></span><span class="btn">Çalışmaya Başla</span></button>';
      }).join('');
    }

    function showView(viewName) {
      currentView = viewName;
      if (viewName === 'home') {
        currentMode = null;
        els.homeView.classList.add('active');
        els.studyView.classList.remove('active');
        document.getElementById('top').scrollIntoView({ behavior:'smooth', block:'start' });
        refreshFilteredWords();
        return;
      }

      currentMode = viewName;
      const mode = modes[viewName];
      els.homeView.classList.remove('active');
      els.studyView.classList.add('active');
      document.querySelectorAll('.mode-panel').forEach(function(panel) { panel.classList.remove('active'); });
      document.getElementById(mode.panel).classList.add('active');
      els.viewTitle.textContent = mode.title;
      els.viewDescription.textContent = mode.description;
      els.shuffleMode.textContent = mode.button;
      refreshFilteredWords();
      resetMode(viewName);
      els.studyView.scrollIntoView({ behavior:'smooth', block:'start' });
    }

    function resetMode(modeName) {
      if (modeName === 'cards') buildFlashSet();
      if (modeName === 'quiz') newQuiz('normal');
      if (modeName === 'reverse') newQuiz('reverse');
      if (modeName === 'write') newWritingWord();
      if (modeName === 'quick') buildQuickRepeat();
      if (modeName === 'wrong') renderWrongList(true);
      if (modeName === 'dictionary') {
        dictionaryLimit = 25;
        searchTerm = '';
        dictionaryWords = [];
        els.searchInput.value = '';
        renderDictionary();
      }
      if (modeName === 'exercises') buildExerciseSet();
    }

    function shuffleCurrentMode() {
      if (!currentMode) return;
      resetMode(currentMode);
      showToast('Çalışma yenilendi.', 'ok');
    }

    function buildFlashSet() {
      flashSet = shuffle(filteredWords).slice(0, Math.min(20, filteredWords.length));
      flashIndex = 0;
      flashFlipped = false;
      renderFlashcard();
    }

    function renderFlashcard() {
      const hasCards = flashSet.length > 0;
      [els.flipCard, els.knowCard, els.dontKnowCard, els.nextCard].forEach(function(button) { button.disabled = !hasCards; });
      if (!hasCards) {
        updateViewPills('İlerleme: 0 / 0');
        els.flashStage.innerHTML = '<div class="empty">Bu seçimde çalışılacak kelime bulunamadı.</div>';
        return;
      }
      const word = flashSet[flashIndex % flashSet.length];
      updateViewPills('İlerleme: ' + (flashIndex + 1) + ' / ' + flashSet.length);
      els.flipCard.textContent = flashFlipped ? 'Kelimeyi Göster' : 'Cevabı Göster';
      if (!flashFlipped) {
        els.flashStage.innerHTML = '<div class="learning-card"><span class="topic-chip">' + escapeHtml(word.topicTr) + '</span><div class="word-main">' + escapeHtml(word.german) + '</div>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<p class="example">' + escapeHtml(word.exampleDe) + '</p>' + sentencePronunciation(word.examplePronunciationTr) + '</div>';
      } else {
        els.flashStage.innerHTML = '<div class="learning-card back"><span class="topic-chip">' + escapeHtml(word.topic) + '</span><div class="word-main">' + escapeHtml(word.german) + '</div>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<div class="meaning">' + escapeHtml(word.turkish) + '</div><p class="example"><strong>DE:</strong> ' + escapeHtml(word.exampleDe) + '<br><strong>TR:</strong> ' + escapeHtml(word.exampleTr) + '</p>' + sentencePronunciation(word.examplePronunciationTr) + '</div>';
      }
    }

    function markKnown(word) {
      progress.known[word.id] = true;
      delete progress.wrong[word.id];
      saveProgress();
      showToast('Kelime bilinenlere eklendi.', 'ok');
      nextFlashcard();
    }

    function markWrong(word) {
      progress.wrong[word.id] = (progress.wrong[word.id] || 0) + 1;
      delete progress.known[word.id];
      saveProgress();
      showToast('Kelime tekrar listesine eklendi.', 'no');
      nextFlashcard();
    }

    function nextFlashcard() {
      if (!flashSet.length) return;
      flashIndex = (flashIndex + 1) % flashSet.length;
      flashFlipped = false;
      renderStats();
      renderFlashcard();
    }

    function buildOptions(current, mode) {
      const key = mode === 'reverse' ? 'german' : 'turkish';
      const basePool = uniqueBy((filteredWords.length >= 4 ? filteredWords : vocabulary), function(item) { return normalizeText(item[key]); });
      const wrongOptions = shuffle(basePool.filter(function(item) { return item.id !== current.id; })).slice(0, 3).map(function(item) { return item[key]; });
      return shuffle([current[key]].concat(wrongOptions)).slice(0, 4);
    }

    function newQuiz(mode) {
      const state = mode === 'reverse' ? reverseQuizState : quizState;
      const target = sample(filteredWords.length ? filteredWords : vocabulary);
      if (!target) return;
      state.current = target;
      state.options = buildOptions(target, mode);
      state.answered = false;
      state.feedback = '';
      state.selected = '';
      renderQuiz(mode);
    }

    function renderQuiz(mode) {
      const state = mode === 'reverse' ? reverseQuizState : quizState;
      const container = mode === 'reverse' ? els.reverseQuizCard : els.quizCard;
      if (!state.current) {
        container.innerHTML = '<button class="btn" data-action="next-' + mode + '">Yeni Soru</button>';
        return;
      }
      const questionText = mode === 'reverse' ? state.current.turkish : state.current.german;
      const answer = mode === 'reverse' ? state.current.german : state.current.turkish;
      updateViewPills('Soru: ' + (state.total + (state.answered ? 0 : 1)) + ' · Skor: ' + state.score + ' / ' + state.total);
      const questionPronunciation = mode === 'reverse' && !state.answered ? '' : pronunciationBox(state.current.pronunciationTr, 'Okunuş:');
      const answerInfo = state.answered
        ? '<div class="feedback show ' + (state.feedback.startsWith('Doğru') ? 'ok' : 'no') + '">' + escapeHtml(state.feedback) + '<br>Doğru cevap: ' + escapeHtml(answer) + (mode === 'reverse' ? '<br>' + pronunciationBox(state.current.pronunciationTr, 'Okunuş:') : '') + '<br><span class="muted">' + escapeHtml(state.current.exampleDe) + '</span>' + sentencePronunciation(state.current.examplePronunciationTr) + '</div>'
        : '<div class="feedback"></div>';
      container.innerHTML =
        '<div class="quiz-meta"><span>' + escapeHtml(state.current.topicTr) + '</span><span>Skor: ' + state.score + ' / ' + state.total + '</span></div>' +
        '<div class="question">' + escapeHtml(questionText) + '</div>' + questionPronunciation +
        '<div class="options">' + state.options.map(function(option) {
          let cls = 'option';
          if (state.answered && option === answer) cls += ' correct';
          if (state.answered && option === state.selected && option !== answer) cls += ' wrong';
          return '<button class="' + cls + '" data-mode="' + mode + '" data-option="' + escapeHtml(option) + '" ' + (state.answered ? 'disabled' : '') + '>' + escapeHtml(option) + '</button>';
        }).join('') + '</div>' +
        answerInfo +
        '<div class="card-actions"><button class="btn secondary" data-action="next-' + mode + '">Yeni Soru</button></div>';
    }

    function answerQuiz(mode, selected) {
      const state = mode === 'reverse' ? reverseQuizState : quizState;
      if (!state.current || state.answered) return;
      const answer = mode === 'reverse' ? state.current.german : state.current.turkish;
      const correct = selected === answer;
      state.answered = true;
      state.selected = selected;
      state.total += 1;
      progress.attempts += 1;
      if (correct) {
        state.score += 1;
        progress.correct += 1;
        progress.known[state.current.id] = true;
        delete progress.wrong[state.current.id];
        state.feedback = 'Doğru cevap.';
      } else {
        progress.wrong[state.current.id] = (progress.wrong[state.current.id] || 0) + 1;
        delete progress.known[state.current.id];
        state.feedback = 'Yanlış cevap.';
      }
      saveProgress();
      renderStats();
      renderQuiz(mode);
    }

    function newWritingWord() {
      writeWord = sample(filteredWords.length ? filteredWords : vocabulary);
      renderWriting();
    }

    function levenshtein(a, b) {
      const matrix = Array.from({ length:a.length + 1 }, function(_, i) { return [i]; });
      for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          matrix[i][j] = a[i - 1] === b[j - 1]
            ? matrix[i - 1][j - 1]
            : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
      return matrix[a.length][b.length];
    }

    function splitArticle(value) {
      const normalized = normalizeText(value);
      const parts = normalized.split(' ');
      if (['der','die','das'].includes(parts[0])) return { article:parts[0], base:parts.slice(1).join(' ') };
      return { article:'', base:normalized };
    }

    function renderWriting() {
      if (!writeWord) {
        els.writeCard.innerHTML = '<div class="empty">Yazmalı alıştırma için kelime bulunamadı.</div>';
        return;
      }
      updateViewPills('Yazmalı kelime: 1 / 1');
      els.writeCard.innerHTML =
        '<div class="topic-chip">' + escapeHtml(writeWord.topicTr) + '</div>' +
        '<div class="question">' + escapeHtml(writeWord.turkish) + '</div>' +
        '<p class="muted">Almanca kelimeyi yazın. Artikel varsa birlikte yazın.</p>' +
        '<div class="write-row"><div class="field"><label for="writeInput">Almanca cevap</label><input class="input" id="writeInput" autocomplete="off" placeholder="Örn. der Messschieber"></div><button class="btn" id="checkWrite">Kontrol Et</button></div>' +
        '<div class="feedback" id="writeFeedback"></div>';
      document.getElementById('checkWrite').addEventListener('click', checkWriting);
      document.getElementById('writeInput').addEventListener('keydown', function(event) { if (event.key === 'Enter') checkWriting(); });
    }

    function checkWriting() {
      if (!writeWord) return;
      const input = document.getElementById('writeInput');
      const feedback = document.getElementById('writeFeedback');
      const raw = input.value;
      const targetFull = normalizeText(writeWord.german);
      const targetBase = normalizeText(writeWord.baseWord || writeWord.german);
      const targetArticle = normalizeText(writeWord.article || '');
      const answer = normalizeText(raw);
      const split = splitArticle(raw);
      const baseDistance = levenshtein(split.base, targetBase);
      progress.attempts += 1;
      let cls = 'warn';
      let message = '';
      let isCorrect = false;
      if (answer === targetFull || (!targetArticle && answer === targetBase)) {
        message = 'Doğru.';
        cls = 'ok';
        isCorrect = true;
      } else if (targetArticle && answer === targetBase) {
        message = 'Kelime doğru, artikel eksik.';
      } else if (targetArticle && split.base === targetBase && split.article && split.article !== targetArticle) {
        message = 'Kelime doğru olabilir ama artikel yanlış. Doğru artikel: ' + targetArticle + '.';
      } else if (baseDistance <= (targetBase.length > 10 ? 2 : 1)) {
        message = 'Kelimeye çok yakınsın.';
      } else {
        message = 'Yanlış.';
        cls = 'no';
      }
      if (isCorrect) {
        progress.correct += 1;
        progress.known[writeWord.id] = true;
        delete progress.wrong[writeWord.id];
      } else {
        progress.wrong[writeWord.id] = (progress.wrong[writeWord.id] || 0) + 1;
        delete progress.known[writeWord.id];
      }
      saveProgress();
      feedback.className = 'feedback show ' + cls;
      feedback.innerHTML =
        escapeHtml(message) + '<br>Doğru cevap: <strong>' + escapeHtml(writeWord.german) + '</strong>' +
        pronunciationBox(writeWord.pronunciationTr, 'Okunuş:') +
        '<span class="muted">Örnek: ' + escapeHtml(writeWord.exampleDe) + '</span>' +
        sentencePronunciation(writeWord.examplePronunciationTr);
      renderStats();
      updateViewPills('Yazmalı kelime: 1 / 1');
    }

    function buildQuickRepeat() {
      const pool = filteredWords.length ? filteredWords : vocabulary;
      quickSet = shuffle(pool).slice(0, Math.min(20, pool.length));
      renderQuickRepeat();
    }

    function renderQuickRepeat() {
      updateViewPills('Hızlı tekrar: ' + quickSet.length + ' kelime');
      els.quickGrid.innerHTML = quickSet.length ? quickSet.map(function(word) {
        return '<div class="quick-card"><strong>' + escapeHtml(word.german) + '</strong>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<div class="meaning">' + escapeHtml(word.turkish) + '</div><small class="muted">' + escapeHtml(word.topicTr) + '</small></div>';
      }).join('') : '<div class="empty">Hızlı tekrar için kelime bulunamadı.</div>';
    }

    function renderWrongList(randomize) {
      let wrongIds = Object.keys(progress.wrong).map(Number).filter(function(id) { return getWordById(id); });
      if (randomize) wrongIds = shuffle(wrongIds);
      els.wrongSummary.textContent = wrongIds.length ? wrongIds.length + ' kelime tekrar bekliyor.' : 'Yanlış listesi boş.';
      updateViewPills('Yanlış listesi: ' + wrongIds.length);
      if (!wrongIds.length) {
        els.wrongList.innerHTML = '<div class="empty">Henüz yanlış yapılan kelime yok. Önce bir test veya yazmalı alıştırma çözebilirsiniz.</div>';
        return;
      }
      els.wrongList.innerHTML = wrongIds.map(function(id) {
        const word = getWordById(id);
        return '<div class="wrong-item"><div><strong>' + escapeHtml(word.german) + '</strong>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<div>' + escapeHtml(word.turkish) + '</div><small class="muted">' + escapeHtml(word.topicTr) + ' · ' + progress.wrong[id] + ' tekrar</small></div><button class="btn secondary small" data-practice="' + id + '">Kartlarda Çalış</button></div>';
      }).join('');
    }

    function renderDictionary() {
      dictionaryWords = currentMode === 'dictionary' && dictionaryWords.length ? dictionaryWords : getDictionaryPool();
      if (!dictionaryWords.length || searchTerm) dictionaryWords = getDictionaryPool();
      const shown = dictionaryWords.slice(0, dictionaryLimit);
      els.tableSummary.textContent = shown.length + ' / ' + dictionaryWords.length + ' kelime gösteriliyor.';
      els.showMoreWords.disabled = shown.length >= dictionaryWords.length;
      updateViewPills('Liste: ' + shown.length + ' / ' + dictionaryWords.length);
      if (!shown.length) {
        els.tableArea.innerHTML = '<div class="empty">Bu filtreyle kelime bulunamadı.</div>';
        return;
      }
      const table = '<div class="table-wrap"><table><thead><tr><th>Almanca</th><th>Okunuş</th><th>Türkçe</th><th>Konu</th><th>Örnek cümle</th><th>Cümle okunuşu</th></tr></thead><tbody>' + shown.map(function(word) {
        return '<tr><td><strong>' + escapeHtml(word.german) + '</strong><br>' + (word.article ? '<span class="article-pill">' + escapeHtml(word.article) + '</span>' : '') + '</td><td>' + escapeHtml(word.pronunciationTr) + '</td><td>' + escapeHtml(word.turkish) + '</td><td>' + escapeHtml(word.topicTr) + '</td><td>' + escapeHtml(word.exampleDe) + '<br><span class="muted">' + escapeHtml(word.exampleTr) + '</span></td><td>' + escapeHtml(word.examplePronunciationTr) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
      const cards = '<h3 class="dict-cards-title">Kelime Kartları</h3><div class="dictionary-cards">' + shown.map(function(word) {
        return '<article class="dictionary-card"><strong>' + escapeHtml(word.german) + '</strong>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<div>' + escapeHtml(word.turkish) + '</div><small class="muted">' + escapeHtml(word.topicTr) + '</small><p>' + escapeHtml(word.exampleDe) + '</p>' + sentencePronunciation(word.examplePronunciationTr) + '</article>';
      }).join('') + '</div>';
      els.tableArea.innerHTML = table + cards;
    }

    function buildExerciseSet() {
      const list = selectedTopic === 'all' ? exercises : exercises.filter(function(exercise) { return exercise.topicId === selectedTopic; });
      exerciseSet = shuffle(list);
      renderExercises();
    }

    function renderExercises() {
      const list = exerciseSet;
      els.exerciseSummary.textContent = list.length + ' mini alıştırma listeleniyor.';
      updateViewPills('Alıştırma: ' + list.length);
      if (!list.length) {
        els.exerciseList.innerHTML = '<div class="empty">Bu seçimde alıştırma bulunamadı.</div>';
        return;
      }
      els.exerciseList.innerHTML = list.map(function(exercise, index) {
        const topic = topicById(exercise.topicId);
        return '<article class="exercise-card"><h3>' + (index + 1) + '. ' + escapeHtml(topic.titleDe) + '</h3><p><strong>DE:</strong> ' + escapeHtml(exercise.questionDe) + '</p><p><strong>TR:</strong> ' + escapeHtml(exercise.questionTr) + '</p><button class="btn secondary small" data-solution>Çözümü Göster</button><div class="solution"><p><strong>Lösung:</strong> ' + escapeHtml(exercise.answerDe) + '</p><p><strong>Cevap:</strong> ' + escapeHtml(exercise.answerTr) + '</p>' + sentencePronunciation(exercise.answerPronunciationTr) + '</div></article>';
      }).join('');
    }

    function showToast(message, type) {
      els.toast.textContent = message;
      els.toast.style.background = type === 'no' ? 'var(--red)' : type === 'ok' ? 'var(--green)' : 'var(--navy-dark)';
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function() { els.toast.classList.remove('show'); }, 2200);
    }

    function setTopic(value) {
      selectedTopic = value;
      els.topicSelect.value = selectedTopic;
      els.dictionaryTopicSelect.value = selectedTopic;
      refreshFilteredWords();
      if (currentMode) resetMode(currentMode);
    }

    function init() {
      renderTopicSelect(els.topicSelect);
      renderTopicSelect(els.dictionaryTopicSelect);
      renderModeGrid();
      refreshFilteredWords();
    }

    els.modeGrid.addEventListener('click', function(event) {
      const button = event.target.closest('[data-view]');
      if (button) showView(button.dataset.view);
    });
    els.backHome.addEventListener('click', function() { showView('home'); });
    els.shuffleMode.addEventListener('click', shuffleCurrentMode);
    els.topicSelect.addEventListener('change', function(event) { setTopic(event.target.value); });
    els.dictionaryTopicSelect.addEventListener('change', function(event) { setTopic(event.target.value); renderDictionary(); });
    els.wrongOnly.addEventListener('change', function(event) {
      wrongOnly = event.target.checked;
      refreshFilteredWords();
      if (currentMode) resetMode(currentMode);
    });
    els.searchInput.addEventListener('input', function(event) {
      searchTerm = event.target.value;
      dictionaryLimit = 25;
      dictionaryWords = [];
      renderDictionary();
    });
    els.showMoreWords.addEventListener('click', function() {
      dictionaryLimit += 25;
      renderDictionary();
    });
    els.flipCard.addEventListener('click', function() { flashFlipped = !flashFlipped; renderFlashcard(); });
    els.nextCard.addEventListener('click', nextFlashcard);
    els.knowCard.addEventListener('click', function() { if (flashSet.length) markKnown(flashSet[flashIndex % flashSet.length]); });
    els.dontKnowCard.addEventListener('click', function() { if (flashSet.length) markWrong(flashSet[flashIndex % flashSet.length]); });
    els.quizCard.addEventListener('click', function(event) {
      const option = event.target.closest('[data-option]');
      const action = event.target.closest('[data-action]');
      if (option) answerQuiz('normal', option.dataset.option);
      if (action) newQuiz('normal');
    });
    els.reverseQuizCard.addEventListener('click', function(event) {
      const option = event.target.closest('[data-option]');
      const action = event.target.closest('[data-action]');
      if (option) answerQuiz('reverse', option.dataset.option);
      if (action) newQuiz('reverse');
    });
    els.wrongList.addEventListener('click', function(event) {
      const button = event.target.closest('[data-practice]');
      if (!button) return;
      const word = getWordById(button.dataset.practice);
      selectedTopic = word.topicId;
      wrongOnly = true;
      els.wrongOnly.checked = true;
      refreshFilteredWords();
      showView('cards');
      const index = flashSet.findIndex(function(item) { return item.id === word.id; });
      flashIndex = index >= 0 ? index : 0;
      renderFlashcard();
    });
    els.clearWrong.addEventListener('click', function() {
      progress.wrong = {};
      saveProgress();
      wrongOnly = false;
      els.wrongOnly.checked = false;
      refreshFilteredWords();
      renderWrongList(false);
      showToast('Yanlış listesi temizlendi.', 'ok');
    });
    els.exerciseList.addEventListener('click', function(event) {
      if (event.target.closest('[data-solution]')) event.target.closest('.exercise-card').classList.toggle('open');
    });

    init();
  </script>
</body>
</html>`;

const rendered = html
  .replace("__TOPICS_JSON__", JSON.stringify(topics))
  .replace("__VOCABULARY_JSON__", JSON.stringify(vocabulary))
  .replace("__EXERCISES_JSON__", JSON.stringify(exercises));

fs.writeFileSync(path.join(workspace, "index.html"), rendered, "utf8");
fs.writeFileSync(
  path.join(workspace, "ayda-data-summary.json"),
  JSON.stringify({
    topics: topics.length,
    vocabulary: vocabulary.length,
    exercises: exercises.length,
    missingPronunciations: vocabulary.filter((word) => !word.pronunciationTr).length,
    missingExamplePronunciations: vocabulary.filter((word) => word.exampleDe && !word.examplePronunciationTr).length,
  }, null, 2),
  "utf8"
);

console.log(`Generated index.html with ${topics.length} topics, ${vocabulary.length} words and ${exercises.length} exercises.`);
