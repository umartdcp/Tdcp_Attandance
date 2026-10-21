import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface AttendancePdfRow {
  employeeName?: string;
  departmentName?: string | null;
  resortName?: string;
  attendanceDate?: string | Date;
  checkIn?: string | Date | null;
  checkOut?: string | Date | null;
  lateMinutes?: number | null;
  status?: string;
}

const COLUMNS = [
  { title: 'Employee', width: 160 },
  { title: 'Department', width: 110 },
  { title: 'Site', width: 120 },
  { title: 'Date', width: 72 },
  { title: 'Check in', width: 68 },
  { title: 'Check out', width: 72 },
  { title: 'Late', width: 52 },
  { title: 'Status', width: 78 },
];

export function sendAttendancePdf(
  res: Response,
  filters: { dateFrom: string; dateTo: string },
  rows: AttendancePdfRow[]
): void {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32 });
  const filename = `TDCP-attendance-${filters.dateFrom}-to-${filters.dateTo}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const drawHeader = () => {
    doc.rect(0, 0, doc.page.width, 48).fill('#0c6a32');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('TDCP Attendance Report', 32, 16);
    doc.font('Helvetica').fontSize(9).text(`${filters.dateFrom} to ${filters.dateTo}  ·  ${rows.length} rows`, 360, 20);
    doc.fillColor('#123524');
  };

  drawHeader();
  let y = 64;
  const drawColumns = () => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0c6a32');
    let x = 32;
    for (const column of COLUMNS) {
      doc.text(column.title, x, y, { width: column.width, lineBreak: false });
      x += column.width;
    }
    y += 16;
    doc.moveTo(32, y - 4).lineTo(doc.page.width - 32, y - 4).strokeColor('#d5e6d6').stroke();
  };
  drawColumns();

  doc.font('Helvetica').fontSize(8).fillColor('#123524');
  for (const row of rows) {
    if (y > doc.page.height - 40) {
      doc.addPage();
      drawHeader();
      y = 64;
      drawColumns();
      doc.font('Helvetica').fontSize(8).fillColor('#123524');
    }
    const values = [
      pdfText(row.employeeName || '—'),
      pdfText(row.departmentName || '—'),
      pdfText(row.resortName || '—'),
      formatDate(row.attendanceDate),
      formatTime(row.checkIn),
      formatTime(row.checkOut),
      Number(row.lateMinutes) > 0 ? `${row.lateMinutes} min` : '—',
      pdfText(statusLabel(row.status)),
    ];
    let x = 32;
    values.forEach((value, index) => {
      doc.text(value, x, y, { width: COLUMNS[index].width - 6, lineBreak: false });
      x += COLUMNS[index].width;
    });
    y += 14;
  }

  if (!rows.length) {
    doc.fontSize(11).text('No attendance rows for this period.', 32, y + 8);
  }

  doc.end();
}

function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim() || '—';
}

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(date);
}

function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function statusLabel(status?: string): string {
  if (!status) return '—';
  return status.replaceAll('_', ' ');
}
