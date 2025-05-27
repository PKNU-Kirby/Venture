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
          enableRemoteModule: false,      // ✅ Remote 사용 안함
          sandox: false
        }
      });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

// 특정 범위의 데이터를 추출하는 함수
function getDataFromRange(worksheet, xRange, yRange) {
  const xStartCol = xRange.start.match(/[A-Z]+/)[0];
  const xStartRow = parseInt(xRange.start.match(/\d+/)[0]);
  const xEndRow = parseInt(xRange.end.match(/\d+/)[0]);
  
  const yStartCol = yRange.start.match(/[A-Z]+/)[0];
  const yStartRow = parseInt(yRange.start.match(/\d+/)[0]);
  const yEndRow = parseInt(yRange.end.match(/\d+/)[0]);

  const data = {
    labels: [],
    values: []
  };

  // X축 데이터 (레이블) 추출
  for (let row = xStartRow; row <= xEndRow; row++) {
    const cellAddress = `${xStartCol}${row}`;
    const cell = worksheet[cellAddress];
    if (cell) {
      data.labels.push(cell.v);
    }
  }

  // Y축 데이터 (값) 추출
  for (let row = yStartRow; row <= yEndRow; row++) {
    const cellAddress = `${yStartCol}${row}`;
    const cell = worksheet[cellAddress];
    if (cell) {
      if (typeof cell.v === 'number') {
        data.values.push(cell.v);
      } else {
        // 숫자가 아닌 경우 0으로 처리
        data.values.push(0);
      }
    }
  }

  return data;
}

// Excel 파일 선택
ipcMain.handle('select-excel-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile']
  });
  
  if (canceled) return null;
  return filePaths[0];
});

// 차트 데이터 추출
ipcMain.handle('extract-chart-data', async (event, filePath, range) => {
  try {
    console.log('파일 경로:', filePath);
    console.log('선택된 범위:', range);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 범위에서 데이터 추출
    const chartData = getDataFromRange(worksheet, 
      { start: range.xStartCell, end: range.xEndCell },
      { start: range.yStartCell, end: range.yEndCell }
    );

    console.log('추출된 데이터:', {
      labels: chartData.labels,
      values: chartData.values
    });

    return {
      sheetName,
      data: chartData
    };
  } catch (error) {
    console.error('데이터 추출 중 오류:', error);
    throw error;
  }
});

