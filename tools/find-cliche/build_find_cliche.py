"""detections/*.md から find-cliche.html と find-cliche.jsonl を生成する。

    python3 build_find_cliche.py --series <seriesKey>       # 全章
    python3 build_find_cliche.py --series <seriesKey> 00    # 指定章のみ（叩き用。jsonl は書かない）
"""

import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_ROOT = HERE.parent.parent / "data"
INDEX_HTML = HERE.parent / "index.html"
# 読み書きの場所はシリーズごとに違うので、main が --series を読んでから決める
DETECTIONS = TRANSLATIONS = OUT_HTML = OUT_JSONL = Path()

TITLE = "英語なまり検出レポート"

INTRO = [
    "AIくさい直訳表現をみつける",
    "原稿を英訳し、英語圏の慣用句・決まり文句・比喩と重なる言葉づかいを\n日本語文化で違和感を感じやすい表現としてピックアップしています。",
]

USAGE = [
    "レポートには代替案も添えているので、必要に応じてご利用ください。\n前後の文と役割が重なる場合は、言い換えではなく文そのものの削除を提案しています。",
    "採用する箇所をAIエージェントに伝えやすいよう、AI用の資料find-cliche.jsonlがあります。これを連携しIDを使って変更指示をしてみてください。\n採用する箇所をピックアップしやすいよう、フッターでひかえているIDをまとめてクリップボードへコピーできます。",
]

LEVEL_LIST = [
    ("高く該当", "文の組み立てや比喩まで、特定の英語の決まり文句と重なる文"),
    ("該当", "重なりは見えるものの、言い回しや構造の一部がずれている文"),
]

PROMPT = "find-cliche.jsonlの次のidを修正提案に差し替えたい。"


# ---------- parse ----------

ITEM_RE = re.compile(r"^- \[(\d{8}-\d{2}-\d{2})\] (.+?)\s*$")
ARROW_RE = re.compile(r"^\s*→ (.+?)\s*$")
PROPOSAL_RE = re.compile(r"^(代替案|削除案): ?(.*)$")


def parse_chapter(path: Path) -> dict:
    line_list = path.read_text(encoding="utf-8").splitlines()
    chapter = {"title": "", "section_list": []}
    section = None
    item = None
    for line in line_list:
        if line.startswith("# "):
            chapter["title"] = line[2:].strip()
            continue
        if line.startswith("## "):
            section = {"level": line[3:].strip(), "item_list": [], "empty": False}
            chapter["section_list"].append(section)
            item = None
            continue
        if line.strip() == "該当なし" and section is not None:
            section["empty"] = True
            continue
        m = ITEM_RE.match(line)
        if m and section is not None:
            item = {"id": m.group(1), "source": m.group(2), "note_list": [], "proposal": None, "kind": None}
            section["item_list"].append(item)
            continue
        m = ARROW_RE.match(line)
        if m and item is not None:
            body = m.group(1)
            pm = PROPOSAL_RE.match(body)
            if pm:
                item["kind"] = pm.group(1)
                item["proposal"] = pm.group(2).strip()
            else:
                item["note_list"].append(body)
    return chapter


# ---------- render ----------

def inline(text: str) -> str:
    """*…* を <q lang="en"> に、それ以外はエスケープ。"""
    part_list = re.split(r"(\*[^*]+\*)", text)
    out = []
    for p in part_list:
        if p.startswith("*") and p.endswith("*") and len(p) > 2:
            out.append(f'<q lang="en">{html.escape(p[1:-1])}</q>')
        else:
            out.append(html.escape(p))
    return "".join(out)


ICON_SQUARE = '<svg class="icon" viewBox="0 0 256 256" aria-hidden="true"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Z"/></svg>'
ICON_CHECK_SQUARE = '<svg class="icon" viewBox="0 0 256 256" aria-hidden="true"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM224,48V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM208,208V48H48V208H208Z"/></svg>'


