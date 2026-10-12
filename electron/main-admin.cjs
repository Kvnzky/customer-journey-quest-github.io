const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Isolate user data directory and disable problematic GPU cache
app.setName('CustomerJourneyQuestAdmin');
app.setPath('userData', path.join(app.getPath('appData'), 'CustomerJourneyQuestAdmin'));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Shared directory for inter-app sync between Game and Admin Portal
const sharedDir = path.join(app.getPath('appData'), 'CustomerJourneyQuestShared');
if (!fs.existsSync(sharedDir)) {
  try { fs.mkdirSync(sharedDir, { recursive: true }); } catch (_) {}
}
const sharedSettingsFile = path.join(sharedDir, 'game-settings.json');
const sharedQuestionsFile = path.join(sharedDir, 'shared-questions.json');

ipcMain.handle('get-shared-settings', () => {
  try {
    if (fs.existsSync(sharedSettingsFile)) {
      const data = fs.readFileSync(sharedSettingsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read shared settings:', err.message);
  }
  return null;
});

ipcMain.handle('save-shared-settings', (event, settings) => {
  try {
    fs.writeFileSync(sharedSettingsFile, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('Could not save shared settings:', err.message);
    return false;
  }
});

ipcMain.handle('get-shared-questions', () => {
  try {
    if (fs.existsSync(sharedQuestionsFile)) {
      const data = fs.readFileSync(sharedQuestionsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read shared questions:', err.message);
  }
  return null;
});

ipcMain.handle('save-shared-questions', (event, questions) => {
  try {
    fs.writeFileSync(sharedQuestionsFile, JSON.stringify(questions, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('Could not save shared questions:', err.message);
    return false;
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let adminWindow = null;

  function createAdminWindow() {
    adminWindow = new BrowserWindow({
      width: 1360,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      title: 'Customer Journey Quest — Admin Portal',
      backgroundColor: '#060e19',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false // allow relative local asset resolution
      }
    });

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      adminWindow.loadURL('http://localhost:5173/admin.html').catch(() => {
        adminWindow.loadFile(path.join(__dirname, '..', 'dist', 'admin.html'));
      });
    } else {
      adminWindow.loadFile(path.join(__dirname, '..', 'dist', 'admin.html'));
    }

    adminWindow.on('closed', () => {
      adminWindow = null;
    });
  }

  app.on('second-instance', () => {
    if (adminWindow) {
      if (adminWindow.isMinimized()) adminWindow.restore();
      adminWindow.focus();
    }
  });

  app.whenReady().then(createAdminWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createAdminWindow();
    }
  });
}
