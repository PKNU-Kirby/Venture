const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

function createWindow () {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,        // ✅ 필수
          nodeIntegration: false,        // ✅ 보안상 false
          enableRemoteModule: false      // ✅ Remote 사용 안함
        }
      });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('select-excel-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile']
  });
  if (canceled) return null;

  const workbook = XLSX.readFile(filePaths[0]);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  return data;
});