def render_item(item: dict) -> str:
    kind = item["kind"] or "代替案"
    pattern = "<br>".join(inline(n) for n in item["note_list"])
    dl = (
        f'<div class="id"><dt>ID</dt><dd>{item["id"]}</dd></div>'
        f'<div class="source"><dt>原文</dt><dd>{html.escape(item["source"])}</dd></div>'
        f'<div class="analysis">'
        + (f'<dt class="pattern">英語表現</dt><dd class="pattern">{pattern}</dd>' if pattern else "")
        + f'<dt>{html.escape(kind)}</dt><dd>{html.escape(item["proposal"] or "")}</dd>'
        "</div>"
    )
    pick = (
        f'<label class="pick"><input type="checkbox" value="{item["id"]}" aria-label="{item["id"]} を採用">'
        f"{ICON_SQUARE}{ICON_CHECK_SQUARE}</label>"
    )
    keep = '<button type="button" class="keep" aria-pressed="false">IDをひかえる</button>'
    return f'<article class="case">{pick}<dl>{dl}</dl>{keep}</article>'


def render_chapter(ch: dict) -> str:
    out = []
    for sec in ch["section_list"]:
        out.append(f'<h3>{html.escape(sec["level"])}</h3>')
        if sec["empty"] or not sec["item_list"]:
            out.append("<p>該当なし</p>")
        else:
            out.append('<div class="cases">' + "".join(render_item(i) for i in sec["item_list"]) + "</div>")
    return "".join(out)


REF_SELECTOR_LIST = [
    "html{", "body{", "body::before", "main{", "main>*", "h1,h3", "h1{", "h3{", "h4{", "p{", "header",
    ".lead", ".list", ".viewport-section", ".hero-box", ".hero-copy", ".intro-copy", ".section-columns",
    ".scroll-hint", ".viewpoint-card", ".report", ".analysis-title", "hr{", ".scope-", ".icon{",
]
REF_KEYFRAME_LIST = ["hint-blur", "hint-fill", "section-out"]


def extract_reference_css() -> tuple[str, str, str]:
    """../index.html から、トークン・基本・ビュー構造の規則、favicon、Google Fonts の <link> を取り出す。"""
    src = INDEX_HTML.read_text(encoding="utf-8")
    css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
    fonts = "".join(re.findall(r'<link[^>]+fonts\.g[^>]+>', src))
    favicon = re.search(r'<link rel="icon"[^>]+>', src).group(0)

    root = re.search(r":root\{.*?\n\}", css, re.S).group(0)
    nested = r"(?:[^{}]*\{[^}]*\})*[^}]*\}"
    flat = re.sub(r"@keyframes\s+[\w-]+\s*\{" + nested, "", css)
    flat = re.sub(r"@media[^{]*\{" + nested, "", flat)
    rule_list = []
    for m in re.finditer(r"([^{}@]+?)\{([^{}]*)\}", flat):
        sel = m.group(1).strip()
        if sel.startswith(":root") or sel.startswith("--"):
            continue
        if any(sel.startswith(s.rstrip("{")) or f",{s.rstrip('{')}" in sel.replace(" ", "") for s in REF_SELECTOR_LIST):
            rule_list.append(f"{sel}{{{m.group(2)}}}")
    keyframe_list = [
        m.group(0)
        for m in re.finditer(r"@keyframes\s+([\w-]+)\s*\{(?:[^{}]*\{[^}]*\})*[^}]*\}", css)
        if m.group(1) in REF_KEYFRAME_LIST
    ]
    reduced = re.search(r"@media\(prefers-reduced-motion:reduce\)\{(?:[^{}]*\{[^}]*\})*[^}]*\}", css)
    part_list = [root, "\n".join(rule_list), "\n".join(keyframe_list)]
    if reduced:
        part_list.append(reduced.group(0))
    return "\n".join(part_list), fonts, favicon


