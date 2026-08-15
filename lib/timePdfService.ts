import { Platform, Alert } from 'react-native';

export interface TimeEntryForPdf {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  user_id: string;
  user_name?: string;
  user_email?: string;
  breaks?: { started_at: string; ended_at?: string; notes?: string }[];
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calcHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

interface EmployeeSummary {
  userId: string;
  name: string;
  email: string;
  entries: TimeEntryForPdf[];
  totalHours: number;
  totalEntries: number;
  completedEntries: number;
}

export function generateTimeClockPDF(
  entries: TimeEntryForPdf[],
  startDate: Date | null,
  endDate: Date | null,
  organizationName?: string,
): void {
  if (Platform.OS !== 'web') {
    Alert.alert('PDF Export', 'PDF export is only available on web.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    Alert.alert('Error', 'Please allow pop-ups to export PDF');
    return;
  }

  const dateRangeText = startDate || endDate
    ? `${startDate ? startDate.toLocaleDateString() : 'Beginning'} – ${endDate ? endDate.toLocaleDateString() : 'Present'}`
    : 'All Time';

  const byEmployee: { [userId: string]: EmployeeSummary } = {};
  entries.forEach((entry) => {
    if (!byEmployee[entry.user_id]) {
      byEmployee[entry.user_id] = {
        userId: entry.user_id,
        name: entry.user_name || entry.user_email || 'Unknown',
        email: entry.user_email || '',
        entries: [],
        totalHours: 0,
        totalEntries: 0,
        completedEntries: 0,
      };
    }
    const emp = byEmployee[entry.user_id];
    emp.entries.push(entry);
    emp.totalEntries++;
    if (entry.clock_out) {
      emp.completedEntries++;
      emp.totalHours += calcHours(entry.clock_in, entry.clock_out);
    }
  });

  const employees = Object.values(byEmployee).sort((a, b) => a.name.localeCompare(b.name));
  const grandTotalHours = employees.reduce((s, e) => s + e.totalHours, 0);
  const grandTotalEntries = employees.reduce((s, e) => s + e.completedEntries, 0);

  const summaryRows = employees.map((emp) => `
    <tr>
      <td>${escapeHtml(emp.name)}</td>
      <td style="color:#666;">${escapeHtml(emp.email)}</td>
      <td style="text-align:center;">${emp.completedEntries}</td>
      <td style="text-align:right;font-weight:700;color:#1B4D6E;">${formatHours(emp.totalHours)}</td>
    </tr>
  `).join('');

  const detailSections = employees.map((emp, idx) => {
    const sortedEntries = [...emp.entries].sort(
      (a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime()
    );

    const byMonth: { [key: string]: TimeEntryForPdf[] } = {};
    sortedEntries.forEach((e) => {
      const key = e.clock_in.slice(0, 7);
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(e);
    });

    const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

    const monthSections = monthKeys.map((mk) => {
      const monthEntries = byMonth[mk];
      const monthHours = monthEntries.reduce((s, e) => s + calcHours(e.clock_in, e.clock_out), 0);
      const [year, month] = mk.split('-');
      const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const rows = monthEntries.map((entry) => {
        const hours = calcHours(entry.clock_in, entry.clock_out);
        const breakCount = entry.breaks?.length || 0;
        return `
          <tr>
            <td>${escapeHtml(formatDate(entry.clock_in))}</td>
            <td>${escapeHtml(formatTime(entry.clock_in))}</td>
            <td>${entry.clock_out ? escapeHtml(formatTime(entry.clock_out)) : '<span style="color:#f59e0b;font-weight:600;">Active</span>'}</td>
            <td style="text-align:right;font-weight:700;color:#1B4D6E;">${entry.clock_out ? formatHours(hours) : '—'}</td>
            <td style="text-align:center;color:#666;">${breakCount > 0 ? breakCount : '—'}</td>
            <td style="color:#666;font-size:11px;max-width:160px;">${escapeHtml(entry.notes || '')}</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="month-group">
          <div class="month-header">
            <span>${escapeHtml(monthLabel)}</span>
            <span style="font-weight:700;color:#1B4D6E;">${formatHours(monthHours)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th style="text-align:right;">Duration</th>
                <th style="text-align:center;">Breaks</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    return `
      <div class="${idx > 0 ? 'page-break' : ''}">
        <div class="employee-header">
          <div class="employee-name">${escapeHtml(emp.name)}</div>
          <div class="employee-meta">${escapeHtml(emp.email)}</div>
          <div class="employee-stats">
            <div class="stat-chip">${emp.completedEntries} sessions</div>
            <div class="stat-chip total-chip">${formatHours(emp.totalHours)} total</div>
          </div>
        </div>
        ${monthSections}
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Time Clock Report – ${new Date().toLocaleDateString()}</title>
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
    .summary-card.sessions { border-left: 4px solid #2E7D52; background: #f0fdf4; }
    .summary-card.hours { border-left: 4px solid #1B4D6E; background: #eff6ff; }
    .summary-card.team { border-left: 4px solid #B7791F; background: #fffbeb; }
    .summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; margin-bottom: 8px; }
    .summary-value { font-size: 22px; font-weight: 800; color: #1B4D6E; }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #1B4D6E;
      margin: 28px 0 14px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th {
      background: #f8fafc;
      padding: 9px 10px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 2px solid #e2e8f0;
    }
    td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .employee-header {
      background: linear-gradient(135deg, #1B4D6E, #2C7A7B);
      color: white;
      padding: 20px 24px;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .employee-name { font-size: 20px; font-weight: 800; }
    .employee-meta { font-size: 12px; opacity: 0.8; margin-top: 2px; }
    .employee-stats { display: flex; gap: 10px; margin-top: 10px; }
    .stat-chip {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .total-chip { background: rgba(255,255,255,0.35); }
    .month-group { margin-bottom: 20px; }
    .month-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #444;
      margin-bottom: 6px;
    }
    .page-break { page-break-before: always; }
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
      <div class="report-title">Time Clock Report${organizationName ? ` — ${escapeHtml(organizationName)}` : ''}</div>
      <div class="report-meta">Generated: ${new Date().toLocaleString()}</div>
    </div>
    <div style="text-align:right;font-size:13px;font-weight:600;color:#444;">Period: ${escapeHtml(dateRangeText)}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card team">
      <div class="summary-label">Team Members</div>
      <div class="summary-value" style="color:#B7791F;">${employees.length}</div>
    </div>
    <div class="summary-card sessions">
      <div class="summary-label">Total Sessions</div>
      <div class="summary-value" style="color:#2E7D52;">${grandTotalEntries}</div>
    </div>
    <div class="summary-card hours">
      <div class="summary-label">Total Hours</div>
      <div class="summary-value">${formatHours(grandTotalHours)}</div>
    </div>
  </div>

  <div class="section-title">Team Summary</div>
  <table>
    <thead>
      <tr>
        <th>Employee</th>
        <th>Email</th>
        <th style="text-align:center;">Sessions</th>
        <th style="text-align:right;">Total Hours</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
  </table>

  ${detailSections}

  <footer>Confidential Time Clock Report &bull; ${new Date().toLocaleDateString()}</footer>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 400);
}

/**
 * Generates a clean payroll summary PDF: one row per employee showing
 * total hours and sessions for the selected period. Designed for payroll processing.
 */
export function generatePayrollSummaryPDF(
  entries: TimeEntryForPdf[],
  startDate: Date | null,
  endDate: Date | null,
  organizationName?: string,
): void {
  if (Platform.OS !== 'web') {
    Alert.alert('PDF Export', 'PDF export is only available on web.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    Alert.alert('Error', 'Please allow pop-ups to export PDF');
    return;
  }

  const periodLabel = startDate || endDate
    ? `${startDate ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Beginning'} – ${endDate ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Present'}`
    : 'All Time';

  const byEmployee: { [userId: string]: EmployeeSummary } = {};
  entries.forEach((entry) => {
    if (!byEmployee[entry.user_id]) {
      byEmployee[entry.user_id] = {
        userId: entry.user_id,
        name: entry.user_name || entry.user_email || 'Unknown',
        email: entry.user_email || '',
        entries: [],
        totalHours: 0,
        totalEntries: 0,
        completedEntries: 0,
      };
    }
    const emp = byEmployee[entry.user_id];
    emp.entries.push(entry);
    emp.totalEntries++;
    if (entry.clock_out) {
      emp.completedEntries++;
      emp.totalHours += calcHours(entry.clock_in, entry.clock_out);
    }
  });

  const employees = Object.values(byEmployee).sort((a, b) => a.name.localeCompare(b.name));
  const grandTotal = employees.reduce((s, e) => s + e.totalHours, 0);

  const rows = employees.map((emp, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="padding:12px 16px;font-weight:600;color:#111827;">${escapeHtml(emp.name)}</td>
      <td style="padding:12px 16px;color:#6b7280;font-size:13px;">${escapeHtml(emp.email)}</td>
      <td style="padding:12px 16px;text-align:center;color:#374151;">${emp.completedEntries}</td>
      <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:15px;color:#1B4D6E;">${formatHours(emp.totalHours)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payroll Summary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; }
    .page { max-width: 760px; margin: 0 auto; padding: 48px 40px; }
    .logo-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
    .org-name { font-size: 22px; font-weight: 800; color: #1B4D6E; }
    .doc-label { font-size: 13px; color: #6b7280; font-weight: 500; }
    .title-row { margin-bottom: 28px; }
    .title { font-size: 28px; font-weight: 800; color: #111827; margin-bottom: 6px; }
    .period-badge { display: inline-block; background: #EFF6FF; color: #1B4D6E; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 20px; border: 1px solid #BFDBFE; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; }
    .summary-card .val { font-size: 22px; font-weight: 800; color: #1B4D6E; margin-bottom: 4px; }
    .summary-card .lbl { font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    thead tr { background: #1B4D6E; }
    thead th { padding: 12px 16px; color: #fff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
    thead th:nth-child(3) { text-align: center; }
    thead th:nth-child(4) { text-align: right; }
    tfoot tr { background: #EFF6FF; border-top: 2px solid #1B4D6E; }
    tfoot td { padding: 12px 16px; font-weight: 700; color: #1B4D6E; }
    footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print {
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="logo-bar">
      <div class="org-name">${escapeHtml(organizationName || 'Organization')}</div>
      <div class="doc-label">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>

    <div class="title-row">
      <div class="title">Payroll Summary</div>
      <div class="period-badge">Period: ${escapeHtml(periodLabel)}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="val">${employees.length}</div>
        <div class="lbl">Employees</div>
      </div>
      <div class="summary-card">
        <div class="val">${employees.reduce((s, e) => s + e.completedEntries, 0)}</div>
        <div class="lbl">Total Sessions</div>
      </div>
      <div class="summary-card">
        <div class="val">${formatHours(grandTotal)}</div>
        <div class="lbl">Total Hours</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Email</th>
          <th style="text-align:center;">Sessions</th>
          <th style="text-align:right;">Total Hours</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total</td>
          <td style="text-align:center;">${employees.reduce((s, e) => s + e.completedEntries, 0)}</td>
          <td style="text-align:right;">${formatHours(grandTotal)}</td>
        </tr>
      </tfoot>
    </table>

    <footer>Payroll Summary &bull; ${escapeHtml(organizationName || '')} &bull; ${new Date().toLocaleDateString()}</footer>
  </div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 400);
}
