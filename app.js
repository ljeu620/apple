// 애플 주가 데이터 10가지 통계 분석 엔진 & Chart.js 시각화
let rawData = [];
let filteredData = [];
let charts = {};

// 통계 유틸리티 함수 모음
const Stats = {
  mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((acc, val) => acc + val, 0) / arr.length;
  },

  variance(arr, isSample = true) {
    if (arr.length <= 1) return 0;
    const avg = this.mean(arr);
    const sumSq = arr.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0);
    return sumSq / (arr.length - (isSample ? 1 : 0));
  },

  stdDev(arr, isSample = true) {
    return Math.sqrt(this.variance(arr, isSample));
  },

  skewness(arr) {
    const n = arr.length;
    if (n < 3) return 0;
    const avg = this.mean(arr);
    const s = this.stdDev(arr);
    if (s === 0) return 0;
    const m3 = arr.reduce((acc, val) => acc + Math.pow((val - avg) / s, 3), 0);
    return (n / ((n - 1) * (n - 2))) * m3;
  },

  kurtosis(arr) {
    const n = arr.length;
    if (n < 4) return 0;
    const avg = this.mean(arr);
    const s = this.stdDev(arr);
    if (s === 0) return 0;
    const m4 = arr.reduce((acc, val) => acc + Math.pow((val - avg) / s, 4), 0);
    const factor1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const factor2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    return factor1 * m4 - factor2; // Excess Kurtosis (정규분포=0)
  },

  quantile(sortedArr, q) {
    const pos = (sortedArr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedArr[base + 1] !== undefined) {
      return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
    } else {
      return sortedArr[base];
    }
  },

  linearRegression(xArr, yArr) {
    const n = xArr.length;
    if (n === 0) return { slope: 0, intercept: 0, r2: 0, r: 0 };
    const xMean = this.mean(xArr);
    const yMean = this.mean(yArr);

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = xArr[i] - xMean;
      const dy = yArr[i] - yMean;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const slope = denX === 0 ? 0 : num / denX;
    const intercept = yMean - slope * xMean;
    const r = (denX === 0 || denY === 0) ? 0 : num / Math.sqrt(denX * denY);
    const r2 = r * r;

    return { slope, intercept, r2, r };
  },

  calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        sma.push(this.mean(slice));
      }
    }
    return sma;
  },

  calculateEMA(data, period) {
    const ema = [];
    const k = 2 / (period + 1);
    let prevEma = null;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (prevEma === null) {
        if (i >= period - 1) {
          const slice = data.slice(0, period);
          prevEma = this.mean(slice);
          ema.push(prevEma);
        } else {
          ema.push(null);
        }
      } else {
        prevEma = val * k + prevEma * (1 - k);
        ema.push(prevEma);
      }
    }
    return ema;
  },

  calculateBollingerBands(data, period = 20, multiplier = 2) {
    const upper = [];
    const middle = [];
    const lower = [];

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        middle.push(null);
        lower.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const m = this.mean(slice);
        const sd = this.stdDev(slice, false);
        middle.push(m);
        upper.push(m + multiplier * sd);
        lower.push(m - multiplier * sd);
      }
    }
    return { upper, middle, lower };
  },

  calculateRSI(closes, period = 14) {
    const rsi = [];
    let gains = 0;
    let losses = 0;

    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        rsi.push(null);
        continue;
      }
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      if (i < period) {
        gains += gain;
        losses += loss;
        rsi.push(null);
      } else if (i === period) {
        gains += gain;
        losses += loss;
        let avgGain = gains / period;
        let avgLoss = losses / period;
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      } else {
        let prevRsi = rsi[i - 1];
        // Wilder's smoothing
        let lastAvgGain = (gains) / period;
        let lastAvgLoss = (losses) / period;
        let avgGain = (lastAvgGain * (period - 1) + gain) / period;
        let avgLoss = (lastAvgLoss * (period - 1) + loss) / period;
        gains = avgGain * period;
        losses = avgLoss * period;
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
    return rsi;
  },

  calculateMACD(closes) {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = [];

    for (let i = 0; i < closes.length; i++) {
      if (ema12[i] !== null && ema26[i] !== null) {
        macdLine.push(ema12[i] - ema26[i]);
      } else {
        macdLine.push(null);
      }
    }

    // Filter valid MACD values for signal line calculation
    const validMacdStart = macdLine.findIndex(v => v !== null);
    const validMacd = macdLine.slice(validMacdStart);
    const validSignal = this.calculateEMA(validMacd, 9);
    
    const signalLine = new Array(validMacdStart).fill(null).concat(validSignal);
    const histogram = [];

    for (let i = 0; i < closes.length; i++) {
      if (macdLine[i] !== null && signalLine[i] !== null) {
        histogram.push(macdLine[i] - signalLine[i]);
      } else {
        histogram.push(null);
      }
    }

    return { macdLine, signalLine, histogram };
  }
};

