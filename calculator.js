/**
 * 데이터 유효성 검사
 * @param {number} value - 검사할 값
 * @returns {boolean} 유효성 여부
 */
function isValidNumber(value) {
  const num = parseFloat(value);
  return !isNaN(num);
}

/**
 * 로그 변환된 데이터에서 기울기(N) 계산
 * @param {Array} xValues - X축 값 배열
 * @param {Array} yValues - Y축 값 배열
 * @returns {number} 기울기 값
 */
function calculateSlope(xValues, yValues) {
  const n = xValues.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  let validPoints = 0;
  
  for (let i = 0; i < n; i++) {
    const x = parseFloat(xValues[i]);
    const y = parseFloat(yValues[i]);
    
    if (!isValidNumber(x) || !isValidNumber(y)) {
      console.error('잘못된 데이터 포인트:', { x: xValues[i], y: yValues[i] });
      continue;
    }

    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    validPoints++;
  }
  
  if (validPoints === 0) return NaN;
  return (validPoints * sumXY - sumX * sumY) / (validPoints * sumXX - sumX * sumX);
}

/**
 * 로그 변환된 데이터에서 절편 계산
 * @param {Array} xValues - X축 값 배열
 * @param {Array} yValues - Y축 값 배열
 * @returns {number} 절편 값
 */
function calculateIntercept(xValues, yValues) {
  const n = xValues.length;
  let sumX = 0, sumY = 0;
  let validPoints = 0;
  
  for (let i = 0; i < n; i++) {
    const x = parseFloat(xValues[i]);
    const y = parseFloat(yValues[i]);
    
    if (!isValidNumber(x) || !isValidNumber(y)) {
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

/**
 * 데이터 포인트 생성 및 변환
 * @param {Array} labels - X축 라벨 배열
 * @param {Array} values - Y축 값 배열
 * @returns {Array} 변환된 데이터 포인트 배열
 */
export function createDataPoints(labels, values) {
  if (!Array.isArray(labels) || !Array.isArray(values)) {
    console.error('잘못된 입력:', { labels, values });
    return [];
  }

  if (labels.length !== values.length) {
    console.error('X축과 Y축 데이터 길이가 일치하지 않습니다.');
    return [];
  }

  const dataPoints = [];
  for (let i = 0; i < labels.length; i++) {
    const x = parseFloat(labels[i]);
    const y = parseFloat(values[i]);
    
    if (isValidNumber(x) && isValidNumber(y)) {
      dataPoints.push({ x: Math.pow(10, x), y });
    }
  }
  return dataPoints;
}

/**
 * K와 N 값 계산
 * @param {Array} labels - X축 라벨 배열
 * @param {Array} values - Y축 값 배열
 * @returns {Object} K와 N 값
 */
export function calculateKAndN(labels, values) {
  if (!Array.isArray(labels) || !Array.isArray(values)) {
    return { k: 'NaN', n: 'NaN' };
  }

  const n = calculateSlope(labels, values);
  const k = Math.pow(10, calculateIntercept(labels, values));
  
  return {
    k: isValidNumber(k) ? k.toFixed(7) : 'NaN',
    n: isValidNumber(n) ? n.toFixed(8) : 'NaN'
  };
}