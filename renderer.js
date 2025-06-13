import { calculateKAndN, createDataPoints } from './calculator.js';
import { updateChart, toggleChartContainer, updateKNValues } from './chartManager.js';
import { calculateSum, updateSumDisplay, calculateEvaluation, updateEvaluationDisplay, generateResultTableDelta, setupInputFields, exportToExcel } from './evaluation.js';

const {
  selectExcelFile,
  extractChartData,
} = window.electronAPI;

let selectedFilePath = null;

// 페이지 로드 시 기본값 설정
document.addEventListener('DOMContentLoaded', () => {
  const startRowInput = document.getElementById('startRow');
  const endRowInput = document.getElementById('endRow');
  const dInput = document.getElementById('d');
  const degreeInput = document.getElementById('degree');
  const frictionInput = document.getElementById('u');

  // 기본값 설정
  startRowInput.value = '';
  endRowInput.value = '';

  // 입력 필드 이벤트 처리
  startRowInput.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value < 1) this.value = 1;
  });

  endRowInput.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value < 1) this.value = 1;
  });

  // 평가 계산 버튼 이벤트 처리
  document.getElementById('calculateEvaluation').addEventListener('click', () => {
    const d = parseFloat(dInput.value);
    const degree = parseFloat(degreeInput.value);
    const u = parseFloat(frictionInput.value);
    
    // K와 N 값 가져오기
    const kValue = document.getElementById('kValue').textContent;
    const nValue = document.getElementById('nValue').textContent;
    
    const k = parseFloat(kValue);
    const n = parseFloat(nValue);

    // 평가 결과 텍스트
    const result = calculateEvaluation(d, degree, u, k, n);
    updateEvaluationDisplay(result);

    // Δ 배열 정의
    const deltaArr = [5, 10, 15, 20, 25, 30, 35, 40];
    generateResultTableDelta(d, deltaArr, u, k, n);

    // 엑셀 내보내기 버튼 표시
    document.getElementById('exportToExcel').style.display = 'inline-block';
  });

  // 엑셀 내보내기 버튼 이벤트 처리
  document.getElementById('exportToExcel').addEventListener('click', () => {
    const d = parseFloat(dInput.value);
    const degree = parseFloat(degreeInput.value);
    const u = parseFloat(frictionInput.value);
    
    // K와 N 값 가져오기
    const kValue = document.getElementById('kValue').textContent;
    const nValue = document.getElementById('nValue').textContent;
    
    const k = parseFloat(kValue);
    const n = parseFloat(nValue);

    // Δ 배열 정의
    const deltaArr = [5, 10, 15, 20, 25, 30, 35, 40];
    
    // 엑셀 파일로 내보내기
    exportToExcel(d, deltaArr, u, k, n);
  });

  // 입력 필드 설정
  setupInputFields();
});

// // 범위 문자열을 시작과 끝 셀로 분리
// function parseRange(range) {
//   const [start, end] = range.split(':');
//   return { start, end };
// }

// 엑셀 파일 선택
document.getElementById('loadExcel').addEventListener('click', async () => {
  const filePath = await selectExcelFile();
  if (filePath) {
    selectedFilePath = filePath;
    document.getElementById('startRow').focus();
  }
});

// 차트 생성
document.getElementById('generateChart').addEventListener('click', async () => {
  if (!selectedFilePath) {
    alert('먼저 엑셀 파일을 선택해주세요.');
    return;
  }

  const startRow = parseInt(document.getElementById('startRow').value);
  const endRow = parseInt(document.getElementById('endRow').value);

  // 입력 검증
  if (isNaN(startRow) || isNaN(endRow) || startRow < 1 || endRow < 1) {
    alert('시작 행과 끝 행을 1 이상의 숫자로 입력해주세요.');
    return;
  }

  if (startRow >= endRow) {
    alert('끝 행은 시작 행보다 커야 합니다.');
    return;
  }

  try {
    const result = await extractChartData(selectedFilePath, {
      xStartCell: `C${startRow}`,
      xEndCell: `C${endRow}`,
      yStartCell: `D${startRow}`,
      yEndCell: `D${endRow}`
    });

    if (!result || !result.data) {
      alert('데이터를 가져오는데 실패했습니다.');
      return;
    }

    const chartData = result.data;
    
    // 데이터 유효성 검사
    if (chartData.labels.length === 0 || chartData.values.length === 0) {
      alert('선택한 범위에서 유효한 데이터를 찾을 수 없습니다.');
      return;
    }

    // 데이터 포인트 생성
    const dataPoints = createDataPoints(chartData.labels, chartData.values);
    
    // K와 N 값 계산
    const { k, n } = calculateKAndN(chartData.labels, chartData.values);
    
    // K와 N 값 표시
    updateKNValues(k, n);
    
    // K와 N 값의 합 계산 및 표시
    const sum = calculateSum(k, n);
    updateSumDisplay(sum);
    
    // 차트 컨테이너 표시
    toggleChartContainer(true);
    
    // 차트 생성
    const ctx = document.getElementById('mainChart').getContext('2d');
    updateChart(ctx, dataPoints);

  } catch (error) {
    console.error('차트 생성 중 오류:', error);
    alert('차트 생성 중 오류가 발생했습니다.');
  }
});

// 계산기 토글 버튼
document.getElementById('visibilityCalc').addEventListener('click', async () => {
  const calculator = document.querySelector('.calc-values');

  if (calculator.style.display === 'none' || calculator.style.display === '') {
    calculator.style.display = 'block';
  } else {
    calculator.style.display = 'none';
  }
});
