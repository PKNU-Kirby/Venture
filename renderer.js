import { calculateKAndN, createDataPoints } from './calculator.js';
import { updateChart, toggleChartContainer, updateKNValues } from './chartManager.js';
import { calculateSum, updateSumDisplay, calculateEvaluation, updateEvaluationDisplay, generateResultTableDelta, setupInputFields, exportToExcel } from './evaluation.js';

const {
  selectExcelFile,
  extractChartData,
} = window.electronAPI;

let selectedFilePath = null;

// ===== Helpers: compute ε, σ from raw F, t and transform to ln ε, ln σ =====
function computeTrueStressStrainArrays(forceArr, strokeArr, L0, A0) {
  const n = Math.min(forceArr.length, strokeArr.length);
  const epsTrue = []; // ε = ln(1 + t/L0)
  const sigTrue = []; // σ = (F/A0) * (1 + t/L0)
  for (let i = 0; i < n; i++) {
    const F = Number(forceArr[i]);
    const t = Number(strokeArr[i]);
    if (!Number.isFinite(F) || !Number.isFinite(t)) continue;
    const e = t / L0;          // engineering strain
    const s = F / A0;          // engineering stress
    const eps = Math.log(1 + e);
    const sig = s * (1 + e);
    if (Number.isFinite(eps) && Number.isFinite(sig) && sig > 0 && eps > 0) {
      epsTrue.push(eps);
      sigTrue.push(sig);
    }
  }
  return { epsTrue, sigTrue };
}

function toLogArrays(epsTrue, sigTrue) {
  const lx = [], ly = [];
  for (let i = 0; i < epsTrue.length; i++) {
    const le = Math.log(epsTrue[i]);   // ln ε
    const ls = Math.log(sigTrue[i]);   // ln σ
    if (Number.isFinite(le) && Number.isFinite(ls)) {
      lx.push(le);
      ly.push(ls);
    }
  }
  return { lx, ly };
}

// ===== Helpers: 미분, 넥킹(Considère), 회귀, ln 변환 =====
function derivative(x, y) {
  const n = x.length, d = Array(n).fill(0);
  if (n < 3) return d;
  d[0] = (y[1]-y[0])/(x[1]-x[0]);
  for (let i=1;i<n-1;i++){
    const dx = x[i+1]-x[i-1];
    d[i] = dx!==0 ? (y[i+1]-y[i-1])/dx : 0;
  }
  d[n-1] = (y[n-1]-y[n-2])/(x[n-1]-x[n-2]);
  return d;
}

// Considère 기준: dσ/dε = σ  → f = dσ/dε - σ 의 부호 +→- 첫 지점
function findNeckIndexConsidere(epsTrue, sigTrue) {
  const dsdE = derivative(epsTrue, sigTrue);
  for (let i=1;i<sigTrue.length;i++){
    const f0 = dsdE[i-1] - sigTrue[i-1];
    const f1 = dsdE[i]   - sigTrue[i];
    if (f0 > 0 && f1 <= 0) return i;
  }
  // 폴백: σ 최대(UTS) 지점
  return sigTrue.reduce((mi,v,i)=> v>sigTrue[mi]?i:mi, 0);
}

// 간단 선형회귀: y = a + b x  (R^2 포함)
function linreg(x, y) {
  const n=x.length;
  let sx=0,sy=0,sxx=0,sxy=0,syy=0;
  for (let i=0;i<n;i++){ sx+=x[i]; sy+=y[i]; sxx+=x[i]*x[i]; sxy+=x[i]*y[i]; syy+=y[i]*y[i]; }
  const denom = n*sxx - sx*sx || 1e-12;
  const b = (n*sxy - sx*sy) / denom;
  const a = (sy - b*sx) / n;
  let ssTot=0, ssRes=0, ymean=sy/n;
  for (let i=0;i<n;i++){ const yhat=a+b*x[i]; ssRes+=(y[i]-yhat)**2; ssTot+=(y[i]-ymean)**2; }
  const R2 = ssTot>0 ? 1-ssRes/ssTot : 1;
  return { a, b, R2 };
}

