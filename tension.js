// app/tension.js
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

function linreg(x, y) { // lnσ = a + b lnε
  const n=x.length;
  let sx=0,sy=0,sxx=0,sxy=0,syy=0;
  for (let i=0;i<n;i++){ sx+=x[i]; sy+=y[i]; sxx+=x[i]*x[i]; sxy+=x[i]*y[i]; syy+=y[i]*y[i]; }
  const denom = n*sxx - sx*sx || 1e-12;
  const b = (n*sxy - sx*sy)/denom;
  const a = (sy - b*sx)/n;
  let ssTot=0, ssRes=0, ymean=sy/n;
  for (let i=0;i<n;i++){ const yhat=a+b*x[i]; ssRes+=(y[i]-yhat)**2; ssTot+=(y[i]-ymean)**2; }
  const R2 = ssTot>0 ? 1-ssRes/ssTot : 1;
  return { a, b, R2 };
}

function computeTrue(force, stroke, L0, A0) {
  const n = Math.min(force.length, stroke.length);
  const eps = new Array(n);
  const sig = new Array(n);
  for (let i=0;i<n;i++){
    const e = stroke[i]/L0;          // 공학 변형률 e = t/l
    const s = force[i]/A0;           // 공학 응력   s = F/a
    const epsTrue = Math.log(1+e);   // ε = ln(1+e)
    const sigTrue = s*(1+e);         // σ = s*(1+e)
    eps[i]=epsTrue; sig[i]=sigTrue;
  }
  return { eps, sig };
}

function findNeckIndex(eps, sig) {
  // Considère: dσ/dε = σ  → f = dσ/dε - σ  의 +→- 첫 지점
  const dsdE = derivative(eps, sig);
  for (let i=1;i<sig.length;i++){
    const f0 = dsdE[i-1]-sig[i-1];
    const f1 = dsdE[i]-sig[i];
    if (f0>0 && f1<=0) return i;
  }
  // 폴백: 최대 σ 지점
  return sig.reduce((mi,v,i)=> v>sig[mi]?i:mi, 0);
}

function fitHollomon(eps, sig, start=0, end=null) {
  const R = [];
  const last = end ?? (eps.length-1);
  for (let i=start;i<=last;i++){
    if (eps[i]>0 && sig[i]>0 && Number.isFinite(eps[i]) && Number.isFinite(sig[i])) {
      R.push([Math.log(eps[i]), Math.log(sig[i])]);
    }
  }
  if (R.length<3) return null;
  const xs = R.map(r=>r[0]), ys=R.map(r=>r[1]);
  const {a,b,R2} = linreg(xs, ys);
  return { K: Math.exp(a), n: b, R2, count: R.length };
}

// 메인 엔트리
function analyze({ force, stroke, L0, A0 }) {
  const { eps, sig } = computeTrue(force, stroke, L0, A0);
  const neckIdx = findNeckIndex(eps, sig);
  const model   = fitHollomon(eps, sig, 0, neckIdx); // 넥킹 이전까지만 회귀
  return { eps, sig, neckIdx, model };
}

module.exports = { analyze };