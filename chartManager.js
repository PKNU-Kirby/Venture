/**
 * 차트 인스턴스
 * @type {Chart|null}
 */
let chart = null;

/**
 * 차트 스타일 설정
 */
const chartStyle = {
  backgroundColor: 'rgba(33, 150, 243, 0.5)',
  borderColor: 'rgba(33, 150, 243, 1)',
  borderWidth: 1,
  pointRadius: 5,
  pointHoverRadius: 7
};

/**
 * 축 설정 - 자동 스케일
 */
const axesConfig = {
  x: {
    type: 'linear',
    position: 'bottom',
    title: {
      display: true,
      text: 'X'
    }
  },
  y: {
    type: 'linear',
    title: {
      display: true,
      text: 'Y'
    }
  }
};

/**
 * 차트 기본 설정
 */
const chartConfig = {
  type: 'scatter',
  options: {
    responsive: false,
    maintainAspectRatio: false,
    scales: axesConfig,
    plugins: {
      title: {
        display: true,
        text: '데이터 차트'
      }
    }
  }
};

/**
 * 데이터셋 생성
 * @param {Array} dataPoints - 데이터 포인트 배열
 * @returns {Object} 차트 데이터셋
 */
function createDataset(dataPoints) {
  return {
    label: '데이터',
    data: dataPoints.map(point => ({
      x: point.x,
      y: point.y
    })),
    ...chartStyle
  };
}

/**
 * 차트 생성 또는 업데이트
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {Array} dataPoints - 데이터 포인트 배열
 */
export function updateChart(ctx, dataPoints) {
  if (!ctx || !Array.isArray(dataPoints)) {
    console.error('잘못된 차트 파라미터:', { ctx, dataPoints });
    return;
  }

  // ✅ 콘솔 로그 추가
  console.log('[차트 생성] 데이터 포인트:', dataPoints);

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    ...chartConfig,
    data: {
      datasets: [createDataset(dataPoints)]
    }
  });
}

/**
 * 차트 컨테이너 표시/숨김
 * @param {boolean} show - 표시 여부
 */
export function toggleChartContainer(show) {
  const container = document.getElementById('chartContainer');
  if (container) {
    container.style.display = show ? 'block' : 'none';
  }
}

/**
 * K와 N 값 표시 업데이트
 * @param {string} k - K 값
 * @param {string} n - N 값
 */
export function updateKNValues(k, n) {
  const kElement = document.getElementById('kValue');
  const nElement = document.getElementById('nValue');
  
  if (kElement && nElement) {
    kElement.textContent = k;
    nElement.textContent = n;
  }
}
