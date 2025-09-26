import { createDataPoints } from './calculator.js';
import { updateChart, toggleChartContainer, updateKNValues } from './chartManager.js';
import { calculateSum, updateSumDisplay, calculateEvaluation, updateEvaluationDisplay, generateResultTableDelta, setupInputFields, exportToExcel } from './evaluation.js';
import { suggestUniformSegments, findNeckIndexConsidere } from './segmenter.js';

const {
  selectExcelFile,
  extractChartData,
} = window.electronAPI;

let selectedFilePath = null;

// 메인 차트 계산값 캐시
let lastEpsTrue = null;
let lastSigTrue = null;
// 균일 소성 변형구간
let lastCandidates = null;
let lastNeckIdx = null;

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

// 균일 소성 구간만 log10 변환 (startIdx ~ neckIdx)
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

function drawAuxFromSegment(seg) {
  if (!lastEpsTrue || !lastSigTrue) return;
  const { i, j, a, b, R2 } = seg;

  // log10 산점 만들기
  const lx10 = [], ly10 = [];
  for (let k = i; k <= j; k++) {
    const e = lastEpsTrue[k], s = lastSigTrue[k];
    if (e>0 && s>0) { lx10.push(Math.log10(e)); ly10.push(Math.log10(s)); }
  }
  const K = Math.pow(10, a);
  const n = b;

  // 회귀선
  const minX = Math.min(...lx10), maxX = Math.max(...lx10), grid = 100;
  const trend = [];
  for (let t = 0; t <= grid; t++) {
    const x = minX + (maxX - minX) * t / grid;
    const y = a + b * x;
    trend.push({ x, y });
  }

  // 차트
  const ctx2 = document.getElementById('logChart').getContext('2d');
  const scatter = lx10.map((x,idx)=> ({ x, y: ly10[idx] }));
  if (window.__logChart) window.__logChart.destroy();
  window.__logChart = new Chart(ctx2, {
    type: 'scatter',
    data: { datasets: [
      { label: 'log10σ - log10ε', data: scatter, showLine:false, pointRadius:2, borderWidth:0 },
      { label: 'trend line', data: trend, showLine:true, pointRadius:0, borderWidth:2 }
    ]},
    options: {
      responsive:false, animation:false,
      scales: {
        x: { type:'linear', title:{ display:true, text:'log10 ε' } },
        y: { title:{ display:true, text:'log10 σ' } }
      }
    }
  });

  // K, n UI 덮어쓰기
  updateKNValues(K, n);
  updateSumDisplay(calculateSum(K, n));

  const infoEl = document.getElementById('knInfo');
  if (infoEl) {
    infoEl.textContent = `선택 구간 [${c.xStart.toFixed(6)} ≤ ε ≤ ${c.xEnd.toFixed(6)}]`;
  }
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

  // === Event bindings (moved inside DOMContentLoaded for safety) ===
  const $ = (id) => document.getElementById(id);

  // 엑셀 파일 선택
  const btnLoad = $('loadExcel');
  if (btnLoad) {
    btnLoad.addEventListener('click', async () => {
      const filePath = await selectExcelFile();
      if (filePath) {
        selectedFilePath = filePath;
        const name = String(selectedFilePath).split(/[\\/]/).pop();
        const nameEl = $('selectedFileName');
        if (nameEl) nameEl.textContent = name;
        $('startRow')?.focus();
      }
    });
  }

  // 메인 차트 생성
  const btnMain = $('generateChart');
  if (btnMain) {
    btnMain.addEventListener('click', async () => {
      if (!selectedFilePath) {
        alert('먼저 엑셀 파일을 선택해주세요.');
        return;
      }

      const startRow = parseInt($('startRow').value);
      const endRow = parseInt($('endRow').value);

      const L0 = parseFloat($('inputL')?.value);
      const A0 = parseFloat($('inputA')?.value);

      if (isNaN(startRow) || isNaN(endRow) || startRow < 1 || endRow < 1) {
        alert('시작 행과 끝 행을 1 이상의 숫자로 입력해주세요.');
        return;
      }
      if (startRow >= endRow) { alert('끝 행은 시작 행보다 커야 합니다.'); return; }
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
        if (!result || !result.data) { alert('데이터를 가져오는데 실패했습니다.'); return; }

        const rawF = result.data.labels || [];
        const rawT = result.data.values || [];
        if (rawF.length === 0 || rawT.length === 0) { alert('선택한 범위에서 유효한 데이터를 찾을 수 없습니다.'); return; }

        const { epsTrue, sigTrue } = computeTrueStressStrainArrays(rawF, rawT, L0, A0);
        if (epsTrue.length < 3) { alert('유효한 ε, σ 계산 결과가 부족합니다.'); return; }

        const linearPoints = createDataPoints(
          epsTrue.filter((v,i)=> Number.isFinite(v) && Number.isFinite(sigTrue[i]) && v >= 0),
          sigTrue.filter((v,i)=> Number.isFinite(v) && Number.isFinite(epsTrue[i]) && v >= 0)
        );

        toggleChartContainer(true);
        const ctx = $('mainChart').getContext('2d');
        updateChart(ctx, linearPoints);

        lastEpsTrue = epsTrue;
        lastSigTrue = sigTrue;
      } catch (error) {
        console.error('차트 생성 중 오류:', error);
        alert('차트 생성 중 오류가 발생했습니다.');
      }
    });
  }

  // 구간 추천
  const btnSuggest = $('suggestSegments');
  if (btnSuggest) {
    btnSuggest.addEventListener('click', () => {
      if (!lastEpsTrue || !lastSigTrue) { alert('먼저 메인 차트를 생성하세요.'); return; }
      const { neckIdx, candidates } = suggestUniformSegments(lastEpsTrue, lastSigTrue, { minLen: 30, maxLen: 200, k: 3 });
      lastNeckIdx = neckIdx;
      lastCandidates = candidates;

      const ul = $('segmentList');
      ul.innerHTML = '';
      if (!candidates || candidates.length === 0) { ul.innerHTML = '<li>추천 구간이 없습니다.</li>'; return; }
      candidates.forEach((c, idx) => {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.textContent =   `${idx+1}. [${c.xStart.toFixed(6)} ≤ ε ≤ ${c.xEnd.toFixed(6)}]`;
        li.addEventListener('click', () => drawAuxFromSegment(c));
        ul.appendChild(li);
      });
    });
  }

  // 보조 차트 생성 (기본 자동 구간)
  const btnAux = $('generateLogChart');
  if (btnAux) {
    btnAux.addEventListener('click', () => {
      if (!lastEpsTrue || !lastSigTrue) { alert('먼저 메인 차트를 생성하세요.'); return; }
      const epsTrue = lastEpsTrue;
      const sigTrue = lastSigTrue;
      const neckIdx = findNeckIndexConsidere(epsTrue, sigTrue);
      let startIdx = 0; for (let i=0;i<epsTrue.length;i++){ if (epsTrue[i] >= 0.002) { startIdx = i; break; } }
      if (startIdx >= neckIdx) startIdx = Math.max(0, neckIdx - 5);

      const { lx10, ly10 } = toLog10Segment(epsTrue, sigTrue, startIdx, neckIdx);
      if (lx10.length < 3) { alert('균일 소성 구간의 로그 데이터가 부족합니다.'); return; }

      const { a, b, R2 } = linreg(lx10, ly10);
      const K = Math.pow(10, a), n = b;
      updateKNValues(K, n);
      updateSumDisplay(calculateSum(K, n));

      const minX = Math.min(...lx10), maxX = Math.max(...lx10), grid = 100;
      const trend = []; for (let i=0;i<=grid;i++){ const x = minX + (maxX-minX)*i/grid; const y = a + b*x; trend.push({ x, y }); }

      const ctx2 = $('logChart').getContext('2d');
      const scatter = lx10.map((x,i)=> ({ x, y: ly10[i] }));
      if (window.__logChart) window.__logChart.destroy();
      window.__logChart = new Chart(ctx2, {
        type: 'scatter',
        data: { datasets: [
          { label: 'log10σ - log10ε', data: scatter, showLine:false, pointRadius:2, borderWidth:0 },
          { label: 'trend line', data: trend, showLine:true, pointRadius:0, borderWidth:2 }
        ]},
        options: {
          responsive:false, animation:false,
          scales: {
            x: { type:'linear', title:{ display:true, text:'log ε' } },
            y: { title:{ display:true, text:'log σ' } }
          }
        }
      });

      const infoEl = $('knInfo');
      if (infoEl) infoEl.textContent = `균일 소성 구간: [${startIdx} ~ ${neckIdx}]  |  K=${K.toFixed(4)}, n=${n.toFixed(4)}, R²=${R2.toFixed(4)} (N=${lx10.length})`;
    });
  }

  // 계산기 토글
  const btnVis = $('visibilityCalc');
  if (btnVis) {
    btnVis.addEventListener('click', () => {
      const calculator = document.querySelector('.calc-values');
      if (!calculator) return;
      calculator.style.display = (calculator.style.display === 'none' || calculator.style.display === '') ? 'block' : 'none';
    });
  }
});
