const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const { getMainWindow } = require('./window');

let tray = null;

function createTray() {
  // Create a simple 16x16 tray icon programmatically
  const iconSize = 16;
  const icon = nativeImage.createEmpty();

  // Use a built-in or bundled icon; fallback to a generated one
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  try {
    tray = new Tray(iconPath);
  } catch {
    // If no icon file exists, create a simple colored icon
    const canvas = Buffer.alloc(iconSize * iconSize * 4);
    for (let i = 0; i < iconSize * iconSize; i++) {
      canvas[i * 4] = 0x22;     // R
      canvas[i * 4 + 1] = 0xc5; // G
      canvas[i * 4 + 2] = 0x5e; // B
      canvas[i * 4 + 3] = 0xff; // A
    }
    const fallbackIcon = nativeImage.createFromBuffer(canvas, {
      width: iconSize,
      height: iconSize,
    });
    tray = new Tray(fallbackIcon);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '대시보드 열기',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    {
      label: '상단 스냅',
      click: () => {
        const win = getMainWindow();
        if (win) {
          const { createSnapBounds } = require('./window');
          win.setBounds(createSnapBounds('top'));
          win.show();
        }
      },
    },
    {
      label: '우측 스냅',
      click: () => {
        const win = getMainWindow();
        if (win) {
          const { createSnapBounds } = require('./window');
          win.setBounds(createSnapBounds('right'));
          win.show();
        }
      },
    },
    {
      label: '하단 스냅',
      click: () => {
        const win = getMainWindow();
        if (win) {
          const { createSnapBounds } = require('./window');
          win.setBounds(createSnapBounds('bottom'));
          win.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('강사 활동 대시보드');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    }
  });

  return tray;
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, destroyTray };
