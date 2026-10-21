export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roleCode: string;
  roleName: string;
  employeeId: string | null;
  permissions: string[];
  locationIds: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Resort {
  id: string;
  code: string;
  name: string;
  locationType: string;
  regionName?: string;
  status: string;
  employeeCount?: number;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation?: string;
  email?: string;
  phone?: string;
  gender?: string | null;
  status: string;
  currentResortId?: string;
  resortName?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  deviceUserId?: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  fingerStatus?: string;
  hireDate?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface DashboardStats {
  date: string;
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  missingPunch: number;
  attendancePercentage: number;
  onlineDevices: number;
  offlineDevices: number;
  totalDevices: number;
  resortCount: number;
}