// CSV 파싱 및 전처리 함수
function processCSV(csvString) {
  Papa.parse(csvString, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function(results) {
      const data = results.data;
      // 데이터 검증 및 날짜 정렬
      const parsed = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row.Date && row.Close !== null && row.Close !== undefined) {
          parsed.push({
            date: String(row.Date).trim(),
            open: parseFloat(row.Open),
            high: parseFloat(row.High),
            low: parseFloat(row.Low),
            close: parseFloat(row.Close),
            adjClose: parseFloat(row['Adj Close'] || row.Close),
            volume: parseFloat(row.Volume || 0)
          });
        }
      }

      parsed.sort((a, b) => new Date(a.date) - new Date(b.date));

      // 일간 수익률 및 로그수익률 사전 계산
      for (let i = 0; i < parsed.length; i++) {
        if (i === 0) {
          parsed[i].dailyReturn = 0;
          parsed[i].logReturn = 0;
        } else {
          const ret = (parsed[i].close - parsed[i - 1].close) / parsed[i - 1].close;
          parsed[i].dailyReturn = ret;
          parsed[i].logReturn = Math.log(parsed[i].close / parsed[i - 1].close);
        }
      }

      rawData = parsed;
      applyFilter('all');
      document.getElementById('statusText').textContent = `데이터 로드 완료 (${rawData.length.toLocaleString()}건)`;
    },
    error: function(err) {
      alert("CSV 파싱 중 오류가 발생했습니다: " + err.message);
    }
  });
}

// 필터링 적용 (기간 선택)
function applyFilter(range) {
  if (!rawData.length) return;

  if (range === 'all') {
    filteredData = [...rawData];
  } else {
    const lastDate = new Date(rawData[rawData.length - 1].date);
    let cutoff = new Date(lastDate);
    if (range === '5y') cutoff.setFullYear(cutoff.getFullYear() - 5);
    else if (range === '2y') cutoff.setFullYear(cutoff.getFullYear() - 2);
    else if (range === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);

    filteredData = rawData.filter(d => new Date(d.date) >= cutoff);
  }

  updateDashboard();
}

// 대시보드 전체 갱신
function updateDashboard() {
  if (!filteredData.length) return;

  updateKPIs();
  renderAnalysis1_Trend();
  renderAnalysis2_Bollinger();
  renderAnalysis3_ReturnsDist();
  renderAnalysis4_Regression();
  renderAnalysis5_Volatility();
  renderAnalysis6_Drawdown();
  renderAnalysis7_MACD();
  renderAnalysis8_RSI();
  renderAnalysis9_DayOfWeek();
  renderAnalysis10_SummaryAndYearly();
}

