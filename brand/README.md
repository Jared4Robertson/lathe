# Lathe logo options

Three concepts, each hand-built as SVG on a 64 by 64 grid in Lathe's two colours: steel for the body and spark orange for the part that does the work. Open `preview.html` (served, for example, with `python3 -m http.server` in this folder) to see each at 256 to 16 px on light and dark backgrounds, with a wordmark lockup.

| File | Concept |
| --- | --- |
| `chuck.svg` | A three-jaw lathe chuck whose stepped jaws grip at the centre. The simplest; best as a favicon. |
| `recursive.svg` | A chuck gripping the same chuck, smaller: a tool that makes tools, including better versions of itself. Best at 32 px and up. |
| `monogram.svg` | An L built from a lathe: the headstock, the turned work running to the tailstock point, and a tool cutting a groove. |

Colours come from CSS custom properties with fallbacks (`--b` for the body, `--a` for the accent), so a page can recolour a logo for dark mode: light `#2E6A88` / `#B5512A`, dark `#7DB4D0` / `#E88A5E`. `build-preview.py` regenerates `preview.html` after an SVG changes.
