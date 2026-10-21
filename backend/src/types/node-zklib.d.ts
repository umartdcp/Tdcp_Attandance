declare module 'node-zklib' {
  interface ZkUser {
    uid: number;
    name: string;
    userId: string;
    cardno?: number;
  }

  interface ZkAttendance {
    userSn: number;
    deviceUserId: string;
    recordTime: Date | string;
  }

  export default class ZKLib {
    constructor(ip: string, port: number, timeout: number, inport: number);
    createSocket(): Promise<void>;
    getUsers(): Promise<{ data: ZkUser[] }>;
    getAttendances(): Promise<{ data: ZkAttendance[] }>;
    disconnect(): Promise<void>;
  }
}