// KPI 요약 카드 업데이트
function updateKPIs() {
  const n = filteredData.length;
  const first = filteredData[0];
  const last = filteredData[n - 1];

  document.getElementById('kpiPeriod').textContent = `${first.date} ~ ${last.date}`;
  document.getElementById('kpiDataCount').textContent = `총 ${n.toLocaleString()} 거래일 표본`;

  const totalReturn = ((last.close - first.close) / first.close) * 100;
  const returnClass = totalReturn >= 0 ? 'text-success' : 'text-danger';
  document.getElementById('kpiClose').textContent = `$${last.close.toFixed(2)}`;
  document.getElementById('kpiReturn').innerHTML = `<span class="${returnClass}">${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}% 누적 수익률</span>`;

  // 연환산 변동성 (표준편차 * sqrt(252))
  const returns = filteredData.slice(1).map(d => d.dailyReturn);
  const dailyStd = Stats.stdDev(returns);
  const annualVol = dailyStd * Math.sqrt(252) * 100;
  document.getElementById('kpiVol').textContent = `${annualVol.toFixed(1)}%`;

  // 샤프 지수 (무위험수익률 연 2% 가정)
  const meanDailyRet = Stats.mean(returns);
  const annualRet = meanDailyRet * 252;
  const rf = 0.02;
  const sharpe = (annualRet - rf) / (dailyStd * Math.sqrt(252));
  document.getElementById('kpiSharpe').textContent = `연환산 샤프 지수: ${sharpe.toFixed(2)}`;

  // MDD & VaR
  let peak = -Infinity;
  let maxDd = 0;
  for (let i = 0; i < n; i++) {
    if (filteredData[i].close > peak) peak = filteredData[i].close;
    const dd = (filteredData[i].close - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  document.getElementById('kpiMdd').textContent = `${(maxDd * 100).toFixed(2)}%`;

  const sortedRet = [...returns].sort((a, b) => a - b);
  const var95 = Stats.quantile(sortedRet, 0.05);
  document.getElementById('kpiVar').textContent = `95% 일간 VaR: ${(var95 * 100).toFixed(2)}%`;
}

// 차트 헬퍼 함수
function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
  }
}

// 1. 추세 및 이동평균선 분석
function renderAnalysis1_Trend() {
  destroyChart('trend');
  const labels = filteredData.map(d => d.date);
  const closes = filteredData.map(d => d.close);
  const sma20 = Stats.calculateSMA(closes, 20);
  const sma60 = Stats.calculateSMA(closes, 60);
  const sma120 = Stats.calculateSMA(closes, 120);

  const ctx = document.getElementById('chartTrend').getContext('2d');
  charts['trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '종가 (Close Price)', data: closes, borderColor: '#38bdf8', borderWidth: 2, pointRadius: 0 },
        { label: 'SMA 20일 (단기)', data: sma20, borderColor: '#fbbf24', borderWidth: 1.5, pointRadius: 0 },
        { label: 'SMA 60일 (중기)', data: sma60, borderColor: '#34d399', borderWidth: 1.5, pointRadius: 0 },
        { label: 'SMA 120일 (장기)', data: sma120, borderColor: '#f43f5e', borderWidth: 1.5, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8' } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: $${Number(ctx.raw).toFixed(2)}` } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', maxTicksLimit: 12 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: v => '$' + v } }
      }
    }
  });
}

