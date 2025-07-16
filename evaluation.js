/**
 * K값과 N값을 더하는 함수
 */
export function calculateSum(kValue, nValue) {
    const k = parseFloat(kValue);
    const n = parseFloat(nValue);
    if (isNaN(k) || isNaN(n)) return 'NaN';
    return (k + n).toFixed(8);
}

/**
 * 계산된 합계를 화면에 표시하는 함수
 */
export function updateSumDisplay(sum) {
    const sumElement = document.getElementById('sumValue');
    if (sumElement) sumElement.textContent = sum;
}

function calculateArea(diameter) {
    return (Math.PI / 4) * Math.pow(diameter, 2);
}

function calculateValues(d, delta, degree, u, k, n) {
    const d_after = d * Math.sqrt(1 - delta / 100);
    const f1 = calculateArea(d);
    const f2 = calculateArea(d_after);
    const F = f1 - f2;
    const E = Math.log(f1 / f2);
    const k_fm = k * Math.pow(E, n) / (1 + n);
    const Q = (Math.PI * (Math.pow(d, 2) - Math.pow(d_after, 2))) / (4 * Math.sin(degree * Math.PI / 180));
    const km = k_fm / (1 + ((F + Q * u) / (2 * f2)));
    const Z_N = km * F;
    const Z_R = Q * u * km;
    const Z_S = 0.77 * f2 * k_fm * (Math.PI / 180 * degree);
    const a = (Z_N + Z_R + Z_S) / f2;
    return { km, a, d_after };
}

export function calculateEvaluation(d, degree, u, k, n) {
    if (isNaN(d) || isNaN(degree) || isNaN(u) || isNaN(k) || isNaN(n)) return '유효하지 않은 입력값입니다.';
    if (degree === 0) return '금형 반각은 0이 될 수 없습니다.';
    const { km, a } = calculateValues(d, 20, degree, u, k, n);
    return a < km ? '사용 가능\n' : '사용 불가능\n';
}

export function generateResultTableDelta(d, deltaArr, u, k, n) {
    const tableContainer = document.getElementById('resultTableContainer');
    const table = document.createElement('table');
    table.className = 'result-table';

    const thead = document.createElement('thead');
    const headerRow1 = document.createElement('tr');
    headerRow1.innerHTML = `<th rowspan="2">Semi-Angle<br>(degree)</th><th colspan="${deltaArr.length}">Percent Reduction in Area</th>`;
    thead.appendChild(headerRow1);

    const headerRow2 = document.createElement('tr');
    deltaArr.forEach(delta => {
        headerRow2.innerHTML += `<th>${delta}</th>`;
    });
    thead.appendChild(headerRow2);

    const d_afterRow = document.createElement('tr');
    d_afterRow.innerHTML = '<th>d_after</th>';
    deltaArr.forEach(delta => {
        const { d_after } = calculateValues(d, delta, 10, u, k, n);
        d_afterRow.innerHTML += `<th>${d_after.toFixed(2)}</th>`;
    });
    thead.appendChild(d_afterRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let degree = 2; degree <= 20; degree += 2) {
        const kmRow = document.createElement('tr');
        kmRow.innerHTML = `<td rowspan="2">${degree}</td>`;
        const classArray = [];

        deltaArr.forEach((delta, idx) => {
            const { km, a } = calculateValues(d, delta, degree, u, k, n);
            const cell = document.createElement('td');
            let cls = '';
            if (Math.abs(a - km) < 0.0001) {
                cls = 'boundary';
            } else if (a < km) {
                cls = 'usable';
            } else {
                cls = 'unusable';
            }
            classArray.push(cls);
            cell.className = cls;
            cell.innerHTML = `<span style="color:${cls === 'unusable' ? 'white' : 'black'}">${km.toFixed(2)}</span>`;
            kmRow.appendChild(cell);
        });
        tbody.appendChild(kmRow);

        const aRow = document.createElement('tr');
        deltaArr.forEach((delta, idx) => {
            const { km, a } = calculateValues(d, delta, degree, u, k, n);
            let cls = classArray[idx];
            const prev = classArray[idx - 1];
            const next = classArray[idx + 1];
            if (cls === 'usable' && (prev === 'unusable' || next === 'unusable')) {
                cls = 'boundary';
                const kmCell = kmRow.children[idx + 1];
                if (kmCell) kmCell.className = 'boundary';
            }
            const cell = document.createElement('td');
            cell.className = cls;
            cell.innerHTML = `<span style="color:${cls === 'unusable' ? 'white' : 'black'}">${a.toFixed(2)}</span>`;
            aRow.appendChild(cell);
        });
        tbody.appendChild(aRow);
    }

    table.appendChild(tbody);
    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
}

