// 균일 소성 변형 구간 자동 추천 (로그-로그 선형성 + 단조성 + 곡률 + 노이즈)

const log10 = (x) => Math.log(x) / Math.LN10;

function linreg(x, y) { // y = a + b x, R^2
  const n = x.length;
  let sx=0, sy=0, sxx=0, sxy=0, syy=0;
  for (let i=0;i<n;i++){ sx+=x[i]; sy+=y[i]; sxx+=x[i]*x[i]; sxy+=x[i]*y[i]; syy+=y[i]*y[i]; }
  const denom = n*sxx - sx*sx || 1e-12;
  const b = (n*sxy - sx*sy) / denom;   // slope
  const a = (sy - b*sx) / n;           // intercept
  let ssTot=0, ssRes=0, ymean=sy/n;
  for (let i=0;i<n;i++){ const yhat=a+b*x[i]; ssRes+=(y[i]-yhat)**2; ssTot+=(y[i]-ymean)**2; }
  const R2 = ssTot>0 ? 1 - ssRes/ssTot : 1;
  return { a, b, R2, ssRes: Math.sqrt(ssRes/n) };
}

function secondDiff(y) { // 간단한 곡률 근사
  const n=y.length, out=new Array(Math.max(0,n-2)).fill(0);
  for (let i=0;i<n-2;i++) out[i] = y[i+2] - 2*y[i+1] + y[i];
  return out;
}

function std(arr) {
  const n = arr.length; if (n===0) return 0;
  const m = arr.reduce((a,b)=>a+b,0)/n;
  const v = arr.reduce((s,x)=>s+(x-m)*(x-m),0)/n;
  return Math.sqrt(v);
}

// ---- 기본: 넥킹 탐지(Considère) ----
export function findNeckIndexConsidere(eps, sig) {
  const n = eps.length;
  if (n < 3) return Math.max(0, n-1);
  const d = new Array(n).fill(0);
  d[0] = (sig[1]-sig[0])/(eps[1]-eps[0]);
  for (let i=1;i<n-1;i++){
    const dx = eps[i+1]-eps[i-1]; d[i] = dx!==0 ? (sig[i+1]-sig[i-1])/dx : d[i-1];
  }
  d[n-1] = (sig[n-1]-sig[n-2])/(eps[n-1]-eps[n-2] || 1e-12);
  for (let i=1;i<n;i++){
    const f0 = d[i-1] - sig[i-1], f1 = d[i] - sig[i];
    if (f0 > 0 && f1 <= 0) return i;
  }
  // 폴백: 최대 σ
  let mi=0; for (let i=1;i<n;i++) if (sig[i] > sig[mi]) mi=i;
  return mi;
}

// ---- 구간 스코어링 ----
// 윈도우 [i..j] (inclusive), log10(ε), log10(σ)에서 선형성(R^2) + 단조성 + 곡률 + 노이즈로 스코어
function scoreWindow(eps, sig, i, j) {
  const len = j - i + 1;
  if (len < 3) return { score: -Infinity };

  // 1) log10 공간으로
  const lx=[], ly=[];
  for (let k=i;k<=j;k++){
    const e = eps[k], s = sig[k];
    if (!(e>0 && s>0 && Number.isFinite(e) && Number.isFinite(s))) return { score: -Infinity };
    lx.push(log10(e)); ly.push(log10(s));
  }

  // 2) 선형회귀
  const { a, b, R2, ssRes } = linreg(lx, ly);

  // 3) 단조성 (σ가 증가)
  let up=0, cnt=0;
  for (let k=i+1;k<=j;k++){ if (sig[k] > sig[k-1]) up++; cnt++; }
  const mono = cnt>0 ? up/cnt : 0;

  // 4) 곡률 (σ vs ε 의 2차차분 평균 절댓값)
  const sd = secondDiff(sig.slice(i, j+1));
  const curv = sd.length ? sd.reduce((s,x)=>s+Math.abs(x),0)/sd.length : 0;

  // 5) 잔차 표준편차 (log10 공간) – 낮을수록 좋음
  const noise = ssRes;

  // 6) 길이 보정(긴 구간 가점)
  const lenBoost = Math.log(1 + len)/Math.log(1 + 100); // ~0..1 정규화 느낌

  const score =
    0.60*R2 +           // 선형성
    0.20*mono +         // 단조성
    0.15*lenBoost -     // 길이 가점
    0.10*noise -        // 노이즈 패널티
    0.10*curv;          // 곡률 패널티

  const K = Math.pow(10, a); // log10σ = a + b*log10ε → k=10^a, n=b
  const n = b;

  return { score, R2, mono, curv, noise, len, a, b, K, n, xStart: eps[i], xEnd: eps[j] };
}

// ---- 후보 구간 탐색 ----
export function suggestUniformSegments(eps, sig, opts={}) {
  const {
    neckIdx = findNeckIndexConsidere(eps, sig),
    minLen = 30,           // 윈도우 최소 길이(샘플 수)
    maxLen = 200,          // 최대 길이
    k = 3                  // 후보 개수
  } = opts;

  const N = Math.min(eps.length, sig.length);
  const endLimit = Math.max(2, Math.min(neckIdx, N-1)); // 넥킹 이전까지만

  const cand = [];
  for (let L = minLen; L <= Math.min(maxLen, endLimit); L += Math.max(1, Math.floor(minLen/2))) {
    for (let i = 0; i + L - 1 <= endLimit; i++) {
      const j = i + L - 1;
      const res = scoreWindow(eps, sig, i, j);
      if (res.score !== -Infinity) {
        cand.push({ i, j, ...res });
      }
    }
  }

  // 스코어 내림차순 정렬
  cand.sort((a,b)=> b.score - a.score);

  // 상위 k개 "비중복" 선택 (겹침 50% 이상이면 스킵)
  const picked = [];
  const used = [];
  const overlaps = (a,b) => {
    const lo = Math.max(a.i, b.i);
    const hi = Math.min(a.j, b.j);
    const inter = Math.max(0, hi - lo + 1);
    const ratio = inter / Math.min(a.j - a.i + 1, b.j - b.i + 1);
    return ratio >= 0.5;
  };

  for (const c of cand) {
    if (picked.length >= k) break;
    let ok = true;
    for (const u of used) {
      if (overlaps(c, u)) { ok = false; break; }
    }
    if (ok) { picked.push(c); used.push(c); }
  }

  return { neckIdx, candidates: picked };
}