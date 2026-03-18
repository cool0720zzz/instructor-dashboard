const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const { getMainWindow } = require('./window');

let tray = null;

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

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

  tray.setToolTip('LINO매니저');
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