CSS = """
.prompt{margin:0;display:flex;flex-direction:column;gap:var(--s1)}
.prompt figcaption{font-size:var(--t-md);line-height:var(--lh-md);letter-spacing:.02em;color:var(--ink-desc)}
pre{margin:0;padding:var(--s3);border:1px solid var(--ink-desc);background:var(--paper-card);font-family:var(--font-mono);font-size:var(--t-sm);line-height:var(--lh-sm);white-space:pre-wrap;overflow-wrap:anywhere}
.scope-body{display:flex;flex-direction:column;gap:var(--s3);padding-top:var(--s3)}
.scope-body h3{margin:var(--s3) 0 0}
.cases{display:flex;flex-direction:column;gap:var(--s2)}
.case{--case-gap:var(--s3);display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:var(--s2);row-gap:var(--case-gap);align-items:start;padding:var(--s3);border:1px solid var(--rule-soft);box-shadow:var(--shadow-card);background:var(--paper-card)}
.case .pick{position:relative;display:flex;align-items:center;height:var(--lh-md);font-size:1.25rem;color:var(--ink-2);cursor:pointer}
.case .pick .icon{vertical-align:0}
.case .pick input{position:absolute;inset:0;margin:0;opacity:0;cursor:pointer}
.case .pick .icon+.icon{display:none}
.case .pick input:checked~.icon{display:none}
.case .pick input:checked~.icon+.icon{display:inline-block}
.case .pick input:focus-visible~.icon{outline:2px solid var(--ink-2);outline-offset:2px}
.case:has(.pick input:checked){border-color:var(--ink-2)}
.case .keep{grid-column:2;justify-self:end;appearance:none;margin:0;padding:var(--gap-hairline) var(--s2);border:1px solid var(--ink-2);background:var(--paper);color:var(--ink-2);font-family:var(--font-body);font-size:var(--t-sm);line-height:var(--lh-sm);cursor:pointer;transition:background .2s var(--ease-out),color .2s var(--ease-out)}
.case .keep[aria-pressed=true]{background:var(--ink-2);color:var(--paper)}
.case .keep:focus-visible{outline:2px solid var(--ink-2);outline-offset:2px}
.copy-bar{position:fixed;left:0;right:0;bottom:0;z-index:10;background:linear-gradient(var(--paper-card),var(--paper-card)) var(--paper);border-top:1px solid var(--rule-soft);visibility:hidden;opacity:0;filter:blur(var(--blur-max));transition:filter .5s var(--ease-out),opacity .5s var(--ease-out),visibility 0s .5s}
.report:has(.scope-tabs-wrap.stuck) .copy-bar{visibility:visible;opacity:1;filter:blur(0);transition-delay:0s}
.copy-inner{display:flex;justify-content:space-between;align-items:center;gap:var(--s3);max-width:calc(1120px + 2*var(--s3));margin:0 auto;padding:var(--s2) var(--s3)}
.copy-count{margin:0;color:var(--ink-desc);font-size:var(--t-sm);line-height:var(--lh-sm)}
.copy-count .n{font-family:var(--font-mono),var(--font-body);color:var(--ink-1);font-weight:700;margin-right:.25em}
.copy-ids{appearance:none;margin:0;padding:var(--gap-hairline) var(--s2);border:1px solid var(--ink-2);background:var(--ink-2);color:var(--paper);font-family:var(--font-body);font-size:var(--t-sm);line-height:var(--lh-sm);cursor:pointer;white-space:nowrap;transition:background .2s var(--ease-out),color .2s var(--ease-out),border-color .2s var(--ease-out)}
.copy-ids:disabled{background:var(--paper);color:var(--ink-4);border-color:var(--ink-4);cursor:default}
.copy-ids:focus-visible{outline:2px solid var(--ink-2);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.copy-bar,.copy-ids{transition:none}}
.case dl{display:flex;flex-direction:column;gap:var(--case-gap);margin:0;min-width:0}
.case dt{font-size:var(--t-xs);line-height:var(--lh-md);font-weight:400;letter-spacing:.02em;color:var(--ink-desc);white-space:nowrap}
.case dd{margin:0}
.case .id{display:flex;gap:var(--s2)}
.case .id dd{font-family:var(--font-mono),var(--font-body);font-size:var(--t-sm)}
.case .source dt,.case dt.pattern{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.case .source dd{font-weight:700;font-size:var(--t-lg);line-height:var(--lh-lg)}
.case .analysis{display:flex;flex-direction:column;padding-top:var(--case-gap);position:relative}
.case dd.pattern+dt{margin-top:var(--s2)}
.case .analysis::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--rule-fade)}
.case dd.pattern{font-size:var(--t-sm);line-height:var(--lh-sm)}
.case .source dd,.case .analysis dd{padding-right:calc(var(--s3) + var(--s1))}
.case q{quotes:none;color:var(--series-a)}
"""


HINT_FONT = "font-family:'Zen Kurenaido',var(--font-head)"

TRAILING_NOTE_RE = re.compile(r"\s*（[^）]*）\s*$")


