/**
 * K값과 N값을 더하는 함수
 * @param {number} kValue - K값
 * @param {number} nValue - N값
 * @returns {number} K값과 N값의 합
 */
export function calculateSum(kValue, nValue) {
    // 문자열을 숫자로 변환
    const k = parseFloat(kValue);
    const n = parseFloat(nValue);
    
    // 유효한 숫자인지 확인
    if (isNaN(k) || isNaN(n)) {
        return 'NaN';
    }
    
    // 소수점 8자리까지 반올림
    return (k + n).toFixed(8);
}

/**
 * 계산된 합계를 화면에 표시하는 함수
 * @param {number} sum - K값과 N값의 합
 */
export function updateSumDisplay(sum) {
    const sumElement = document.getElementById('sumValue');
    if (sumElement) {
        sumElement.textContent = sum;
    }
}

/**
 * 단면적 계산 함수
 * @param {number} diameter - 지름
 * @returns {number} 단면적
 */
function calculateArea(diameter) {
    return (Math.PI / 4) * Math.pow(diameter, 2);
}

/**
 * 평가 계산 함수
 * @param {number} before - 성형 전 봉재 치수
 * @param {number} after - 성형 후 봉재 치수
 * @param {number} degree - 금형 반각
 * @param {number} u - 마찰계수
 * @param {number} k - K값
 * @param {number} n - N값
 * @returns {Object} 계산 결과
 */
function calculateValues(before, after, degree, u, k, n) {
    // 단면적 계산
    const f1 = calculateArea(before);
    const f2 = calculateArea(after);

    // F 계산 (f1 - f2)
    const F = f1 - f2;

    // 변형도 계산
    const E = Math.log(f1 / f2);

    // k_fm 계산
    const k_fm = k * Math.pow(E, n) / (1 + n);

    // Q 계산
    const Q = (Math.PI * (Math.pow(before, 2) - Math.pow(after, 2))) / (4 * Math.sin(degree * Math.PI / 180));

    // km 계산
    const km = k_fm / (1 + ((F + Q * u) / (2 * f2)));

    // Z_N, Z_R, Z_S 계산
    const Z_N = km * F;
    const Z_R = Q * u * km;
    const Z_S = 0.77 * f2 * k_fm * (Math.PI / 180 * degree);

    // a 계산
    const a = (Z_N + Z_R + Z_S) / f2;

    return { km, a };
}

/**
 * 평가 계산 함수
 * @param {number} before - 성형 전 봉재 치수
 * @param {number} after - 성형 후 봉재 치수
 * @param {number} degree - 금형 반각
 * @param {number} u - 마찰계수
 * @param {number} k - K값
 * @param {number} n - N값
 * @returns {string} 평가 결과
 */
export function calculateEvaluation(before, after, degree, u, k, n) {
    // 입력값 유효성 검사
    if (isNaN(before) || isNaN(after) || isNaN(degree) || isNaN(u) || isNaN(k) || isNaN(n)) {
        return '유효하지 않은 입력값입니다.';
    }

    // degree가 0인 경우 처리
    if (degree === 0) {
        return '금형 반각은 0이 될 수 없습니다.';
    }

    const { km, a } = calculateValues(before, after, degree, u, k, n);

    // 결과 해석
    let result = '';
    if (a < km) {
        result = '사용 가능';
    } else {
        result = '사용 불가능';
    }

    // 상세 정보 포함
    return `평가 결과: ${result}\n` +
           `a 값: ${a.toFixed(4)}\n` +
           `km 값: ${km.toFixed(4)}`;
}

/**
 * Δ(퍼센트 감소율)와 d, degree별로 km, σd(MPa) 값을 표로 출력하는 함수
 * @param {number} before - 성형 전 봉재 치수
 * @param {number[]} deltaArr - 퍼센트 감소율 배열 (예: [5,10,15,...,40])
 * @param {number} u - 마찰계수
 * @param {number} k - K값
 * @param {number} n - N값
 */
export function generateResultTableDelta(before, deltaArr, u, k, n) {
    const tableContainer = document.getElementById('resultTableContainer');
    const table = document.createElement('table');
    table.className = 'result-table';

    // d 값 계산
    const dArr = deltaArr.map(delta => 2 * Math.sqrt(1 - delta / 100));

    // 표 헤더 생성
    const thead = document.createElement('thead');
    const headerRow1 = document.createElement('tr');
    headerRow1.innerHTML = '<th rowspan="2">Semi-Angle<br>(degree)</th>';
    headerRow1.innerHTML += `<th colspan="${deltaArr.length}">Percent Reduction in Area</th>`;
    thead.appendChild(headerRow1);

    const headerRow2 = document.createElement('tr');
    deltaArr.forEach((delta, idx) => {
        headerRow2.innerHTML += `<th>${delta}</th>`;
    });
    thead.appendChild(headerRow2);

    // d 값 행 추가
    const dRow = document.createElement('tr');
    dRow.innerHTML = '<th>d</th>';
    dArr.forEach(d => {
        dRow.innerHTML += `<th>${d.toFixed(2)}</th>`;
    });
    thead.appendChild(dRow);
    table.appendChild(thead);

    // 표 본문 생성
    const tbody = document.createElement('tbody');
    for (let degree = 2; degree <= 20; degree += 2) {
        // km 행
        const kmRow = document.createElement('tr');
        kmRow.innerHTML = `<td rowspan="2">${degree}</td>`;
        dArr.forEach((d, idx) => {
            const { km, a } = calculateValues(before, d, degree, u, k, n);
            const cell = document.createElement('td');
            if (Math.abs(a - km) < 0.0001) {
                cell.className = 'boundary';
            } else if (a < km) {
                cell.className = 'usable';
            } else {
                cell.className = 'unusable';
            }
            cell.innerHTML = `<span style="color:${cell.className==='unusable'?'white':'black'}">${km.toFixed(2)}</span>`;
            kmRow.appendChild(cell);
        });
        tbody.appendChild(kmRow);
        // σd(MPa) 행
        const aRow = document.createElement('tr');
        dArr.forEach((d, idx) => {
            const { km, a } = calculateValues(before, d, degree, u, k, n);
            const cell = document.createElement('td');
            if (Math.abs(a - km) < 0.0001) {
                cell.className = 'boundary';
            } else if (a < km) {
                cell.className = 'usable';
            } else {
                cell.className = 'unusable';
            }
            cell.innerHTML = `<span style="color:${cell.className==='unusable'?'white':'black'}">${a.toFixed(2)}</span>`;
            aRow.appendChild(cell);
        });
        tbody.appendChild(aRow);
    }
    table.appendChild(tbody);

    // 기존 표 제거 후 새 표 추가
    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
}

/**
 * 평가 결과를 화면에 표시하는 함수
 * @param {string} result - 평가 결과
 */
export function updateEvaluationDisplay(result) {
    const evaluationElement = document.getElementById('evaluationResult');
    if (evaluationElement) {
        evaluationElement.textContent = result;
    }
}
