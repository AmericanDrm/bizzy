import { Platform, Alert } from 'react-native';
import { FinanceItem, PeriodReport, formatCurrency, formatFinanceDate, generateMonthlyReports, generateYearlyReports } from './financeService';

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const CHART_COLORS = [
  '#1B4D6E', '#2E7D52', '#C05621', '#B7791F', '#2C7A7B',
  '#C53030', '#6B5E31', '#285E61', '#702459', '#553C9A',
];

function buildDonutChartSvg(categoryData: { [key: string]: number }, total: number): string {
  if (total === 0 || Object.keys(categoryData).length === 0) return '';
  const entries = Object.entries(categoryData).sort(([, a], [, b]) => b - a).slice(0, 10);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const innerR = 38;

  let paths = '';
  let angle = -90;
  entries.forEach(([, amount], i) => {
    const sweep = (amount / total) * 360;
    const start = angle;
    const end = angle + sweep;
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const large = sweep > 180 ? 1 : 0;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}" />`;
    angle += sweep;
  });
  paths += `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white" />`;

  return `
    <div style="display:flex;align-items:center;gap:24px;margin:16px 0;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0;">
        ${paths}
      </svg>
      <div style="flex:1;">
        ${entries.map(([cat, amount], i) => {
          const pct = ((amount / total) * 100).toFixed(1);
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${CHART_COLORS[i % CHART_COLORS.length]};flex-shrink:0;"></div>
            <span style="flex:1;font-size:12px;color:#333;">${escapeHtml(cat)}</span>
            <span style="font-size:12px;font-weight:600;color:#555;">${pct}%</span>
            <span style="font-size:12px;font-weight:700;color:#1B4D6E;min-width:80px;text-align:right;">${formatCurrency(amount)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

export function generatePDFReport(
  filteredItems: FinanceItem[],
  viewMode: 'all' | 'analytics' | 'monthly' | 'yearly',
  totalIncome: number,
  totalExpenses: number,
  netIncome: number,
  startDate: Date | null,
  endDate: Date | null,
): void {
  if (Platform.OS !== 'web') {
    Alert.alert('PDF Export', 'PDF export is only available on web. Please use the web version to export reports.');
    return;
  }

  const dateRangeText = startDate || endDate
    ? `${startDate ? startDate.toLocaleDateString() : 'Beginning'} – ${endDate ? endDate.toLocaleDateString() : 'Present'}`
    : 'All Time';

  const expensesByCategory: { [k: string]: number } = {};
  const incomeByCategory: { [k: string]: number } = {};
  filteredItems.forEach((item) => {
    if (item.type === 'expense') expensesByCategory[item.category] = (expensesByCategory[item.category] || 0) + Number(item.amount);
    else incomeByCategory[item.category] = (incomeByCategory[item.category] || 0) + Number(item.amount);
  });

  let reportContent = '';
  const effectiveMode = viewMode === 'analytics' ? 'all' : viewMode;

  if (effectiveMode === 'all') {
    reportContent = buildAllTransactionsReport(filteredItems, dateRangeText, expensesByCategory, incomeByCategory, totalExpenses, totalIncome);
  } else {
    const reports = effectiveMode === 'monthly' ? generateMonthlyReports(filteredItems) : generateYearlyReports(filteredItems);
    reportContent = buildPeriodReport(reports, effectiveMode, dateRangeText);
  }

  const htmlContent = buildHtmlDocument(reportContent, dateRangeText, totalIncome, totalExpenses, netIncome);

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, '_blank');
  if (!printWindow) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

function buildAllTransactionsReport(
  items: FinanceItem[],
  dateRangeText: string,
  expensesByCategory: { [k: string]: number },
  incomeByCategory: { [k: string]: number },
  totalExpenses: number,
  totalIncome: number,
): string {
  const expenseItems = items.filter(i => i.type === 'expense');
  const incomeItems = items.filter(i => i.type === 'income');

  const expenseChart = buildDonutChartSvg(expensesByCategory, totalExpenses);
  const incomeChart = buildDonutChartSvg(incomeByCategory, totalIncome);

  const buildTable = (rows: FinanceItem[], type: 'income' | 'expense') => {
    if (rows.length === 0) return '<p style="color:#888;font-size:13px;">No records</p>';
    const color = type === 'income' ? '#10b981' : '#1B4D6E';
    return `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(item => `
            <tr>
              <td style="color:#666;">${escapeHtml(formatFinanceDate(item.date))}</td>
              <td>${escapeHtml(item.description)}</td>
              <td><span class="badge">${escapeHtml(item.category)}</span></td>
              <td style="text-align:right;color:${color};font-weight:700;">${type === 'income' ? '+' : '-'}${formatCurrency(item.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  };

  return `
    <div class="section-title">Income</div>
    ${Object.keys(incomeByCategory).length > 0 ? `
    <div class="subsection">
      <div class="subsection-title">Category Breakdown</div>
      ${incomeChart}
    </div>` : ''}
    <div class="subsection">
      <div class="subsection-title">All Income Transactions</div>
      ${buildTable(incomeItems, 'income')}
    </div>

    <div class="page-break"></div>

    <div class="section-title">Expenses</div>
    ${Object.keys(expensesByCategory).length > 0 ? `
    <div class="subsection">
      <div class="subsection-title">Category Breakdown</div>
      ${expenseChart}
    </div>` : ''}
    <div class="subsection">
      <div class="subsection-title">All Expense Transactions</div>
      ${buildTable(expenseItems, 'expense')}
    </div>
  `;
}

function buildPeriodReport(reports: PeriodReport[], viewMode: string, dateRangeText: string): string {
  return reports.map((report, idx) => `
    <div class="${idx > 0 ? 'page-break' : ''}">
      <div class="section-title">${escapeHtml(report.displayDate)}</div>
      <div class="metric-row">
        <div class="metric income-metric">
          <div class="metric-label">Income</div>
          <div class="metric-value income-color">${formatCurrency(report.income)}</div>
        </div>
        <div class="metric expense-metric">
          <div class="metric-label">Expenses</div>
          <div class="metric-value expense-color">${formatCurrency(report.expenses)}</div>
        </div>
        <div class="metric net-metric">
          <div class="metric-label">Net</div>
          <div class="metric-value" style="color:${report.net >= 0 ? '#10b981' : '#e53e3e'};">${formatCurrency(report.net)}</div>
        </div>
      </div>

      ${Object.keys(report.expensesByCategory).length > 0 ? `
      <div class="subsection">
        <div class="subsection-title">Expense Categories</div>
        ${buildDonutChartSvg(report.expensesByCategory, report.expenses)}
        ${buildCategoryTable(report.expensesByCategory, '#1B4D6E')}
      </div>` : ''}

      ${Object.keys(report.incomeByCategory).length > 0 ? `
      <div class="subsection">
        <div class="subsection-title">Income Categories</div>
        ${buildCategoryTable(report.incomeByCategory, '#10b981')}
      </div>` : ''}
    </div>
  `).join('');
}

function buildCategoryTable(data: { [k: string]: number }, color: string): string {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return `
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align:right;">Amount</th>
          <th style="text-align:right;">%</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(([cat, amount]) => `
          <tr>
            <td>${escapeHtml(cat)}</td>
            <td style="text-align:right;color:${color};font-weight:700;">${formatCurrency(amount)}</td>
            <td style="text-align:right;color:#888;">${total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0'}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function buildHtmlDocument(
  reportContent: string,
  dateRangeText: string,
  totalIncome: number,
  totalExpenses: number,
  netIncome: number,
): string {
  const netColor = netIncome >= 0 ? '#10b981' : '#e53e3e';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Financial Report – ${new Date().toLocaleDateString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: #222;
      background: #fff;
      padding: 40px;
      line-height: 1.5;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 3px solid #1B4D6E;
      margin-bottom: 28px;
    }
    .report-title { font-size: 26px; font-weight: 800; color: #1B4D6E; }
    .report-meta { font-size: 12px; color: #666; margin-top: 4px; }
    .report-period { font-size: 13px; font-weight: 600; color: #444; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .summary-card {
      border-radius: 10px;
      padding: 18px 20px;
      border: 1px solid #e2e8f0;
    }
    .summary-card.income { border-left: 4px solid #10b981; background: #f0fdf4; }
    .summary-card.expense { border-left: 4px solid #1B4D6E; background: #eff6ff; }
    .summary-card.net { border-left: 4px solid ${netColor}; background: ${netIncome >= 0 ? '#f0fdf4' : '#fff5f5'}; }
    .summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; margin-bottom: 8px; }
    .summary-value { font-size: 22px; font-weight: 800; }
    .income-color { color: #10b981; }
    .expense-color { color: #1B4D6E; }
    .section-title {
      font-size: 17px;
      font-weight: 800;
      color: #1B4D6E;
      margin: 28px 0 14px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
    }
    .subsection { margin-bottom: 20px; }
    .subsection-title {
      font-size: 13px;
      font-weight: 700;
      color: #444;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th {
      background: #f8fafc;
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 2px solid #e2e8f0;
    }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8fafc; }
    .badge {
      display: inline-block;
      background: #eef2ff;
      color: #3730a3;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
    }
    .metric-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0 20px; }
    .metric { border-radius: 8px; padding: 14px 16px; border: 1px solid #e2e8f0; }
    .income-metric { background: #f0fdf4; border-left: 3px solid #10b981; }
    .expense-metric { background: #eff6ff; border-left: 3px solid #1B4D6E; }
    .net-metric { background: #f8fafc; border-left: 3px solid #94a3b8; }
    .metric-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #888; margin-bottom: 6px; }
    .metric-value { font-size: 18px; font-weight: 800; }
    .page-break { page-break-before: always; margin-top: 0; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #aaa; text-align: center; }
    @media print {
      body { padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="report-title">Financial Report</div>
      <div class="report-meta">Generated: ${new Date().toLocaleString()}</div>
    </div>
    <div class="report-period">Period: ${escapeHtml(dateRangeText)}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card income">
      <div class="summary-label">Total Income</div>
      <div class="summary-value income-color">${formatCurrency(totalIncome)}</div>
    </div>
    <div class="summary-card expense">
      <div class="summary-label">Total Expenses</div>
      <div class="summary-value expense-color">${formatCurrency(totalExpenses)}</div>
    </div>
    <div class="summary-card net">
      <div class="summary-label">Net Income</div>
      <div class="summary-value" style="color:${netColor};">${formatCurrency(netIncome)}</div>
    </div>
  </div>

  ${reportContent}

  <footer>Confidential Financial Report &bull; ${new Date().toLocaleDateString()}</footer>
</body>
</html>`;
}
