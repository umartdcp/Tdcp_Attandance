import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { ApiResponse, DashboardStats } from '../types';
import { useAuth } from './AuthContext';

export interface LiveEmployee {
  id: string;
  employeeCode: string;
  name: string;
  deviceUserId?: string | null;
  createdAt: string;
  resortName?: string | null;
  departmentName?: string | null;
}

export interface LiveAttendance {
  employeeName: string;
  resortName: string;
  departmentName?: string;
  attendanceDate: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  lateMinutes: number;
  earlyMinutes?: number;
}

export interface LiveNotice {
  id: string;
  text: string;
  at: string;
}

interface LiveFeed {
  stats: DashboardStats;
  recentEmployees: LiveEmployee[];
  recentAttendance: LiveAttendance[];
}

interface LiveContextValue {
  feed: LiveFeed | null;
  notices: LiveNotice[];
  resortId: string;
  setResortId: (id: string) => void;
  error: string;
  enableNotifications: () => void;
  clearNotices: () => void;
}

const LiveContext = createContext<LiveContextValue | undefined>(undefined);

export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [feed, setFeed] = useState<LiveFeed | null>(null);
  const [notices, setNotices] = useState<LiveNotice[]>([]);
  const [resortId, setResortId] = useState('');
  const [error, setError] = useState('');
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let stop = false;
    seen.current = new Set();
    let primed = false;

    async function tick() {
      try {
        const { data } = await api.get<ApiResponse<LiveFeed>>('/dashboard/live', {
          params: { resortId: resortId || undefined },
        });
        if (stop) return;
        const employees = data.data.recentEmployees ?? [];
        if (!primed) {
          employees.forEach((employee) => seen.current.add(employee.id));
          primed = true;
        } else {
          for (const employee of employees) {
            if (seen.current.has(employee.id)) continue;
            seen.current.add(employee.id);
            const text = `${employee.name} added${employee.resortName ? ` at ${employee.resortName}` : ''}`;
            setNotices((current) =>
              [{ id: `${employee.id}-${Date.now()}`, text, at: new Date().toISOString() }, ...current].slice(0, 15)
            );
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('TDCP Attendance', { body: text });
            }
          }
        }
        setFeed(data.data);
        setError('');
      } catch {
        if (!stop) setError('Live attendance feed is unavailable');
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), 12000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [user, resortId]);

  function enableNotifications() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  return (
    <LiveContext.Provider
      value={{
        feed,
        notices,
        resortId,
        setResortId,
        error,
        enableNotifications,
        clearNotices: () => setNotices([]),
      }}
    >
      {children}
    </LiveContext.Provider>
  );
}

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used within LiveProvider');
  return ctx;
}
