#!/usr/bin/env node
/**
 * Dynamic GitHub Contributions Line Graph Generator (Adaptive Scale · Dark & Light Option A)
 * Zero external dependencies — Node.js 20+ native fetch + fs/promises.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const USERNAME = process.env.GITHUB_USERNAME || 'Anderson-Oloroso';
const TOKEN = process.env.GITHUB_TOKEN;
const OUTPUT_DIR = resolve(process.cwd(), process.env.GRAPH_OUTPUT_DIR || 'assets');

const BASE_TICKS = [0, 5, 10, 25, 50, 100, 150, 200, 400];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const THEMES = {
  dark: {
    bgStops: ['#0F172A', '#0D1526', '#0B1222'],
    cardBorder: 'rgba(8, 145, 178, 0.38)',
    hairlineStops: ['#0891B2', '#22C55E', '#38BDF8'],
    titleFill: '#F8FAFC',
    subtitleFill: '#94A3B8',
    kpiBg: '#111C33',
    kpiLabel: '#94A3B8',
    kpi1Border: 'rgba(34, 197, 94, 0.34)',
    kpi1Value: '#22C55E',
    kpi2Border: 'rgba(8, 145, 178, 0.42)',
    kpi2Value: '#38BDF8',
    kpi3Border: 'rgba(148, 163, 184, 0.25)',
    kpi3Value: '#F8FAFC',
    gridBaseline: 'rgba(8, 145, 178, 0.42)',
    gridLine: 'rgba(148, 163, 184, 0.14)',
    yTickHighlight: '#38BDF8',
    yTickNormal: '#94A3B8',
    xTickLine: 'rgba(8, 145, 178, 0.36)',
    xLabelLast: '#F8FAFC',
    xLabelNormal: '#94A3B8',
    lineStops: ['#0891B2', '#22C55E', '#38BDF8'],
    lineGlow: '#0891B2',
    lineGlowOpacity: '0.24',
    areaStops: [
      { color: '#22C55E', op: '0.26' },
      { color: '#0891B2', op: '0.10' },
      { color: '#0F172A', op: '0.01' }
    ],
    pointActiveFill: '#FFFFFF',
    pointActiveStroke: '#22C55E',
    pointInactiveFill: '#1E293B',
    pointInactiveStroke: '#475569',
    pointPeakFill: '#FFFFFF',
    pointPeakStroke: '#38BDF8',
    peakHaloFill: 'rgba(8, 145, 178, 0.20)',
    peakHaloStroke: 'rgba(56, 189, 248, 0.48)',
    badgeBg: '#0F172A',
    badgePeakStroke: '#38BDF8',
    badgePeakText: '#38BDF8',
    badgeSpikeStroke: 'rgba(34, 197, 94, 0.48)',
    badgeSpikeText: '#22C55E'
  },
  light: {
    bgStops: ['#FFFFFF', '#F8FAFC', '#F1F5F9'],
    cardBorder: '#CBD5E1',
    hairlineStops: ['#0891B2', '#16A34A', '#0284C7'],
    titleFill: '#0F172A',
    subtitleFill: '#475569',
    kpiBg: '#F1F5F9',
    kpiLabel: '#475569',
    kpi1Border: 'rgba(22, 163, 74, 0.35)',
    kpi1Value: '#16A34A',
    kpi2Border: 'rgba(8, 145, 178, 0.35)',
    kpi2Value: '#0E7490',
    kpi3Border: '#CBD5E1',
    kpi3Value: '#0F172A',
    gridBaseline: 'rgba(8, 145, 178, 0.45)',
    gridLine: 'rgba(148, 163, 184, 0.25)',
    yTickHighlight: '#0E7490',
    yTickNormal: '#475569',
    xTickLine: 'rgba(8, 145, 178, 0.40)',
    xLabelLast: '#0F172A',
    xLabelNormal: '#475569',
    lineStops: ['#0E7490', '#16A34A', '#0284C7'],
    lineGlow: '#0891B2',
    lineGlowOpacity: '0.16',
    areaStops: [
      { color: '#22C55E', op: '0.20' },
      { color: '#0891B2', op: '0.07' },
      { color: '#FFFFFF', op: '0.01' }
    ],
    pointActiveFill: '#FFFFFF',
    pointActiveStroke: '#16A34A',
    pointInactiveFill: '#E2E8F0',
    pointInactiveStroke: '#94A3B8',
    pointPeakFill: '#FFFFFF',
    pointPeakStroke: '#0284C7',
    peakHaloFill: 'rgba(8, 145, 178, 0.16)',
    peakHaloStroke: 'rgba(2, 132, 199, 0.48)',
    badgeBg: '#FFFFFF',
    badgePeakStroke: '#0E7490',
    badgePeakText: '#0E7490',
    badgeSpikeStroke: 'rgba(22, 163, 74, 0.45)',
    badgeSpikeText: '#15803D'
  }
};

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatDateShortEs(isoDate) {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const monthIdx = Number.parseInt(parts[1], 10) - 1;
  const day = Number.parseInt(parts[2], 10);
  return `${day} ${MONTHS_ES[monthIdx] || parts[1]}`;
}

function buildScaleTicks(maxCount) {
  const safeMax = Math.max(0, maxCount);
  if (safeMax <= 25) {
    return [0, 5, 10, 25];
  }

  const ticks = [];
  for (const tick of BASE_TICKS) {
    ticks.push(tick);
    if (tick >= safeMax) {
      return ticks;
    }
  }

  let extra = 600;
  while (extra < safeMax) {
    ticks.push(extra);
    extra += 200;
  }
  ticks.push(extra);
  return ticks;
}

function valueToY(value, ticks, topY, bottomY) {
  const spanY = bottomY - topY;
  const intervals = Math.max(1, ticks.length - 1);
  const clamped = Math.max(ticks[0], Math.min(value, ticks[ticks.length - 1]));

  for (let i = 0; i < intervals; i += 1) {
    const low = ticks[i];
    const high = ticks[i + 1];
    if (clamped <= high || i === intervals - 1) {
      const ratioInBand = high > low ? (clamped - low) / (high - low) : 0;
      const normY = (i + ratioInBand) / intervals;
      return bottomY - normY * spanY;
    }
  }
  return bottomY;
}

function buildSmoothPaths(points, bottomY) {
  const n = points.length;
  if (n === 0) return { linePath: '', areaPath: '' };
  if (n === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
      areaPath: `M ${p.x.toFixed(2)} ${bottomY.toFixed(2)} L ${p.x.toFixed(2)} ${p.y.toFixed(2)} L ${p.x.toFixed(2)} ${bottomY.toFixed(2)} Z`
    };
  }
  if (n === 2) {
    const [p0, p1] = points;
    return {
      linePath: `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      areaPath: `M ${p0.x.toFixed(2)} ${bottomY.toFixed(2)} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p1.x.toFixed(2)} ${bottomY.toFixed(2)} Z`
    };
  }

  const dxs = new Array(n - 1);
  const deltas = new Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs[i] = dx || 1;
    deltas[i] = dy / dxs[i];
  }

  const slopes = new Array(n).fill(0);
  slopes[0] = deltas[0];
  slopes[n - 1] = deltas[n - 2];

  for (let i = 1; i < n - 1; i += 1) {
    const m0 = deltas[i - 1];
    const m1 = deltas[i];
    if (m0 * m1 <= 0) {
      slopes[i] = 0;
    } else {
      const dx0 = dxs[i - 1];
      const dx1 = dxs[i];
      const common = dx0 + dx1;
      slopes[i] = (3 * common) / ((common + dx1) / m0 + (common + dx0) / m1);
    }
  }

  for (let i = 0; i < n - 1; i += 1) {
    const delta = deltas[i];
    if (delta === 0) {
      slopes[i] = 0;
      slopes[i + 1] = 0;
    } else {
      const a = slopes[i] / delta;
      const b = slopes[i + 1] / delta;
      const sq = a * a + b * b;
      if (sq > 9) {
        const tau = 3 / Math.sqrt(sq);
        slopes[i] = tau * a * delta;
        slopes[i + 1] = tau * b * delta;
      }
    }
  }

  const segments = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const h = dxs[i] / 3;
    const cx1 = p0.x + h;
    const cy1 = p0.y + slopes[i] * h;
    const cx2 = p1.x - h;
    const cy2 = p1.y - slopes[i + 1] * h;
    segments.push(
      `C ${cx1.toFixed(2)} ${cy1.toFixed(2)}, ${cx2.toFixed(2)} ${cy2.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
    );
  }

  const linePath = segments.join(' ');
  const first = points[0];
  const last = points[n - 1];
  const areaPath = `M ${first.x.toFixed(2)} ${bottomY.toFixed(2)} L ${linePath.slice(2)} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
  return { linePath, areaPath };
}

async function fetchContributions(username, token) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `${username}-Activity-Graph`
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { login: username }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub GraphQL HTTP ${response.status}: ${errText}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${JSON.stringify(payload.errors)}`);
  }

  const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error(`Missing contributionCalendar for user ${username}`);
  }

  const allDays = calendar.weeks.flatMap((week) => week.contributionDays);
  return {
    totalYear: calendar.totalContributions,
    last31: allDays.slice(-31)
  };
}

function buildSvg({ username, totalYear, last31 }, themeName = 'dark') {
  const t = THEMES[themeName] || THEMES.dark;
  const width = 1100;
  const height = 400;
  const pad = { top: 112, right: 40, bottom: 52, left: 66 };
  const plotLeft = pad.left;
  const plotRight = width - pad.right;
  const plotTop = pad.top;
  const plotBottom = height - pad.bottom;
  const plotWidth = plotRight - plotLeft;

  const total31 = last31.reduce((sum, day) => sum + day.contributionCount, 0);
  const activeDays = last31.filter((day) => day.contributionCount > 0).length;
  let maxDay = last31[0] || { date: '', contributionCount: 0 };
  for (const day of last31) {
    if (day.contributionCount >= maxDay.contributionCount) {
      maxDay = day;
    }
  }

  const ticks = buildScaleTicks(maxDay.contributionCount);
  const scaleLabel = ticks.slice(1).join(' · ');

  const points = last31.map((day, idx) => {
    const ratioX = last31.length > 1 ? idx / (last31.length - 1) : 0.5;
    const x = plotLeft + ratioX * plotWidth;
    const y = valueToY(day.contributionCount, ticks, plotTop, plotBottom);
    return {
      idx,
      x,
      y,
      date: day.date,
      count: day.contributionCount,
      shortDate: formatDateShortEs(day.date)
    };
  });

  const { linePath, areaPath } = buildSmoothPaths(points, plotBottom);

  const yGridMarkup = ticks
    .map((tick) => {
      const y = valueToY(tick, ticks, plotTop, plotBottom);
      const isBaseline = tick === 0;
      return `
        <line
          x1="${plotLeft}"
          y1="${y.toFixed(2)}"
          x2="${plotRight}"
          y2="${y.toFixed(2)}"
          stroke="${isBaseline ? t.gridBaseline : t.gridLine}"
          stroke-width="${isBaseline ? '1.3' : '1'}"
          ${isBaseline ? '' : 'stroke-dasharray="4 5"'}
        />
        <text
          x="${plotLeft - 12}"
          y="${(y + 4).toFixed(2)}"
          text-anchor="end"
          fill="${tick >= 100 ? t.yTickHighlight : t.yTickNormal}"
          font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace"
          font-size="11.5"
          font-weight="${tick === ticks[ticks.length - 1] ? '700' : '500'}"
        >${tick}</text>
      `;
    })
    .join('');

  const xLabelIndices = [];
  for (let i = 0; i < points.length; i += 3) {
    xLabelIndices.push(i);
  }
  const lastIdx = points.length - 1;
  if (lastIdx >= 0 && xLabelIndices[xLabelIndices.length - 1] !== lastIdx) {
    if (lastIdx - xLabelIndices[xLabelIndices.length - 1] <= 1) {
      xLabelIndices.pop();
    }
    xLabelIndices.push(lastIdx);
  }

  const xLabelsMarkup = xLabelIndices
    .map((idx) => {
      const pt = points[idx];
      return `
        <line
          x1="${pt.x.toFixed(2)}"
          y1="${plotBottom}"
          x2="${pt.x.toFixed(2)}"
          y2="${plotBottom + 5}"
          stroke="${t.xTickLine}"
          stroke-width="1"
        />
        <text
          x="${pt.x.toFixed(2)}"
          y="${plotBottom + 21}"
          text-anchor="middle"
          fill="${idx === lastIdx ? t.xLabelLast : t.xLabelNormal}"
          font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace"
          font-size="11"
        >${escapeXml(pt.shortDate)}</text>
      `;
    })
    .join('');

  const labeledIndices = new Set();
  const placedXs = [];
  const peakPoint = points.find((pt) => pt.date === maxDay.date && pt.count === maxDay.contributionCount) || points[0];

  if (peakPoint) {
    labeledIndices.add(peakPoint.idx);
    placedXs.push(peakPoint.x);
  }

  const candidates = [...points]
    .filter((pt) => pt.count >= 25 || pt.idx === lastIdx)
    .sort((a, b) => {
      if (a.idx === lastIdx) return -1;
      if (b.idx === lastIdx) return 1;
      return b.count - a.count;
    });

  for (const cand of candidates) {
    if (labeledIndices.has(cand.idx)) continue;
    if (labeledIndices.size >= 5 && cand.idx !== lastIdx) continue;
    const tooClose = placedXs.some((px) => Math.abs(px - cand.x) < 68);
    if (!tooClose) {
      labeledIndices.add(cand.idx);
      placedXs.push(cand.x);
    }
  }

  const pointsMarkup = points
    .map((pt) => {
      const isPeak = peakPoint && pt.idx === peakPoint.idx;
      const hasActivity = pt.count > 0;
      const radius = isPeak ? 5.8 : hasActivity ? 3.8 : 2.3;
      const fill = isPeak ? t.pointPeakFill : hasActivity ? t.pointActiveFill : t.pointInactiveFill;
      const stroke = isPeak ? t.pointPeakStroke : hasActivity ? t.pointActiveStroke : t.pointInactiveStroke;

      let badgeMarkup = '';
      if (labeledIndices.has(pt.idx) && pt.count > 0) {
        const labelY = Math.max(plotTop - 10, pt.y - (isPeak ? 16 : 12));
        badgeMarkup = `
          <rect
            x="${(pt.x - 17).toFixed(2)}"
            y="${(labelY - 11).toFixed(2)}"
            width="34"
            height="15"
            rx="4"
            fill="${t.badgeBg}"
            fill-opacity="0.92"
            stroke="${isPeak ? t.badgePeakStroke : t.badgeSpikeStroke}"
            stroke-width="1"
          />
          <text
            x="${pt.x.toFixed(2)}"
            y="${labelY.toFixed(2)}"
            text-anchor="middle"
            fill="${isPeak ? t.badgePeakText : t.badgeSpikeText}"
            font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace"
            font-size="10.5"
            font-weight="700"
          >${pt.count}</text>
        `;
      }

      return `
        <g>
          <title>${escapeXml(`${pt.date}: ${pt.count} contribuciones`)}</title>
          ${isPeak ? `<circle cx="${pt.x.toFixed(2)}" cy="${pt.y.toFixed(2)}" r="10.5" fill="${t.peakHaloFill}" stroke="${t.peakHaloStroke}" stroke-width="1" />` : ''}
          <circle
            cx="${pt.x.toFixed(2)}"
            cy="${pt.y.toFixed(2)}"
            r="${radius}"
            fill="${fill}"
            stroke="${stroke}"
            stroke-width="${isPeak ? '2.4' : '1.7'}"
          />
          ${badgeMarkup}
        </g>
      `;
    })
    .join('');

  const periodRange =
    last31.length > 0
      ? `${formatDateShortEs(last31[0].date)} — ${formatDateShortEs(last31[last31.length - 1].date)}`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Actividad de Contribuciones de ${escapeXml(username)}">
  <defs>
    <linearGradient id="bg-${themeName}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.bgStops[0]}" />
      <stop offset="55%" stop-color="${t.bgStops[1]}" />
      <stop offset="100%" stop-color="${t.bgStops[2]}" />
    </linearGradient>
    <linearGradient id="hairline-${themeName}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${t.hairlineStops[0]}" />
      <stop offset="50%" stop-color="${t.hairlineStops[1]}" />
      <stop offset="100%" stop-color="${t.hairlineStops[2]}" />
    </linearGradient>
    <linearGradient id="line-${themeName}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${t.lineStops[0]}" />
      <stop offset="52%" stop-color="${t.lineStops[1]}" />
      <stop offset="100%" stop-color="${t.lineStops[2]}" />
    </linearGradient>
    <linearGradient id="area-${themeName}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${t.areaStops[0].color}" stop-opacity="${t.areaStops[0].op}" />
      <stop offset="52%" stop-color="${t.areaStops[1].color}" stop-opacity="${t.areaStops[1].op}" />
      <stop offset="100%" stop-color="${t.areaStops[2].color}" stop-opacity="${t.areaStops[2].op}" />
    </linearGradient>
    <clipPath id="plot-clip-${themeName}">
      <rect x="${plotLeft - 4}" y="${plotTop - 20}" width="${plotWidth + 8}" height="${plotBottom - plotTop + 26}" />
    </clipPath>
  </defs>

  <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="14" fill="url(#bg-${themeName})" stroke="${t.cardBorder}" stroke-width="1.5" />
  <line x1="22" y1="2" x2="${width - 22}" y2="2" stroke="url(#hairline-${themeName})" stroke-opacity="0.78" stroke-width="2" />

  <!-- Header -->
  <text x="28" y="34" fill="${t.titleFill}" font-family="'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif" font-size="18.5" font-weight="700">
    Actividad de Contribuciones · Últimos ${last31.length} días
  </text>
  <text x="28" y="55" fill="${t.subtitleFill}" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace" font-size="11.5">
    ${escapeXml(periodRange)}  |  Escala adaptativa: ${escapeXml(scaleLabel)}
  </text>

  <!-- Summary KPI Pills -->
  <g transform="translate(658, 17)">
    <rect x="0" y="0" width="130" height="44" rx="8" fill="${t.kpiBg}" stroke="${t.kpi1Border}" stroke-width="1" />
    <text x="12" y="17" fill="${t.kpiLabel}" font-family="'JetBrains Mono', ui-monospace, Consolas, monospace" font-size="9.5">ÚLTIMOS 31 DÍAS</text>
    <text x="12" y="35" fill="${t.kpi1Value}" font-family="'Segoe UI', sans-serif" font-size="15.5" font-weight="700">${escapeXml(total31.toLocaleString('en-US'))} (${activeDays}d)</text>

    <rect x="142" y="0" width="130" height="44" rx="8" fill="${t.kpiBg}" stroke="${t.kpi2Border}" stroke-width="1" />
    <text x="154" y="17" fill="${t.kpiLabel}" font-family="'JetBrains Mono', ui-monospace, Consolas, monospace" font-size="9.5">PICO DIARIO</text>
    <text x="154" y="35" fill="${t.kpi2Value}" font-family="'Segoe UI', sans-serif" font-size="15.5" font-weight="700">${maxDay.contributionCount} (${escapeXml(formatDateShortEs(maxDay.date))})</text>

    <rect x="284" y="0" width="126" height="44" rx="8" fill="${t.kpiBg}" stroke="${t.kpi3Border}" stroke-width="1" />
    <text x="296" y="17" fill="${t.kpiLabel}" font-family="'JetBrains Mono', ui-monospace, Consolas, monospace" font-size="9.5">TOTAL ANUAL</text>
    <text x="296" y="35" fill="${t.kpi3Value}" font-family="'Segoe UI', sans-serif" font-size="15.5" font-weight="700">${escapeXml(totalYear.toLocaleString('en-US'))}</text>
  </g>

  <!-- Horizontal Grid & Adaptive Y Axis -->
  <g>
    ${yGridMarkup}
  </g>

  <!-- Area & Monotone Cubic Curve -->
  <g clip-path="url(#plot-clip-${themeName})">
    <path d="${areaPath}" fill="url(#area-${themeName})" />
    <path d="${linePath}" fill="none" stroke="${t.lineGlow}" stroke-opacity="${t.lineGlowOpacity}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
    <path d="${linePath}" fill="none" stroke="url(#line-${themeName})" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- Data Points & Peak Labels -->
  <g>
    ${pointsMarkup}
  </g>

  <!-- X Axis Date Labels -->
  <g>
    ${xLabelsMarkup}
  </g>
</svg>
`;
}

async function main() {
  if (!TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const data = await fetchContributions(USERNAME, TOKEN);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const darkSvg = buildSvg({ username: USERNAME, ...data }, 'dark');
  const lightSvg = buildSvg({ username: USERNAME, ...data }, 'light');

  const darkPath = resolve(OUTPUT_DIR, 'activity-graph-dark.svg');
  const lightPath = resolve(OUTPUT_DIR, 'activity-graph-light.svg');
  const compatPath = resolve(OUTPUT_DIR, 'activity-graph.svg');

  await Promise.all([
    writeFile(darkPath, darkSvg, 'utf8'),
    writeFile(lightPath, lightSvg, 'utf8'),
    writeFile(compatPath, darkSvg, 'utf8')
  ]);

  console.log(
    `Generated dark/light SVGs for ${USERNAME}: totalYear=${data.totalYear}, last31=${data.last31.length} days, maxDay=${Math.max(...data.last31.map((d) => d.contributionCount))}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