// 균일 소성 구간만 ln 변환 (startIdx ~ neckIdx)
function toLogSegment(epsTrue, sigTrue, startIdx, neckIdx) {
  const lx=[], ly=[];
  for (let i=startIdx; i<=neckIdx; i++){
    const e = epsTrue[i], s = sigTrue[i];
    if (e > 0 && s > 0 && Number.isFinite(e) && Number.isFinite(s)) {
      lx.push(Math.log(e)); // ln ε
      ly.push(Math.log(s)); // ln σ
    }
  }
  return { lx, ly };
}


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
    
     // 파일명 표시
    const name = String(selectedFilePath).split(/[\\/]/).pop();
    const nameEl = document.getElementById('selectedFileName');
    if (nameEl) nameEl.textContent = name;

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

  // l, a 입력(필수)
  const L0Input = document.getElementById('inputL');
  const A0Input = document.getElementById('inputA');
  const L0 = L0Input ? parseFloat(L0Input.value) : NaN;
  const A0 = A0Input ? parseFloat(A0Input.value) : NaN;


  // 입력 검증
  if (isNaN(startRow) || isNaN(endRow) || startRow < 1 || endRow < 1) {
    alert('시작 행과 끝 행을 1 이상의 숫자로 입력해주세요.');
    return;
  }

  if (startRow >= endRow) {
    alert('끝 행은 시작 행보다 커야 합니다.');
    return;
  }

  if (!Number.isFinite(L0) || !Number.isFinite(A0) || L0 <= 0 || A0 <= 0) {
    alert('l (초기 길이)와 a (초기 단면적)을 올바르게 입력하세요.');
    return;
  }

  try {
    const result = await extractChartData(selectedFilePath, {
      xStartCell: `A${startRow}`,
      xEndCell: `A${endRow}`,
      yStartCell: `B${startRow}`,
      yEndCell: `B${endRow}`
    });

    if (!result || !result.data) {
      alert('데이터를 가져오는데 실패했습니다.');
      return;
    }

    const rawF = result.data.labels || [];  // A열: F
    const rawT = result.data.values || [];  // B열: t

    if (rawF.length === 0 || rawT.length === 0) {
      alert('선택한 범위에서 유효한 데이터를 찾을 수 없습니다.');
      return;
    }

    // 1) F,t → ε(진변형률), σ(진응력)
    const { epsTrue, sigTrue } = computeTrueStressStrainArrays(rawF, rawT, L0, A0);

    if (epsTrue.length < 3) {
      alert('유효한 ε, σ 계산 결과가 부족합니다. 시작/끝 행과 l, a 값을 확인하세요.');
      return;
    }

    // 2) ln ε, ln σ로 변환 (기존 calculator.js가 로그-로그 데이터를 기대)
    const { lx, ly } = toLogArrays(epsTrue, sigTrue);
    if (lx.length < 3) {
      alert('로그 변환 후 유효한 샘플이 부족합니다.');
      return;
    }

    // 데이터 포인트 생성(로그-로그)
    const dataPoints = createDataPoints(lx, ly);

    // K와 N 값 계산 (lnσ = lnK + n·lnε)
    const { k, n } = calculateKAndN(lx, ly);

    // K와 N 표시
    updateKNValues(k, n);
    
    // K와 N 값의 합 계산 및 표시
    const sum = calculateSum(k, n);
    updateSumDisplay(sum);

    // 선형 포인트 생성 ε–σ(선형)
    const linearPoints = createDataPoints(
      // x 배열: ε, y 배열: σ
      epsTrue.filter((v,i)=> Number.isFinite(v) && Number.isFinite(sigTrue[i])),
      sigTrue.filter((v,i)=> Number.isFinite(v) && Number.isFinite(epsTrue[i]))
    );
    
    // 차트 컨테이너 표시
    toggleChartContainer(true);
    
    // 차트 생성
    const ctx = document.getElementById('mainChart').getContext('2d');
    updateChart(ctx, linearPoints);

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