def load_translation_list(num: int) -> list[dict]:
    path = next(TRANSLATIONS.glob(f"{num:02d}-*.jsonl"))
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(chapter_list: list[dict]) -> int:
    line_list = []
    for ch in chapter_list:
        row_list = load_translation_list(ch["num"])
        used: set[int] = set()
        for sec in ch["section_list"]:
            for item in sec["item_list"]:
                idx = next(i for i, r in enumerate(row_list) if r["source"] == item["source"] and i not in used)
                used.add(idx)
                proposal = "" if item["kind"] == "削除案" else TRAILING_NOTE_RE.sub("", item["proposal"] or "")
                line_list.append(json.dumps({
                    "id": item["id"],
                    "chapter": ch["num"],
                    "source": item["source"],
                    "translation": row_list[idx]["translation"],
                    "proposal": proposal,
                }, ensure_ascii=False))
    OUT_JSONL.write_text("\n".join(line_list) + "\n", encoding="utf-8")
    return len(line_list)


SCRIPT = """
{document.querySelectorAll('[role=tablist]').forEach(function(list){var tabs=Array.prototype.slice.call(list.querySelectorAll(':scope > [role=tab]'));var hashed=list.classList.contains('scope-list');function activate(tab,pushHash){tabs.forEach(function(t){var on=t===tab;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;var panel=document.getElementById(t.getAttribute('aria-controls'));if(panel){if(on)panel.removeAttribute('hidden');else panel.setAttribute('hidden','until-found')}});if(hashed&&pushHash){var id='#'+tab.getAttribute('aria-controls');if(location.hash!==id)history.pushState(null,'',id);var ownPanel=document.getElementById(tab.getAttribute('aria-controls'));if(ownPanel)ownPanel.scrollIntoView({block:'start'})}}tabs.forEach(function(tab,i){var own=document.getElementById(tab.getAttribute('aria-controls'));if(own)own.addEventListener('beforematch',function(){activate(tab)});tab.addEventListener('click',function(){activate(tab,true)});tab.addEventListener('keydown',function(e){var idx;if(e.key==='ArrowRight')idx=(i+1)%tabs.length;else if(e.key==='ArrowLeft')idx=(i-1+tabs.length)%tabs.length;else return;e.preventDefault();tabs[idx].focus();activate(tabs[idx],true)})});if(hashed){var syncFromHash=function(){var id=location.hash.slice(1);var tab=tabs.find(function(t){return t.getAttribute('aria-controls')===id})||tabs[0];if(tab.getAttribute('aria-selected')!=='true')activate(tab)};window.addEventListener('popstate',syncFromHash);syncFromHash()}})}
{const wrap=document.querySelector('.scope-tabs-wrap');if(wrap){new IntersectionObserver(([e])=>{wrap.classList.toggle('stuck',e.intersectionRatio<1&&e.boundingClientRect.top<=0)},{threshold:[0,1],rootMargin:'-1px 0px 0px 0px'}).observe(wrap)}
document.addEventListener('click',e=>{const keep=e.target.closest('.case .keep');if(!keep)return;const input=keep.closest('.case').querySelector('.pick input');input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}))});document.addEventListener('change',e=>{if(!e.target.matches('.pick input'))return;const keep=e.target.closest('.case').querySelector('.keep');if(keep)keep.setAttribute('aria-pressed',String(e.target.checked))});
{const btn=document.querySelector('.copy-ids');if(btn){const label=btn.textContent,count=document.querySelector('.copy-count .n');const picked=()=>[...document.querySelectorAll('.pick input:checked')].map(i=>i.value);const sync=()=>{const n=picked().length;btn.disabled=n===0;btn.textContent=label;if(count)count.textContent=n};document.addEventListener('change',e=>{if(e.target.matches('.pick input'))sync()});btn.addEventListener('click',()=>{navigator.clipboard.writeText(picked().join('\\n')).then(()=>{btn.textContent='コピーしました';setTimeout(sync,1500)})});sync()}}
if(!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')){const secs=[...document.querySelectorAll('.viewport-section')];const observer=new IntersectionObserver((entries)=>{for(const entry of entries){const r=entry.boundingClientRect,h=r.height||1,out=Math.min(1,Math.max(0,-r.top/(h*.6)));entry.target.style.setProperty('--out',out.toFixed(3))}},{threshold:Array.from({length:101},(_,i)=>i/100)});secs.forEach(s=>observer.observe(s))}}
"""


