import { calculateKAndN, createDataPoints } from './calculator.js';
import { updateChart, toggleChartContainer, updateKNValues } from './chartManager.js';
import { calculateSum, updateSumDisplay, calculateEvaluation, updateEvaluationDisplay, generateResultTableDelta, setupInputFields, exportToExcel } from './evaluation.js';

const {
  selectExcelFile,
  extractChartData,
} = window.electronAPI;

let selectedFilePath = null;

// 메인 차트 계산값 캐시
let lastEpsTrue = null;
let lastSigTrue = null;

// ===== Helpers: compute ε, σ from raw F, t and transform to ln ε, ln σ =====
function computeTrueStressStrainArrays(forceArr, strokeArr, L0, A0) {
  const n = Math.min(forceArr.length, strokeArr.length);
  const epsTrue = []; // ε = ln(1 + t/L0)
  const sigTrue = []; // σ = (F/A0) * (1 + t/L0)
  for (let i = 0; i < n; i++) {
    const F = Number(forceArr[i]); //하중
    const t = Number(strokeArr[i]); //스트로크
    if (!Number.isFinite(F) || !Number.isFinite(t)) continue;
    const e = t / L0;          // engineering strain
    const s = F / A0;          // engineering stress
    const eps = Math.log(1 + e);
    const sig = s * (1 + e);
    if (Number.isFinite(eps) && Number.isFinite(sig) && sig >= 0 && eps >= 0) {
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
function toLog10Segment(epsTrue, sigTrue, startIdx, neckIdx) {
  const lx10=[], ly10=[];
  for (let i=startIdx; i<=neckIdx; i++){
    const e = epsTrue[i], s = sigTrue[i];
    if (e > 0 && s > 0 && Number.isFinite(e) && Number.isFinite(s)) {
      lx10.push(Math.log10(e)); // log10 ε
      ly10.push(Math.log10(s)); // log10 σ
    }
  }
  return { lx10, ly10 };
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

    // F,t → ε(진변형률), σ(진응력)
    const { epsTrue, sigTrue } = computeTrueStressStrainArrays(rawF, rawT, L0, A0);

    if (epsTrue.length < 3) {
      alert('유효한 ε, σ 계산 결과가 부족합니다. 시작/끝 행과 l, a 값을 확인하세요.');
      return;
    }

    // 선형 포인트 생성 ε–σ(선형)
    const linearPoints = createDataPoints(
      // x 배열: ε, y 배열: σ
      epsTrue.filter((v,i)=> Number.isFinite(v) && Number.isFinite(sigTrue[i]) && v >= 0),
      sigTrue.filter((v,i)=> Number.isFinite(v) && Number.isFinite(epsTrue[i]) && v >=0 )
    );

    // --- DEBUG: first sample check (define variables BEFORE using them) ---
    // first-e sample
    const e0 = rawT[0] / L0;                 // t/L0
    const eps0 = Math.log(1 + e0);           // ln(1+e0)
    const s0 = rawF[0] / A0;                 // F/A0
    const sig0 = s0 * (1 + e0);              // s0*(1+e0)

    // screen logger (works even if DevTools closed)
    const dbg = (...args) => {
      const el = document.getElementById('dbg'); if (!el) return;
      el.textContent += args.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n';
    };

    dbg('[DBG] first F,t =', rawF[0], rawT[0]);
    dbg('[DBG] L0=', L0, 'A0=', A0);
    dbg('[DBG] e0 = t/L0 =', e0);
    dbg('[DBG] eps0 = ln(1+e0) =', eps0);
    dbg('[DBG] s0 = F/A0 =', s0);
    dbg('[DBG] sig0 = s0*(1+e0) =', sig0);

    // also print to console
    console.log('[DBG] L0=', L0, 'A0=', A0);
    console.log('[DBG] first F,t =', rawF[0], rawT[0], 'units?');
    console.log('[DBG] e0=t/L0 =', e0);
    console.log('[DBG] eps0=ln(1+e0) =', eps0);
    
    // 차트 컨테이너 표시
    toggleChartContainer(true);
    
    // 차트 생성
    const ctx = document.getElementById('mainChart').getContext('2d');
    updateChart(ctx, linearPoints);

    // 캐시에 저장
    lastEpsTrue = epsTrue;
    lastSigTrue = sigTrue;

  } catch (error) {
    console.error('차트 생성 중 오류:', error);
    alert('차트 생성 중 오류가 발생했습니다.');
  }
});

// 선형 회귀 차트 생성
document.getElementById('generateLogChart').addEventListener('click', () => {
  if (!lastEpsTrue || !lastSigTrue) {
    alert('먼저 메인 차트를 생성하세요.');
    return;
  }

  const epsTrue = lastEpsTrue;
  const sigTrue = lastSigTrue;

  // 1) 넥킹(Considère) 인덱스
  const neckIdx = findNeckIndexConsidere(epsTrue, sigTrue);

  // 2) 구간 시작: 간단히 ε ≥ 0.002 첫 지점(0.2% 오프셋 근사)
  let startIdx = 0;
  for (let i=0; i<epsTrue.length; i++){
    if (epsTrue[i] >= 0.002) { startIdx = i; break; }
  }
  if (startIdx >= neckIdx) startIdx = Math.max(0, neckIdx - 5);

  // 3) 균일 소성 구간만 ln 변환
  const { lx10, ly10 } = toLog10Segment(epsTrue, sigTrue, startIdx, neckIdx);
  if (lx10.length < 3) {
    alert('균일 소성 구간의 로그 데이터가 부족합니다.');
    return;
  }

  // 4) 회귀(lnσ = a + b lnε → K=exp(a), n=b) — 필요 시 K,N UI 업데이트
  const { a, b, R2 } = linreg(lx10, ly10);
  const K = Math.pow(10, a), n = b;

  // (선택) K,N 덮어쓰기
  updateKNValues(K, n);
  updateSumDisplay(calculateSum(K, n));

  // 5) 회귀선 좌표 생성
  const minX = Math.min(...lx10), maxX = Math.max(...lx10), grid = 100;
  const trend = [];
  for (let i=0; i<=grid; i++){
    const x = minX + (maxX-minX)*i/grid;
    const y = a + b*x;
    trend.push({ x, y });
  }

  // 6) 보조 차트 렌더 (lnε–lnσ)
  const ctx2 = document.getElementById('logChart').getContext('2d');
  const scatter = lx10.map((x,i)=> ({ x, y: ly10[i] }));
  if (window.__logChart) window.__logChart.destroy();
  window.__logChart = new Chart(ctx2, {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'lnσ vs lnε (pre-neck)', data: scatter, showLine:false, pointRadius:2, borderWidth:0 },
        { label: 'trend  (lnσ = a lnε + b)', data: trend, showLine:true, pointRadius:0, borderWidth:2 }
      ]
    },
    options: {
      responsive:false, animation:false,
      scales: {
        x: { type:'linear', title:{ display:true, text:'log10 ε' } },
        y: { title:{ display:true, text:'log10 σ' } }
      }
    }
  });

  const infoEl = document.getElementById('knInfo');
  if (infoEl) infoEl.textContent =
    `균일 소성 구간: [${startIdx} ~ ${neckIdx}]  |  K=${K.toFixed(4)}, n=${n.toFixed(4)}, R²=${R2.toFixed(4)} (N=${lx10.length})`;
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