// 2. 볼린저 밴드 (확률 변동성 구간)
function renderAnalysis2_Bollinger() {
  destroyChart('bollinger');
  const labels = filteredData.map(d => d.date);
  const closes = filteredData.map(d => d.close);
  const bb = Stats.calculateBollingerBands(closes, 20, 2);

  const ctx = document.getElementById('chartBollinger').getContext('2d');
  charts['bollinger'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '종가', data: closes, borderColor: '#ffffff', borderWidth: 1.5, pointRadius: 0 },
        { label: '상단 밴드 (+2σ)', data: bb.upper, borderColor: 'rgba(239, 68, 68, 0.7)', borderWidth: 1, pointRadius: 0, borderDash: [4, 4] },
        { label: '중심선 (SMA 20)', data: bb.middle, borderColor: '#38bdf8', borderWidth: 1, pointRadius: 0 },
        { label: '하단 밴드 (-2σ)', data: bb.lower, borderColor: 'rgba(34, 197, 94, 0.7)', borderWidth: 1, pointRadius: 0, borderDash: [4, 4], fill: '-2', backgroundColor: 'rgba(56, 189, 248, 0.05)' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// 3. 일간 수익률 히스토그램 & 분포
function renderAnalysis3_ReturnsDist() {
  destroyChart('returnsDist');
  const returns = filteredData.slice(1).map(d => d.dailyReturn * 100); // % 단위
  const skew = Stats.skewness(returns);
  const kurt = Stats.kurtosis(returns);
  const mean = Stats.mean(returns);
  const std = Stats.stdDev(returns);

  document.getElementById('descReturns').innerHTML = 
    `평균: <b>${mean.toFixed(2)}%</b>, 표준편차: <b>${std.toFixed(2)}%</b> | 왜도(Skewness): <b>${skew.toFixed(2)}</b> (${skew < 0 ? '좌측 꼬리형' : '우측 꼬리형'}), 첨도(Kurtosis): <b>${kurt.toFixed(2)}</b> (${kurt > 0 ? '급첨/Fat-tail 리스크' : '완첨'})`;

  // 히스토그램 빈(Bin) 생성 (-10% ~ +10%, 0.5% 간격 = 40구간)
  const binWidth = 0.5;
  const minBin = -8.0;
  const maxBin = 8.0;
  const binCount = Math.round((maxBin - minBin) / binWidth);
  const bins = new Array(binCount).fill(0);
  const binLabels = [];

  for (let i = 0; i < binCount; i++) {
    const val = minBin + i * binWidth;
    binLabels.push(val.toFixed(1) + '%');
  }

  returns.forEach(r => {
    if (r >= minBin && r < maxBin) {
      const idx = Math.floor((r - minBin) / binWidth);
      if (idx >= 0 && idx < binCount) bins[idx]++;
    }
  });

  const ctx = document.getElementById('chartReturnsDist').getContext('2d');
  charts['returnsDist'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: binLabels,
      datasets: [{
        label: '발생 빈도수 (거래일 수)',
        data: bins,
        backgroundColor: binLabels.map(l => parseFloat(l) < 0 ? 'rgba(244, 63, 94, 0.65)' : 'rgba(16, 185, 129, 0.65)'),
        borderColor: binLabels.map(l => parseFloat(l) < 0 ? '#f43f5e' : '#10b981'),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// 4. 거래량 대비 주가 선형 회귀 분석
function renderAnalysis4_Regression() {
  destroyChart('regression');
  // 샘플링: 시각화 퍼포먼스를 위해 일정 비율 샘플링 (최대 500개 점)
  const step = Math.max(1, Math.floor(filteredData.length / 500));
  const sample = filteredData.filter((_, idx) => idx % step === 0);

  const xArr = sample.map(d => d.volume / 1e6); // 백만 주
  const yArr = sample.map(d => d.close);

  const reg = Stats.linearRegression(xArr, yArr);

  document.getElementById('descRegression').innerHTML = 
    `OLS 모델: <code>주가 = ${reg.slope.toFixed(4)} × 거래량(M) + ${reg.intercept.toFixed(2)}</code> | 상관계수(r): <b>${reg.r.toFixed(3)}</b>, 결정계수($R^2$): <b>${(reg.r2 * 100).toFixed(2)}%</b>`;

  const scatterPoints = sample.map(d => ({ x: d.volume / 1e6, y: d.close }));

  // 회귀선 양 끝 점 계산
  const minX = Math.min(...xArr);
  const maxX = Math.max(...xArr);
  const regressionLine = [
    { x: minX, y: reg.slope * minX + reg.intercept },
    { x: maxX, y: reg.slope * maxX + reg.intercept }
  ];

  const ctx = document.getElementById('chartRegression').getContext('2d');
  charts['regression'] = new Chart(ctx, {
    data: {
      datasets: [
        {
          type: 'scatter',
          label: '거래량 vs 주가',
          data: scatterPoints,
          backgroundColor: 'rgba(14, 165, 233, 0.45)',
          pointRadius: 2.5
        },
        {
          type: 'line',
          label: `회귀 추세선 (R²=${(reg.r2).toFixed(3)})`,
          data: regressionLine,
          borderColor: '#f59e0b',
          borderWidth: 2.5,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: {
          title: { display: true, text: '거래량 (백만 주, Millions)', color: '#94a3b8' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          title: { display: true, text: '주가 ($)', color: '#94a3b8' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

// 5. 30일 롤링 변동성 시계열
function renderAnalysis5_Volatility() {
  destroyChart('volatility');
  const windowSize = 30;
  const labels = [];
  const rollingVols = [];

  for (let i = 0; i < filteredData.length; i++) {
    labels.push(filteredData[i].date);
    if (i < windowSize) {
      rollingVols.push(null);
    } else {
      const windowReturns = filteredData.slice(i - windowSize + 1, i + 1).map(d => d.dailyReturn);
      const std = Stats.stdDev(windowReturns);
      const annualized = std * Math.sqrt(252) * 100;
      rollingVols.push(annualized);
    }
  }

  const ctx = document.getElementById('chartVolatility').getContext('2d');
  charts['volatility'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '30일 롤링 연환산 변동성 (%)',
        data: rollingVols,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderWidth: 1.8,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', callback: v => v + '%' }
        }
      }
    }
  });
}

// 6. Drawdown 언더워터 차트
function renderAnalysis6_Drawdown() {
  destroyChart('drawdown');
  const labels = filteredData.map(d => d.date);
  const drawdowns = [];
  let peak = -Infinity;

  for (let i = 0; i < filteredData.length; i++) {
    const p = filteredData[i].close;
    if (p > peak) peak = p;
    const dd = ((p - peak) / peak) * 100;
    drawdowns.push(dd);
  }

  const ctx = document.getElementById('chartDrawdown').getContext('2d');
  charts['drawdown'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '고점 대비 낙폭 (%)',
        data: drawdowns,
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.2)',
        fill: 'start',
        borderWidth: 1.5,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', callback: v => v + '%' }
        }
      }
    }
  });
}

// 7. MACD 분석
function renderAnalysis7_MACD() {
  destroyChart('macd');
  const labels = filteredData.map(d => d.date);
  const closes = filteredData.map(d => d.close);
  const macdData = Stats.calculateMACD(closes);

  const ctx = document.getElementById('chartMacd').getContext('2d');
  charts['macd'] = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'MACD 오실레이터 히스토그램',
          data: macdData.histogram,
          backgroundColor: macdData.histogram.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
          order: 2
        },
        {
          type: 'line',
          label: 'MACD선 (12-26 EMA)',
          data: macdData.macdLine,
          borderColor: '#38bdf8',
          borderWidth: 1.5,
          pointRadius: 0,
          order: 1
        },
        {
          type: 'line',
          label: '시그널선 (9 EMA)',
          data: macdData.signalLine,
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          pointRadius: 0,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// 8. RSI 분석
function renderAnalysis8_RSI() {
  destroyChart('rsi');
  const labels = filteredData.map(d => d.date);
  const closes = filteredData.map(d => d.close);
  const rsiValues = Stats.calculateRSI(closes, 14);

  const ctx = document.getElementById('chartRsi').getContext('2d');
  charts['rsi'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'RSI (14일)',
          data: rsiValues,
          borderColor: '#c084fc',
          borderWidth: 1.8,
          pointRadius: 0
        },
        {
          label: '과매수 기준선 (70)',
          data: new Array(labels.length).fill(70),
          borderColor: 'rgba(239, 68, 68, 0.6)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0
        },
        {
          label: '과매도 기준선 (30)',
          data: new Array(labels.length).fill(30),
          borderColor: 'rgba(34, 197, 94, 0.6)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
        y: {
          min: 10,
          max: 90,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

// 9. 요일별 계절성 통계 (Day-of-Week Effect)
function renderAnalysis9_DayOfWeek() {
  destroyChart('dayOfWeek');
  const dayNames = ['월요일', '화요일', '수요일', '목요일', '금요일'];
  const dayReturns = [[], [], [], [], []];

  for (let i = 1; i < filteredData.length; i++) {
    const d = new Date(filteredData[i].date);
    const day = d.getDay(); // 0=일, 1=월, ..., 5=금
    if (day >= 1 && day <= 5) {
      dayReturns[day - 1].push(filteredData[i].dailyReturn * 100);
    }
  }

  const avgReturns = dayReturns.map(r => Stats.mean(r));
  const stdReturns = dayReturns.map(r => Stats.stdDev(r));

  const ctx = document.getElementById('chartDayOfWeek').getContext('2d');
  charts['dayOfWeek'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayNames,
      datasets: [
        {
          label: '평균 일간 수익률 (%)',
          data: avgReturns,
          backgroundColor: avgReturns.map(v => v >= 0 ? '#10b981' : '#f43f5e'),
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: '요일별 표준편차/변동성 (%)',
          data: stdReturns,
          borderColor: '#fbbf24',
          backgroundColor: '#fbbf24',
          pointRadius: 5,
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#cbd5e1' } },
        y: {
          title: { display: true, text: '평균 수익률 (%)', color: '#94a3b8' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y1: {
          position: 'right',
          title: { display: true, text: '표준편차 (%)', color: '#fbbf24' },
          grid: { display: false },
          ticks: { color: '#fbbf24' }
        }
      }
    }
  });
}

// 10. 기술통계표 및 연도별 집계
function renderAnalysis10_SummaryAndYearly() {
  destroyChart('yearlyStats');
  const closes = filteredData.map(d => d.close);
  const returns = filteredData.slice(1).map(d => d.dailyReturn * 100);
  const volumes = filteredData.map(d => d.volume);

  const sortedCloses = [...closes].sort((a, b) => a - b);
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const sortedVolumes = [...volumes].sort((a, b) => a - b);

  // 통계량 계산
  const metrics = [
    { name: '평균 (Mean)', c: Stats.mean(closes).toFixed(2), r: Stats.mean(returns).toFixed(2) + '%', v: Stats.mean(volumes).toLocaleString(undefined, {maximumFractionDigits: 0}) },
    { name: '표준편차 (Std Dev)', c: Stats.stdDev(closes).toFixed(2), r: Stats.stdDev(returns).toFixed(2) + '%', v: Stats.stdDev(volumes).toLocaleString(undefined, {maximumFractionDigits: 0}) },
    { name: '중앙값 (Median / Q2)', c: Stats.quantile(sortedCloses, 0.5).toFixed(2), r: Stats.quantile(sortedReturns, 0.5).toFixed(2) + '%', v: Stats.quantile(sortedVolumes, 0.5).toLocaleString(undefined, {maximumFractionDigits: 0}) },
    { name: '제1사분위수 (Q1, 25%)', c: Stats.quantile(sortedCloses, 0.25).toFixed(2), r: Stats.quantile(sortedReturns, 0.25).toFixed(2) + '%', v: Stats.quantile(sortedVolumes, 0.25).toLocaleString(undefined, {maximumFractionDigits: 0}) },
    { name: '제3사분위수 (Q3, 75%)', c: Stats.quantile(sortedCloses, 0.75).toFixed(2), r: Stats.quantile(sortedReturns, 0.75).toFixed(2) + '%', v: Stats.quantile(sortedVolumes, 0.75).toLocaleString(undefined, {maximumFractionDigits: 0}) },
    { name: '사분위범위 (IQR)', c: (Stats.quantile(sortedCloses, 0.75) - Stats.quantile(sortedCloses, 0.25)).toFixed(2), r: (Stats.quantile(sortedReturns, 0.75) - Stats.quantile(sortedReturns, 0.25)).toFixed(2) + '%', v: '-' },
    { name: '최솟값 (Min)', c: sortedCloses[0].toFixed(2), r: sortedReturns[0].toFixed(2) + '%', v: sortedVolumes[0].toLocaleString() },
    { name: '최댓값 (Max)', c: sortedCloses[sortedCloses.length - 1].toFixed(2), r: sortedReturns[sortedReturns.length - 1].toFixed(2) + '%', v: sortedVolumes[sortedVolumes.length - 1].toLocaleString() },
    { name: '왜도 (Skewness)', c: Stats.skewness(closes).toFixed(2), r: Stats.skewness(returns).toFixed(2), v: Stats.skewness(volumes).toFixed(2) },
    { name: '첨도 (Kurtosis)', c: Stats.kurtosis(closes).toFixed(2), r: Stats.kurtosis(returns).toFixed(2), v: Stats.kurtosis(volumes).toFixed(2) },
    { name: '95% VaR (Value at Risk)', c: '-', r: Stats.quantile(sortedReturns, 0.05).toFixed(2) + '%', v: '-' }
  ];

  const tbody = document.querySelector('#statsSummaryTable tbody');
  tbody.innerHTML = '';
  metrics.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.name}</td><td>${m.c}</td><td>${m.r}</td><td>${m.v}</td>`;
    tbody.appendChild(tr);
  });

  // 연도별 평균 주가 및 최고/최저가
  const yearlyMap = {};
  filteredData.forEach(d => {
    const yr = d.date.split('-')[0];
    if (!yearlyMap[yr]) {
      yearlyMap[yr] = { closes: [] };
    }
    yearlyMap[yr].closes.push(d.close);
  });

  const years = Object.keys(yearlyMap).sort();
  const yearlyAvg = years.map(yr => Stats.mean(yearlyMap[yr].closes));
  const yearlyMin = years.map(yr => Math.min(...yearlyMap[yr].closes));
  const yearlyMax = years.map(yr => Math.max(...yearlyMap[yr].closes));

  const ctx = document.getElementById('chartYearlyStats').getContext('2d');
  charts['yearlyStats'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { label: '연간 최고가', data: yearlyMax, backgroundColor: 'rgba(239, 68, 68, 0.5)' },
        { label: '연간 평균가', data: yearlyAvg, backgroundColor: '#38bdf8' },
        { label: '연간 최저가', data: yearlyMin, backgroundColor: 'rgba(34, 197, 94, 0.5)' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#cbd5e1' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// 초기 로딩: 로컬 CSV 파일 자동 로드 또는 기본 데이터 fetch
window.addEventListener('DOMContentLoaded', () => {
  // 이벤트 리스너 설정
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      applyFilter(e.target.dataset.range);
    });
  });

  document.getElementById('resetRangeBtn').addEventListener('click', () => {
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.pill-btn[data-range="all"]').classList.add('active');
    applyFilter('all');
  });

  // 파일 업로드 이벤트
  document.getElementById('csvFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        processCSV(evt.target.result);
      };
      reader.readAsText(file);
    }
  });

  // 1순위: 내장된 Base64 데이터로 브라우저 보안 제약 없이 즉시 로드 (더블클릭 실행 지원)
  if (typeof EMBEDDED_CSV_B64 !== 'undefined' && EMBEDDED_CSV_B64) {
    try {
      const decoded = decodeURIComponent(escape(atob(EMBEDDED_CSV_B64)));
      processCSV(decoded);
      return;
    } catch (e) {
      console.warn("Base64 디코딩 실패, 일반 fetch 시도:", e);
    }
  }

  // 2순위: 웹서버 환경일 경우 fetch 시도
  fetch('애플 주가.csv')
    .then(res => {
      if (!res.ok) throw new Error('파일 fetch 불가');
      return res.text();
    })
    .then(text => processCSV(text))
    .catch(err => {
      console.warn('fetch 실패:', err);
      document.getElementById('statusText').innerHTML = `💡 우측 상단 <b>[새 CSV/엑셀 불러오기]</b> 버튼으로 '애플 주가.csv'를 선택해 주세요.`;
    });
});
