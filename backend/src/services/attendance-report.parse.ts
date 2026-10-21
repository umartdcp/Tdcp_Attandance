export interface ParsedAttendanceRow {
  userId: string;
  name: string;
  department: string;
  designation: string;
  gender: string;
  date: string;
  checkIn: string;
  checkOut: string;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  status: string;
  shiftStart: string;
  shiftEnd: string;
}

type Field =
  | 'userId'
  | 'name'
  | 'department'
  | 'designation'
  | 'gender'
  | 'date'
  | 'checkIn'
  | 'checkOut'
  | 'late'
  | 'early'
  | 'status'
  | 'shiftStart'
  | 'shiftEnd'
  | 'time'
  | 'direction';

const ALIASES: Record<Field, string[]> = {
  userId: ['user id', 'userid', 'user no', 'ac no', 'acno', 'emp no', 'emp id', 'employee id', 'employee no', 'employee code', 'pin', 'badge no', 'machine id', 'id'],
  name: ['employee name', 'emp name', 'staff name', 'full name', 'name'],
  department: ['department', 'dept', 'department name', 'dept name'],
  designation: ['designation', 'title', 'position', 'job title'],
  gender: ['gender', 'sex'],
  date: ['date', 'attendance date', 'att date', 'day'],
  checkIn: ['check in', 'checkin', 'clock in', 'time in', 'in time', 'on duty', 'first in', 'first time', 'arrival', 'in'],
  checkOut: ['check out', 'checkout', 'clock out', 'time out', 'out time', 'off duty', 'last out', 'last time', 'departure', 'out'],
  late: ['late', 'late min', 'late minutes', 'late time'],
  early: ['early', 'early leave', 'early departure', 'early out'],
  status: ['status', 'attendance', 'attendance status', 'result'],
  shiftStart: ['shift start', 'shift in', 'duty start'],
  shiftEnd: ['shift end', 'shift out', 'duty end'],
  time: ['time', 'punch time', 'datetime', 'date time'],
  direction: ['state', 'direction', 'punch state', 'in out', 'type'],
};

const OFFICIAL_DEPARTMENTS: Record<string, string> = {
  admin: 'Admin',
  administration: 'Admin',
  consultant: 'Consultant',
  events: 'Events',
  finance: 'Finance',
  accounts: 'Finance',
  'general transport': 'General & Transport',
  'general and transport': 'General & Transport',
  hr: 'HR',
  'human resource': 'HR',
  'human resources': 'HR',
  'ithm lahore': 'ITHM Lahore',
  ithm: 'ITHM Lahore',
  legal: 'Legal',
  marketing: 'Marketing',
  'md staff': 'MD staff',
  'md office': 'MD staff',
  operations: 'Operations',
  pmu: 'PMU',
  'registrar ithm': 'Registrar ITHM',
  it: 'IT',
  'information technology': 'IT',
  pnd: 'PND',
  pnp: 'PNP',
  'p and p': 'P&P',
  pp: 'P&P',
};

export function canonicalDepartment(value: string): string {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || text === '-' || text === '—') return '';
  const key = text.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  return OFFICIAL_DEPARTMENTS[key] ?? text;
}

export function parseAttendanceMatrix(matrix: string[][]): ParsedAttendanceRow[] {
  const rows = matrix.map((row) => row.map((cell) => String(cell ?? '').trim()));
  let headerIndex = -1;
  let headerMap: Array<Field | null> = [];
  let bestScore = 1;

  rows.slice(0, 40).forEach((row, index) => {
    const mapped = row.map(fieldFor);
    const fields = new Set(mapped.filter((field): field is Field => Boolean(field)));
    const score = fields.size;
    const useful = fields.has('name') || fields.has('userId');
    if (useful && score > bestScore) {
      bestScore = score;
      headerIndex = index;
      headerMap = mapped;
    }
  });

  if (headerIndex < 0) return [];

  const grouped = new Map<string, ParsedAttendanceRow & { direction?: string }>();
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const read = (field: Field) => {
      const index = headerMap.indexOf(field);
      return index >= 0 ? (row[index] ?? '') : '';
    };
    const userId = cleanId(read('userId'));
    const name = read('name');
    if (!userId && !name) return;
    const date = read('date');
    const explicitIn = clock(read('checkIn'));
    const explicitOut = clock(read('checkOut'));
    const singleTime = clock(read('time'));
    const direction = read('direction').toLowerCase();
    const punchLog = Boolean(singleTime) && !explicitIn && !explicitOut;
    const item: ParsedAttendanceRow = {
      userId,
      name,
      department: canonicalDepartment(read('department')),
      designation: read('designation'),
      gender: read('gender'),
      date,
      checkIn: explicitIn || (punchLog && !isOut(direction) ? singleTime : ''),
      checkOut: explicitOut || (punchLog && isOut(direction) ? singleTime : ''),
      lateMinutes: minutes(read('late')),
      earlyMinutes: minutes(read('early')),
      status: read('status'),
      shiftStart: clock(read('shiftStart')),
      shiftEnd: clock(read('shiftEnd')),
    };

    if (!punchLog) {
      grouped.set(`${userId}|${name.toLowerCase()}|${date}|${headerIndex + 1 + offset}`, item);
      return;
    }

    const groupKey = `${userId}|${name.toLowerCase()}|${date}`;
    const existing = grouped.get(groupKey);
    if (!existing) {
      grouped.set(groupKey, item);
      return;
    }
    if (isOut(direction)) existing.checkOut = singleTime;
    else if (!existing.checkIn) existing.checkIn = singleTime;
    else if (!existing.checkOut || singleTime > existing.checkOut) existing.checkOut = singleTime;
    if (!existing.department && item.department) existing.department = item.department;
    if (!existing.name && item.name) existing.name = item.name;
  });

  return [...grouped.values()].filter((row) => row.userId || row.name);
}

function fieldFor(header: string): Field | null {
  const normalized = header.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized || normalized === 'no' || normalized === 's no' || normalized === 'sr' || normalized === 'sr no') return null;
  const match = (Object.keys(ALIASES) as Field[]).find((field) => ALIASES[field].includes(normalized));
  return match ?? null;
}

function cleanId(value: string): string {
  const text = value.replace(/\.0$/, '').trim();
  if (!text || text === '-' || text === '—') return '';
  return text;
}

export function clock(value: string): string {
  const text = value.trim();
  if (!text || text === '-' || text === '—') return '';
  const match = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?/i);
  if (!match) return '';
  let hours = Number(match[1]);
  const mins = Number(match[2]);
  const secs = Number(match[3] ?? 0);
  const suffix = (match[4] ?? '').toLowerCase();
  if (suffix === 'pm' && hours < 12) hours += 12;
  if (suffix === 'am' && hours === 12) hours = 0;
  if (hours > 23 || mins > 59 || secs > 59) return '';
  if (hours === 0 && mins === 0 && secs === 0) return '';
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function minutes(value: string): number | null {
  const text = value.trim();
  if (!text || text === '-' || text === '—') return null;
  if (/^\d+$/.test(text)) return Number(text);
  const match = text.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isOut(direction: string): boolean {
  return /\bout\b|checkout|check out|off duty/.test(direction);
}