export function updateEvaluationDisplay(result) {
    const evaluationElement = document.getElementById('evaluationResult');
    if (evaluationElement) {
        evaluationElement.textContent = result;
    }
}

export function setupInputFields() {
    const inputs = ['d', 'degree', 'u'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('focus', function () {
                if (this.value === this.defaultValue) this.value = '';
            });
            input.addEventListener('blur', function () {
                if (this.value === '') this.value = this.defaultValue;
            });
        }
    });
}

export async function exportToExcel(d, deltaArr, u, k, n) {
    try {
        const data = [];
        const styles = [];
        const header = ['Semi-Angle (degree)', ...deltaArr.map(delta => `${delta}%`)];
        data.push(header);
        styles.push(Array(header.length).fill({}));

        const d_afterRow = ['d_after'];
        deltaArr.forEach(delta => {
            const { d_after } = calculateValues(d, delta, 10, u, k, n);
            d_afterRow.push(d_after.toFixed(2));
        });
        data.push(d_afterRow);
        styles.push(Array(d_afterRow.length).fill({}));

        for (let degree = 2; degree <= 20; degree += 2) {
            const kmRow = [degree];
            const kmStyles = [{}];
            const classArray = [];

            deltaArr.forEach(delta => {
                const { km, a } = calculateValues(d, delta, degree, u, k, n);
                kmRow.push(km.toFixed(2));
                let style = {};
                let cls = '';
                if (Math.abs(a - km) < 0.0001) {
                    cls = 'boundary';
                    style = { fill: { fgColor: { rgb: "808080" } } };
                } else if (a < km) {
                    cls = 'usable';
                    style = { fill: { fgColor: { rgb: "FFFFFF" } } };
                } else {
                    cls = 'unusable';
                    style = {
                        fill: { fgColor: { rgb: "000000" } },
                        font: { color: { rgb: "FFFFFF" } }
                    };
                }
                classArray.push(cls);
                kmStyles.push(style);
            });
            data.push(kmRow);
            styles.push(kmStyles);

            const aRow = [degree];
            const aStyles = [{}];
            deltaArr.forEach((delta, idx) => {
                const { km, a } = calculateValues(d, delta, degree, u, k, n);
                aRow.push(a.toFixed(2));
                let cls = classArray[idx];
                let style = {};
                const prev = classArray[idx - 1];
                const next = classArray[idx + 1];
                if (cls === 'usable' && (prev === 'unusable' || next === 'unusable')) {
                    style = { fill: { fgColor: { rgb: "808080" } } };
                    const kmStyle = styles[styles.length - 1][idx + 1];
                    if (kmStyle) kmStyle.fill = { fgColor: { rgb: "808080" } };
                } else if (cls === 'unusable') {
                    style = {
                        fill: { fgColor: { rgb: "000000" } },
                        font: { color: { rgb: "FFFFFF" } }
                    };
                } else {
                    style = { fill: { fgColor: { rgb: "FFFFFF" } } };
                }
                aStyles.push(style);
            });
            data.push(aRow);
            styles.push(aStyles);
        }

        const result = await window.electronAPI.saveExcelFile({ data, styles });
        alert(result.message);
    } catch (error) {
        console.error('엑셀 내보내기 중 오류:', error);
        alert('엑셀 파일 저장 중 오류가 발생했습니다.');
    }
}
