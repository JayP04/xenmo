const fs = require('fs');
const path = require('path');

const pubDir = path.join(__dirname, '..', 'public');

function createSVG(size, rounded) {
  const fontSize = Math.round(size * 0.35);
  const yPos = Math.round(size * 0.58);
  const rx = rounded ? Math.round(size * 0.2) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#0A84FF"/>
  <text x="${size / 2}" y="${yPos}" text-anchor="middle" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="${fontSize}" fill="#FFFFFF">RX</text>
</svg>`;
}

// Standard icons
[192, 512].forEach(size => {
  fs.writeFileSync(path.join(pubDir, `icon-${size}.svg`), createSVG(size, true));
});

// Maskable icon (no rounding, full bleed for safe zone)
fs.writeFileSync(path.join(pubDir, 'icon-maskable-512.svg'), createSVG(512, false));

// Apple touch icon
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.svg'), createSVG(180, true));

console.log('Icon SVGs generated in public/');
