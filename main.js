const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, 'secure.env') });

ipcMain.handle('analyze-chart-data', async (event, chartData) => {
  console.log('분석 요청 수신:', chartData);

  if (!chartData || !chartData.labels || !chartData.values) {
    throw new Error('유효하지 않은 차트 데이터입니다.');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.');
  }

  const endpoint = 'https://api.openai.com/v1/chat/completions';

  try {
    const prompt = `
      다음은 차트를 그리기 위한 데이터입니다.
      X축 레이블: ${chartData.labels.join(', ')}
      Y축 값: ${chartData.values.join(', ')}

      다음 항목들을 분석해주세요:
      1. 전체적인 데이터의 추세
      2. 주요 특징이나 패턴
      3. 특이사항이나 주목할 만한 점
      4. 데이터의 의미나 시사점
    `;

    const res = await axios.post(endpoint, {
      model: "gpt-4",
      messages: [
        { 
          role: "system", 
          content: "당신은 데이터 분석 전문가입니다. 차트 데이터를 분석하여 명확하고 구조화된 인사이트를 제공해주세요." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.data || !res.data.choices || !res.data.choices[0]) {
      throw new Error('API 응답이 올바르지 않습니다.');
    }

    return res.data.choices[0].message.content;
  } catch (err) {
    console.error('GPT 분석 오류:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      throw new Error('API 키가 유효하지 않습니다.');
    } else if (err.response?.status === 429) {
      throw new Error('API 요청 한도를 초과했습니다.');
    } else {
      throw new Error(`분석 중 오류가 발생했습니다: ${err.message}`);
    }
  }
});

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

