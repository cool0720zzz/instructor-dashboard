const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { default: pngToIco } = require('png-to-ico');

async function main() {
  const srcPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const outDir = path.join(__dirname, '..', 'assets');

  if (!fs.existsSync(srcPath)) {
    console.error('assets/icon.png not found');
    process.exit(1);
  }

  // Resize to 256x256 for ICO conversion (NSIS max)
  const resizedPath = path.join(outDir, 'icon-256.png');
  await sharp(srcPath).resize(256, 256).png().toFile(resizedPath);

  const icoBuffer = await pngToIco([resizedPath]);
  const icoPath = path.join(outDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);

  // Clean up temp file
  fs.unlinkSync(resizedPath);

  console.log('Created: assets/icon.ico');
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });
