# Builds preview.html: each logo concept at several sizes on light and dark tiles, plus a wordmark lockup.
import pathlib, re
here = pathlib.Path(__file__).parent
concepts = [
    ("chuck", "Chuck", "A three-jaw lathe chuck. The jaws grip the work; simple enough for a favicon."),
    ("recursive", "Chuck in a chuck", "A chuck gripping a smaller chuck: a tool that makes tools, including better versions of itself."),
    ("monogram", "L monogram", "An L built from a lathe: headstock, turned work and a cutting tool."),
]
def inline(name, size):
    svg = (here / f"{name}.svg").read_text()
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    return svg.replace("<svg ", f'<svg width="{size}" height="{size}" ', 1)
rows = []
for slug, title, note in concepts:
    tiles = ""
    for theme in ("light", "dark"):
        sizes = "".join(f'<div class="s">{inline(slug, s)}<span>{s}</span></div>' for s in (256, 128, 64, 32, 16))
        lockup = f'<div class="lockup">{inline(slug, 56)}<span class="word">lathe</span></div>'
        tiles += f'<div class="tile {theme}"><div class="sizes">{sizes}</div>{lockup}</div>'
    rows.append(f'<section><h2>{title}</h2><p>{note}</p><div class="pair">{tiles}</div></section>')
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Lathe logo options</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700&family=Public+Sans:wght@400;600&display=swap">
<style>
body{{margin:0;padding:32px;background:#E9EDEC;color:#1D2830;font:15px/1.5 "Public Sans",system-ui,sans-serif}}
h1{{font:700 28px Archivo,sans-serif;margin:0 0 24px}} h2{{font:700 20px Archivo,sans-serif;margin:0}} p{{margin:4px 0 12px;color:#5A6870}}
section{{margin-bottom:40px}} .pair{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
.tile{{border-radius:12px;padding:24px;display:grid;gap:24px}}
.light{{background:#F4F6F5;--b:#2E6A88;--a:#B5512A;--ink:#1D2830}} .dark{{background:#11171B;--b:#7DB4D0;--a:#E88A5E;--ink:#E2E8EA}}
.tile .b{{fill:var(--b)}} .tile .a{{fill:var(--a)}}
.sizes{{display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap}} .s{{display:grid;justify-items:center;gap:6px}}
.s span{{font:11px ui-monospace,Menlo,monospace;color:#8A979E}}
.lockup{{display:flex;align-items:center;gap:14px}} .word{{font:700 52px/1 Archivo,sans-serif;letter-spacing:-0.02em;color:var(--ink)}}
</style></head><body><h1>Lathe logo options</h1>{''.join(rows)}</body></html>"""
(here / "preview.html").write_text(html)
print("wrote preview.html")
