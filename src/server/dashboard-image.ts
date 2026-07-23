import { createRequire } from "node:module";

import { Resvg } from "@resvg/resvg-js";

import type { DashboardChart, DashboardDocument } from "../shared/dashboard-contract.js";

const WIDTH = 1200;
const COLORS = ["#2f61df", "#18a873", "#f07a32", "#805ad5", "#ca3f64"];
const require = createRequire(import.meta.url);

const fontFiles = [
  require.resolve("@expo-google-fonts/sarabun/400Regular/Sarabun_400Regular.ttf"),
  require.resolve("@expo-google-fonts/sarabun/600SemiBold/Sarabun_600SemiBold.ttf"),
  require.resolve("@expo-google-fonts/sarabun/700Bold/Sarabun_700Bold.ttf"),
];

interface ChartRow {
  label: string;
  values: number[];
  total: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function compactNumber(value: number): string {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function chartRows(chart: DashboardChart): { rows: ChartRow[]; series: string[] } {
  const series = [...new Set(chart.data.map((datum) => datum.series).filter(Boolean))] as string[];
  const finalSeries = series.length ? series : ["Value"];
  const rowMap = new Map<string, ChartRow>();

  for (const datum of chart.data) {
    const row = rowMap.get(datum.label) ?? {
      label: datum.label,
      values: Array(finalSeries.length).fill(0) as number[],
      total: 0,
    };
    const seriesIndex = series.length ? Math.max(0, finalSeries.indexOf(datum.series ?? "")) : 0;
    const value = datum.value ?? datum.score ?? 0;
    row.values[seriesIndex] += value;
    row.total += value;
    rowMap.set(datum.label, row);
  }

  return { rows: [...rowMap.values()].slice(0, 16), series: finalSeries };
}

function legendSvg(series: string[], top: number): string {
  if (series.length <= 1) return "";
  return series.map((name, index) => {
    const x = 260 + (index % 4) * 220;
    const y = top + Math.floor(index / 4) * 28;
    return [
      `<rect x="${x}" y="${y - 12}" width="14" height="14" rx="3" fill="${COLORS[index % COLORS.length]}"/>`,
      `<text x="${x + 22}" y="${y}" class="legend">${escapeXml(truncate(name, 22))}</text>`,
    ].join("");
  }).join("");
}

function barChartSvg(rows: ChartRow[], series: string[]): { body: string; height: number } {
  const rowHeight = 46;
  const top = series.length > 1 ? 190 + Math.ceil(series.length / 4) * 28 : 190;
  const height = top + rows.length * rowHeight + 70;
  const plotLeft = 310;
  const plotWidth = 780;
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);
  const body: string[] = [legendSvg(series, 155)];

  rows.forEach((row, rowIndex) => {
    const y = top + rowIndex * rowHeight;
    body.push(`<text x="${plotLeft - 18}" y="${y + 19}" text-anchor="end" class="label">${escapeXml(truncate(row.label, 32))}</text>`);
    body.push(`<line x1="${plotLeft}" y1="${y + 30}" x2="${plotLeft + plotWidth}" y2="${y + 30}" class="grid"/>`);

    let x = plotLeft;
    row.values.forEach((value, seriesIndex) => {
      const width = Math.max(0, value / maxTotal * plotWidth);
      if (width > 0) {
        body.push(
          `<rect x="${x}" y="${y}" width="${width}" height="28" fill="${COLORS[seriesIndex % COLORS.length]}"/>`,
        );
      }
      x += width;
    });
    body.push(`<text x="${Math.min(x + 10, WIDTH - 72)}" y="${y + 19}" class="value">${escapeXml(compactNumber(row.total))}</text>`);
  });

  return { body: body.join(""), height };
}

function lineChartSvg(rows: ChartRow[], series: string[]): { body: string; height: number } {
  const height = 650;
  const plotLeft = 110;
  const plotTop = 205;
  const plotWidth = 980;
  const plotHeight = 340;
  const maxValue = Math.max(...rows.flatMap((row) => row.values), 1);
  const body: string[] = [legendSvg(series, 155)];

  for (let tick = 0; tick <= 4; tick += 1) {
    const y = plotTop + plotHeight - tick / 4 * plotHeight;
    body.push(`<line x1="${plotLeft}" y1="${y}" x2="${plotLeft + plotWidth}" y2="${y}" class="grid"/>`);
    body.push(`<text x="${plotLeft - 14}" y="${y + 5}" text-anchor="end" class="axis">${escapeXml(compactNumber(maxValue * tick / 4))}</text>`);
  }

  series.forEach((_name, seriesIndex) => {
    const points = rows.map((row, rowIndex) => {
      const x = plotLeft + (rows.length <= 1 ? plotWidth / 2 : rowIndex / (rows.length - 1) * plotWidth);
      const y = plotTop + plotHeight - row.values[seriesIndex] / maxValue * plotHeight;
      return `${x},${y}`;
    });
    body.push(`<polyline points="${points.join(" ")}" fill="none" stroke="${COLORS[seriesIndex % COLORS.length]}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`);
  });

  const labelStep = Math.max(1, Math.ceil(rows.length / 8));
  rows.forEach((row, rowIndex) => {
    if (rowIndex % labelStep !== 0 && rowIndex !== rows.length - 1) return;
    const x = plotLeft + (rows.length <= 1 ? plotWidth / 2 : rowIndex / (rows.length - 1) * plotWidth);
    body.push(`<text x="${x}" y="${plotTop + plotHeight + 30}" text-anchor="middle" class="axis">${escapeXml(truncate(row.label, 14))}</text>`);
  });

  return { body: body.join(""), height };
}

export async function renderDashboardPreview(dashboard: DashboardDocument): Promise<Buffer | null> {
  const chart = dashboard.charts[0];
  if (!chart?.data.length) return null;

  const { rows, series } = chartRows(chart);
  if (!rows.length) return null;

  const chartType = chart.chartType.toLowerCase();
  const rendered = chartType.includes("line") || chartType.includes("area") || chartType.includes("time")
    ? lineChartSvg(rows, series)
    : barChartSvg(rows, series);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${rendered.height}" viewBox="0 0 ${WIDTH} ${rendered.height}">
      <style>
        text { font-family: "Sarabun"; fill: #172033; }
        .eyebrow { font-size: 18px; font-weight: 700; letter-spacing: 2px; fill: #2f61df; }
        .title { font-size: 34px; font-weight: 700; }
        .subtitle { font-size: 18px; fill: #586174; }
        .label { font-size: 18px; font-weight: 600; }
        .legend { font-size: 16px; fill: #586174; }
        .axis { font-size: 15px; fill: #586174; }
        .value { font-size: 16px; font-weight: 600; }
        .grid { stroke: #e7eaf0; stroke-width: 1; }
      </style>
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="56" y="48" class="eyebrow">DASHBOARD AGENT</text>
      <text x="56" y="92" class="title">${escapeXml(truncate(chart.title || dashboard.title, 64))}</text>
      <text x="56" y="126" class="subtitle">${escapeXml(truncate(chart.reason ?? dashboard.subtitle ?? dashboard.query, 110))}</text>
      ${rendered.body}
      <text x="56" y="${rendered.height - 24}" class="axis">Static preview • ${escapeXml(dashboard.execution.source)} • ${escapeXml(new Date(dashboard.generatedAt).toLocaleString("en"))}</text>
    </svg>
  `;

  const renderer = new Resvg(svg, {
    font: {
      fontFiles,
      defaultFontFamily: "Sarabun",
      loadSystemFonts: false,
    },
  });
  return Buffer.from(renderer.render().asPng());
}
