// `npm --prefix desktop run icon`: renders the app icon (LA-PLT-UC14-R01) from build/icon.svg, and
// build/icon-small.svg for 16 and 32 px, to every file the builds and the shell use:
//   build/icon.icns       macOS, every size from 16 to 1024 (iconutil)
//   build/icon.ico        Windows, 16 to 256 (ImageMagick)
//   build/icons/NxN.png   Linux, 16 to 1024
//   build/icon.png        1024 px, the Dock icon of an unpacked `npm start`
//   build/icon-dev.png    1024 px, with a "DEV" band, the Dock icon of `npm run dev`
// Needs rsvg-convert (brew install librsvg) and ImageMagick (brew install imagemagick); iconutil
// comes with macOS. The outputs are committed, so packing needs none of them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const build = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');
const large = readFileSync(path.join(build, 'icon.svg'), 'utf8');
const small = readFileSync(path.join(build, 'icon-small.svg'), 'utf8');

/** The "DEV" band across the foot of the plate, clipped to its rounded corners. */
const BAND = `<g clip-path="url(#plate-clip)">
    <rect x="100" y="742" width="824" height="132" fill="#B5512A"/>
    <rect x="100" y="742" width="824" height="4" fill="#FFFFFF" fill-opacity="0.35"/>
    <text x="512" y="836" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="92" letter-spacing="14" fill="#FFFFFF">DEV</text>
  </g>`;
const dev = large.replace('<!-- BAND -->', BAND);
if (dev === large) throw new Error('build/icon.svg has no <!-- BAND --> marker for the DEV band.');

/** The SVG for a size: the bolder drawing up to 32 px. */
const svgFor = (px: number) => (px <= 32 ? small : large);

function render(svg: string, px: number, out: string) {
  execFileSync('rsvg-convert', ['-w', String(px), '-h', String(px), '-o', out], { input: svg, stdio: ['pipe', 'inherit', 'inherit'] });
}

// macOS: an iconset of every size, then iconutil.
const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-icon-'));
try {
  const iconset = path.join(temp, 'icon.iconset');
  mkdirSync(iconset);
  for (const base of [16, 32, 128, 256, 512]) {
    render(svgFor(base), base, path.join(iconset, `icon_${base}x${base}.png`));
    render(svgFor(base * 2), base * 2, path.join(iconset, `icon_${base}x${base}@2x.png`));
  }
  execFileSync('iconutil', ['-c', 'icns', '-o', path.join(build, 'icon.icns'), iconset], { stdio: 'inherit' });

  // Windows: one .ico holding each size.
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoPngs = icoSizes.map((px) => {
    const file = path.join(temp, `ico-${px}.png`);
    render(svgFor(px), px, file);
    return file;
  });
  execFileSync('magick', [...icoPngs, path.join(build, 'icon.ico')], { stdio: 'inherit' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

// Linux: one PNG per size, as electron-builder reads a folder of them.
const icons = path.join(build, 'icons');
rmSync(icons, { recursive: true, force: true });
mkdirSync(icons);
for (const px of [16, 32, 48, 64, 128, 256, 512, 1024]) render(svgFor(px), px, path.join(icons, `${px}x${px}.png`));

render(large, 1024, path.join(build, 'icon.png'));
render(dev, 1024, path.join(build, 'icon-dev.png'));
console.log(`Wrote icon.icns, icon.ico, icons/, icon.png and icon-dev.png in ${build}`);