def render_report(chapter_list: list[dict]) -> str:
    tab_list, panel_list = [], []
    for i, ch in enumerate(chapter_list):
        n = ch["num"]
        first = i == 0
        tab_list.append(
            f'<button role="tab" id="tab-report-{n}" aria-controls="report-{n}" aria-selected="{"true" if first else "false"}"'
            + ("" if first else ' tabindex="-1"')
            + f">{html.escape(ch['title'])}</button>"
        )
        panel_list.append(
            f'<section id="report-{n}" role="tabpanel" class="scope-panel" aria-labelledby="tab-report-{n}"'
            + ("" if first else ' hidden="until-found"')
            + '><article class="scope-body">'
            + render_chapter(ch)
            + "</article></section>"
        )
    bar = (
        '<div class="scope-tabs-wrap"><div class="scope-bar"><div class="scope-tabs">'
        f'<a class="scope-title" href="#top">{TITLE}</a>'
        '<div class="scope-list" role="tablist" aria-label="スコープ">' + "".join(tab_list) + "</div>"
        "</div></div></div>"
    )
    copy_bar = (
        '<div class="copy-bar"><div class="copy-inner">'
        '<p class="copy-count"><span class="n">0</span>件のIDをひかえています</p>'
        '<button type="button" class="copy-ids" disabled>クリップボードへコピー</button>'
        "</div></div>"
    )
    return bar + "".join(panel_list) + copy_bar


def build(parsed: list[dict]) -> str:
    ref_css, fonts, favicon = extract_reference_css()
    body = render_report(parsed)
    id_list = [i["id"] for ch in parsed for sec in ch["section_list"] for i in sec["item_list"]]
    prompt = "\n".join([PROMPT, *id_list[:2]])
    lead, sub = (html.escape(t).replace("\n", "<br>") for t in INTRO)
    usage = "".join(f"<p>{html.escape(t).replace(chr(10), '<br>')}</p>" for t in USAGE)
    cards = "".join(
        f'<div class="viewpoint-card"><h3>{html.escape(k)}</h3><p>{html.escape(v)}</p></div>'
        for k, v in LEVEL_LIST
    )
    return f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{TITLE}</title>{favicon}{fonts}<style>{ref_css}{CSS}</style></head><body><main>
<div class="viewport-section" id="top"><div class="hero-box"><div class="hero-copy"><header><h1>{TITLE}</h1><p class="lead">{lead}</p></header>
<p>{sub}</p></div><a href="#usage" class="scroll-hint" style="{HINT_FONT}"><span>どう使う？</span></a></div></div>
<div class="viewport-section" id="usage"><div class="section-columns"><div class="intro-copy"><div class="intro-copy-text">{usage}<figure class="prompt"><figcaption>プロンプト例：</figcaption><pre>{html.escape(prompt)}</pre></figure></div><a href="#report-view" class="scroll-hint" style="{HINT_FONT}"><span>レポートをみる</span></a></div><div class="viewpoint-cards">{cards}</div></div></div>
<div class="report" id="report-view">{body}</div>
</main><script>{SCRIPT}</script></body></html>
"""


def main() -> None:
    global DETECTIONS, TRANSLATIONS, OUT_HTML, OUT_JSONL
    argv = sys.argv[1:]
    if "--series" not in argv or argv.index("--series") + 1 >= len(argv):
        sys.exit("--series <seriesKey> is required")
    i = argv.index("--series")
    data_dir = DATA_ROOT / argv[i + 1] / "find-cliche"
    DETECTIONS = data_dir / "detections"
    TRANSLATIONS = data_dir / "translations"
    OUT_HTML = data_dir / "find-cliche.html"
    OUT_JSONL = data_dir / "find-cliche.jsonl"
    wanted = argv[:i] + argv[i + 2:]
    file_list = sorted(DETECTIONS.glob("[0-9][0-9]-*.md"))
    if wanted:
        file_list = [f for f in file_list if f.name[:2] in wanted]
    parsed = []
    for p in file_list:
        ch = parse_chapter(p)
        ch["num"] = int(p.name[:2])
        parsed.append(ch)
    OUT_HTML.write_text(build(parsed), encoding="utf-8")
    print(f"{OUT_HTML.name}: {len(file_list)} chapter(s)")
    if not wanted:
        n = write_jsonl(parsed)
        print(f"{OUT_JSONL.name}: {n} rows")


if __name__ == "__main__":
    main()
