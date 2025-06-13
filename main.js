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

// 엑셀 파일 저장
ipcMain.handle('save-excel-file', async (event, { data, styles }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '엑셀 파일 저장',
      defaultPath: `평가결과_${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] }
      ]
    });

    if (canceled) {
      return { success: false, message: '저장이 취소되었습니다.' };
    }

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    
    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 스타일 적용
    for (let i = 0; i < styles.length; i++) {
      for (let j = 0; j < styles[i].length; j++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: j });
        if (!ws[cellRef]) continue;
        
        const style = styles[i][j];
        if (Object.keys(style).length > 0) {
          ws[cellRef].s = style;
        }
      }
    }
    
    // 워크북에 워크시트 추가
    XLSX.utils.book_append_sheet(wb, ws, "평가 결과");
    
    // 파일 저장
    XLSX.writeFile(wb, filePath);
    
    return { success: true, message: '파일이 저장되었습니다.' };
  } catch (error) {
    console.error('파일 저장 중 오류:', error);
    return { success: false, message: '파일 저장 중 오류가 발생했습니다.' };
  }
});

