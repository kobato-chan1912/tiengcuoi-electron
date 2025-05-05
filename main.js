const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromise = require('fs').promises;
const { checkLicense } = require('./license');
const LICENSE_FILE = path.join(app.getPath('userData'), 'license.json');
require('dotenv').config();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    title: process.env.APP_NAME,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: false,

    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});




app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});


ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav'] }]
  });
  if (canceled) return null;
  return filePaths[0];
});


ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const result = await dialog.showSaveDialog({
    title: 'Save File',
    defaultPath: path.join(app.getPath('documents'), defaultName || 'test.xlsx'),
    filters: [
      { name: 'Excel Files', extensions: ['xlsx'] },
    ],
  });

  return result.filePath; // Return the selected file path or undefined if canceled
});

ipcMain.on('select-dirs', async (event, arg) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  console.log('directories selected', result.filePaths)
})


// Lắng nghe sự kiện chọn folder từ Renderer
ipcMain.handle('select-folder', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled) {
    return result.filePaths[0];
  } else {
    return null;
  }
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.on('save-license', (event, license) => {
  const data = { license };
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data));
});




let licenseCache = null;

ipcMain.handle('get-license-info', async () => {
  // Nếu cache chưa có, kiểm tra lại
  if (!licenseCache) {
    const { valid, licenseType, expiredDate } = await checkLicense();

    global.licenseType = licenseType;
    global.valid = valid;
    global.expiredDate = expiredDate;

    licenseCache = {
      licenseType,
      expiredDate
    };

    console.log('[Checked] License:', licenseType, expiredDate);
  }

  return {
    licenseType: global.licenseType || 'free',
    expiredDate: global.expiredDate || null
  };
});

