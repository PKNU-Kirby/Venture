let selectedFilePath = null;

// 페이지 로드 시 기본값 설정
document.addEventListener('DOMContentLoaded', () => {
  const startRowInput = document.getElementById('startRow');
  const endRowInput = document.getElementById('endRow');

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
});

// 범위 문자열을 시작과 끝 셀로 분리
function parseRange(range) {
  const [start, end] = range.split(':');
  return { start, end };
}

// SLOPE 계산 함수 (이미 로그 변환된 데이터용)
function calculateSlope(xValues, yValues) {
  const n = xValues.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    const x = parseFloat(xValues[i]);
    const y = parseFloat(yValues[i]);
    
    if (isNaN(x) || isNaN(y)) {
      console.error('잘못된 데이터:', xValues[i], yValues[i]);
      continue;
    }

    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  
  if (n === 0) return NaN;
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

// INTERCEPT 계산 함수 (이미 로그 변환된 데이터용)
function calculateIntercept(xValues, yValues) {
  const n = xValues.length;
  let sumX = 0, sumY = 0;
  let validPoints = 0;
  
  for (let i = 0; i < n; i++) {
    const x = parseFloat(xValues[i]);
    const y = parseFloat(yValues[i]);
    
    if (isNaN(x) || isNaN(y)) {
      continue;
    }

    sumX += x;
    sumY += y;
    validPoints++;
  }
  
  if (validPoints === 0) return NaN;
  
  const xMean = sumX / validPoints;
  const yMean = sumY / validPoints;
  const slope = calculateSlope(xValues, yValues);
  
  return yMean - slope * xMean;
}

// 엑셀 파일 선택
document.getElementById('loadExcel').addEventListener('click', async () => {
  const filePath = await window.electronAPI.selectExcelFile();
  if (filePath) {
    selectedFilePath = filePath;
    alert('엑셀 파일이 로드되었습니다. 범위를 지정하고 차트를 생성해주세요.');
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
    const result = await window.electronAPI.extractChartData(selectedFilePath, {
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

    // 데이터 포인트 생성 및 필터링
    const dataPoints = [];
    for (let i = 0; i < chartData.labels.length; i++) {
      const x = parseFloat(chartData.labels[i]);
      const y = parseFloat(chartData.values[i]);
      
      if (!isNaN(x) && !isNaN(y)) {
        dataPoints.push({ x: Math.pow(10, x), y });
      }
    }

    console.log('변환된 데이터 포인트:', dataPoints);

    // K와 N 값 계산 (이미 로그 변환된 데이터 사용)
    const n = calculateSlope(chartData.labels, chartData.values);
    const k = Math.pow(10, calculateIntercept(chartData.labels, chartData.values));

    // K와 N 값 표시 (소수점 자릿수 변경)
    document.getElementById('kValue').textContent = isNaN(k) ? 'NaN' : k.toFixed(7);
    document.getElementById('nValue').textContent = isNaN(n) ? 'NaN' : n.toFixed(8);

    // 차트 컨테이너 표시
    document.getElementById('chartContainer').style.display = 'block';

    // 차트 생성
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (window.myChart) {
      window.myChart.destroy();
    }

    window.myChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: '데이터',
          data: dataPoints.map(point => ({
            x: point.x,
            y: point.y
          })),
          backgroundColor: 'rgba(33, 150, 243, 0.5)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            min: 0,
            max: 1,
            ticks: {
              stepSize: 0.2
            },
            title: {
              display: true,
              text: 'X'
            }
          },
          y: {
            type: 'linear',
            min: 2.58,
            max: 2.72,
            ticks: {
              stepSize: 0.02
            },
            title: {
              display: true,
              text: 'Y'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: '데이터 차트'
          }
        }
      }
    });
  } catch (error) {
    console.error('차트 생성 중 오류:', error);
    alert('차트 생성 중 오류가 발생했습니다.');
  }
});
  