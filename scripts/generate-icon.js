const fs = require('fs');
const path = require('path');
const { imagesToIco } = require('png-to-ico');

async function main() {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const outDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 128, 256];
  const pngPaths = [];

  for (const s of sizes) {
    await page.setViewport({ width: s, height: s });
    await page.setContent(`
      <html>
      <body style="margin:0;padding:0;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e3a5f,#0f172a);overflow:hidden">
        <div style="font-size:${Math.round(s * 0.55)}px;font-weight:900;color:#60a5fa;font-family:'Malgun Gothic',sans-serif">강</div>
      </body>
      </html>
    `);
    const pngPath = path.join(outDir, `icon-${s}.png`);
    await page.screenshot({ path: pngPath });
    pngPaths.push(pngPath);
  }

  // Copy 256 as the main icon.png
  fs.copyFileSync(path.join(outDir, 'icon-256.png'), path.join(outDir, 'icon.png'));

  await browser.close();

  // Convert PNGs to ICO
  const pngToIco = require('png-to-ico').default;
  const icoBuffer = await pngToIco(pngPaths);
  const icoPath = path.join(outDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);

  // Clean up temp PNGs
  for (const p of pngPaths) {
    if (!p.endsWith('icon-256.png')) fs.unlinkSync(p);
  }

  console.log('Created: assets/icon.png');
  console.log('Created: assets/icon.ico');
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });
