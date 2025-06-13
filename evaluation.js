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
 * @param {number} d - 성형 전 봉재 치수
 * @param {number} degree - 금형 반각
 * @param {number} u - 마찰계수
 * @param {number} k - K값
 * @param {number} n - N값
 * @returns {Object} 계산 결과
 */
function calculateValues(d, degree, u, k, n) {
    // d_after 계산 (d = 2 * sqrt(1 - Δ/100))
    const d_after = d * Math.sqrt(1 - degree/100);

    // 단면적 계산
    const f1 = calculateArea(d);
    const f2 = calculateArea(d_after);

    // F 계산 (f1 - f2)
    const F = f1 - f2;

    // 변형도 계산
    const E = Math.log(f1 / f2);

    // k_fm 계산
    const k_fm = k * Math.pow(E, n) / (1 + n);

    // Q 계산
    const Q = (Math.PI * (Math.pow(d, 2) - Math.pow(d_after, 2))) / (4 * Math.sin(degree * Math.PI / 180));

    // km 계산
    const km = k_fm / (1 + ((F + Q * u) / (2 * f2)));

    // Z_N, Z_R, Z_S 계산
    const Z_N = km * F;
    const Z_R = Q * u * km;
    const Z_S = 0.77 * f2 * k_fm * (Math.PI / 180 * degree);

    // a 계산
    const a = (Z_N + Z_R + Z_S) / f2;

    return { km, a, d_after };
}

/**
 * 평가 계산 함수
 * @param {number} d - 성형 전 봉재 치수
 * @param {number} degree - 금형 반각
 * @param {number} u - 마찰계수
 * @param {number} k - K값
 * @param {number} n - N값
 * @returns {string} 평가 결과
 */
export function calculateEvaluation(d, degree, u, k, n) {
    // 입력값 유효성 검사
    if (isNaN(d) || isNaN(degree) || isNaN(u) || isNaN(k) || isNaN(n)) {
        return '유효하지 않은 입력값입니다.';
    }

    // degree가 0인 경우 처리
    if (degree === 0) {
        return '금형 반각은 0이 될 수 없습니다.';
    }

    const { km, a, d_after } = calculateValues(d, degree, u, k, n);

    // 결과 해석
    let result = '';
    if (a < km) {
        result = '사용 가능';
    } else {
        result = '사용 불가능';
    }

    // 상세 정보 포함
    return `${result}\n`;
}

/**
 * Δ(퍼센트 감소율)와 d, degree별로 km, σd(MPa) 값을 표로 출력하는 함수
 * @param {number} d - 성형 전 봉재 치수
 * @param {number[]} deltaArr - 퍼센트 감소율 배열 (예: [5,10,15,...,40])
 * @param {number} u - 마찰계수
 * @param {number} k - K값
 * @param {number} n - N값
 */
export function generateResultTableDelta(d, deltaArr, u, k, n) {
    const tableContainer = document.getElementById('resultTableContainer');
    const table = document.createElement('table');
    table.className = 'result-table';

    // d_after 값 계산
    const d_afterArr = deltaArr.map(delta => d * Math.sqrt(1 - delta/100));

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

    // d_after 값 행 추가
    const d_afterRow = document.createElement('tr');
    d_afterRow.innerHTML = '<th>d_after</th>';
    d_afterArr.forEach(d_after => {
        d_afterRow.innerHTML += `<th>${d_after.toFixed(2)}</th>`;
    });
    thead.appendChild(d_afterRow);
    table.appendChild(thead);

    // 표 본문 생성
    const tbody = document.createElement('tbody');
    for (let degree = 2; degree <= 20; degree += 2) {
        // km 행
        const kmRow = document.createElement('tr');
        kmRow.innerHTML = `<td rowspan="2">${degree}</td>`;
        d_afterArr.forEach((d_after, idx) => {
            const { km, a } = calculateValues(d, degree, u, k, n);
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
        d_afterArr.forEach((d_after, idx) => {
            const { km, a } = calculateValues(d, degree, u, k, n);
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

/**
 * 입력 필드의 포커스 이벤트를 처리하는 함수
 */
export function setupInputFields() {
    const inputs = ['d', 'degree', 'u'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // 포커스 시 기본값 저장
            input.addEventListener('focus', function() {
                if (this.value === this.defaultValue) {
                    this.value = '';
                }
            });
            
            // 포커스 아웃 시 빈 값이면 기본값으로 복원
            input.addEventListener('blur', function() {
                if (this.value === '') {
                    this.value = this.defaultValue;
                }
            });
        }
    });
}

/**
 * 결과 테이블을 엑셀 파일로 내보내는 함수
 * @param {number} d - 성형 전 봉재 치수
 * @param {number[]} deltaArr - 퍼센트 감소율 배열
 * @param {number} u - 마찰계수
 * @param {number} k - K값
 * @param {number} n - N값
 */
export async function exportToExcel(d, deltaArr, u, k, n) {
    try {
        // 데이터 배열 생성
        const data = [];
        const styles = [];
        
        // 헤더 행 추가
        const header = ['Semi-Angle (degree)', ...deltaArr.map(delta => `${delta}%`)];
        data.push(header);
        styles.push(Array(header.length).fill({}));
        
        // d_after 행 추가
        const d_afterArr = deltaArr.map(delta => d * Math.sqrt(1 - delta/100));
        data.push(['d_after', ...d_afterArr.map(val => val.toFixed(2))]);
        styles.push(Array(d_afterArr.length + 1).fill({}));
        
        // 각 degree에 대한 결과 추가
        for (let degree = 2; degree <= 20; degree += 2) {
            // km 행
            const kmRow = [degree];
            const kmStyles = [{}];
            d_afterArr.forEach((d_after, idx) => {
                const { km, a } = calculateValues(d, degree, u, k, n);
                kmRow.push(km.toFixed(2));
                
                // 셀 스타일 설정
                let style = {};
                if (Math.abs(a - km) < 0.0001) {
                    style = { fill: { fgColor: { rgb: "808080" } } }; // 회색
                } else if (a < km) {
                    style = { fill: { fgColor: { rgb: "FFFFFF" } } }; // 흰색
                } else {
                    style = { 
                        fill: { fgColor: { rgb: "000000" } },
                        font: { color: { rgb: "FFFFFF" } }
                    }; // 검은색 배경, 흰색 글씨
                }
                kmStyles.push(style);
            });
            data.push(kmRow);
            styles.push(kmStyles);

            // a 행
            const aRow = [degree];
            const aStyles = [{}];
            d_afterArr.forEach((d_after, idx) => {
                const { km, a } = calculateValues(d, degree, u, k, n);
                aRow.push(a.toFixed(2));
                
                // 셀 스타일 설정
                let style = {};
                if (Math.abs(a - km) < 0.0001) {
                    style = { fill: { fgColor: { rgb: "808080" } } }; // 회색
                } else if (a < km) {
                    style = { fill: { fgColor: { rgb: "FFFFFF" } } }; // 흰색
                } else {
                    style = { 
                        fill: { fgColor: { rgb: "000000" } },
                        font: { color: { rgb: "FFFFFF" } }
                    }; // 검은색 배경, 흰색 글씨
                }
                aStyles.push(style);
            });
            data.push(aRow);
            styles.push(aStyles);
        }
        
        // Electron API를 통해 파일 저장
        const result = await window.electronAPI.saveExcelFile({ data, styles });
        
        if (result.success) {
            alert(result.message);
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('엑셀 내보내기 중 오류:', error);
        alert('엑셀 파일 저장 중 오류가 발생했습니다.');
    }
}
