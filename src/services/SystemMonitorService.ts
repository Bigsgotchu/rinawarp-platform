import os from 'os';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger';

const execAsync = promisify(exec);

interface SystemMetrics {
  cpuLoad: number;
  memoryUsage: number;
  diskIO: number;
  networkIO: number;
  timestamp: Date;
}

interface ProcessMetrics {
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  diskIO: number;
}

class SystemMonitorService {
  private lastCpuInfo: { idle: number; total: number } | null = null;
  private lastDiskStats: { read: number; write: number } | null = null;
  private lastNetworkStats: { rx: number; tx: number } | null = null;
  private readonly SAMPLE_INTERVAL = 1000; // 1 second

  async getCurrentMetrics(): Promise<SystemMetrics> {
    try {
      const [cpuLoad, memoryUsage, diskIO, networkIO] = await Promise.all([
        this.getCPULoad(),
        this.getMemoryUsage(),
        this.getDiskIO(),
        this.getNetworkIO()
      ]);

      return {
        cpuLoad,
        memoryUsage,
        diskIO,
        networkIO,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      return {
        cpuLoad: 0,
        memoryUsage: 0,
        diskIO: 0,
        networkIO: 0,
        timestamp: new Date()
      };
    }
  }

  async getProcessMetrics(pid: number): Promise<ProcessMetrics | null> {
    try {
      if (process.platform === 'darwin') {
        return this.getProcessMetricsDarwin(pid);
      } else if (process.platform === 'linux') {
        return this.getProcessMetricsLinux(pid);
      }
      return null;
    } catch (error) {
      logger.error(`Failed to get process metrics for PID ${pid}:`, error);
      return null;
    }
  }

  private async getCPULoad(): Promise<number> {
    const cpuInfo = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpuInfo) {
      idle += cpu.times.idle;
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle;
    }

    if (this.lastCpuInfo === null) {
      this.lastCpuInfo = { idle, total };
      return 0;
    }

    const idleDiff = idle - this.lastCpuInfo.idle;
    const totalDiff = total - this.lastCpuInfo.total;
    const load = 100 * (1 - idleDiff / totalDiff);

    this.lastCpuInfo = { idle, total };
    return Math.max(0, Math.min(100, load));
  }

  private async getMemoryUsage(): Promise<number> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return (totalMem - freeMem) / totalMem * 100;
  }

  private async getDiskIO(): Promise<number> {
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync('iostat -d 1 2 | tail -n 1');
        const fields = stdout.trim().split(/\s+/);
        return parseFloat(fields[2]); // KB/s transferred
      } else if (process.platform === 'linux') {
        const stats = await fs.readFile('/proc/diskstats', 'utf8');
        const total = stats.split('\n').reduce((acc, line) => {
          const fields = line.trim().split(/\s+/);
          if (fields.length >= 14) {
            return acc + parseInt(fields[5]) + parseInt(fields[9]); // reads + writes
          }
          return acc;
        }, 0);

        if (this.lastDiskStats === null) {
          this.lastDiskStats = { read: total, write: 0 };
          return 0;
        }

        const diff = total - this.lastDiskStats.read;
        this.lastDiskStats = { read: total, write: 0 };
        return diff / this.SAMPLE_INTERVAL * 100;
      }
      return 0;
    } catch (error) {
      logger.error('Failed to get disk I/O:', error);
      return 0;
    }
  }

  private async getNetworkIO(): Promise<number> {
    try {
      const interfaces = os.networkInterfaces();
      let total = { rx: 0, tx: 0 };

      Object.values(interfaces).forEach(iface => {
        if (!iface) return;
        iface.forEach(addr => {
          if (addr.internal) return;
          // Note: This is a mock calculation as real network stats
          // would require platform-specific implementations
          total.rx += Math.random() * 1000;
          total.tx += Math.random() * 1000;
        });
      });

      if (this.lastNetworkStats === null) {
        this.lastNetworkStats = total;
        return 0;
      }

      const diff = {
        rx: total.rx - this.lastNetworkStats.rx,
        tx: total.tx - this.lastNetworkStats.tx
      };

      this.lastNetworkStats = total;
      return (diff.rx + diff.tx) / this.SAMPLE_INTERVAL * 100;
    } catch (error) {
      logger.error('Failed to get network I/O:', error);
      return 0;
    }
  }

  private async getProcessMetricsDarwin(pid: number): Promise<ProcessMetrics | null> {
    try {
      const { stdout: psOutput } = await execAsync(
        `ps -o %cpu,%mem,rss -p ${pid}`
      );
      const [_, metrics] = psOutput.trim().split('\n');
      const [cpu, mem, rss] = metrics.trim().split(/\s+/).map(Number);

      return {
        pid,
        cpuUsage: cpu,
        memoryUsage: mem,
        diskIO: 0 // Not easily available on macOS
      };
    } catch (error) {
      logger.error(`Failed to get Darwin process metrics for PID ${pid}:`, error);
      return null;
    }
  }

  private async getProcessMetricsLinux(pid: number): Promise<ProcessMetrics | null> {
    try {
      const [statContent, statusContent] = await Promise.all([
        fs.readFile(`/proc/${pid}/stat`, 'utf8'),
        fs.readFile(`/proc/${pid}/status`, 'utf8')
      ]);

      const stats = statContent.split(' ');
      const utime = parseInt(stats[13]);
      const stime = parseInt(stats[14]);
      const cpuUsage = (utime + stime) / os.cpus().length;

      const vmSize = statusContent
        .split('\n')
        .find(line => line.startsWith('VmSize:'))
        ?.split(/\s+/)[1] || '0';

      return {
        pid,
        cpuUsage,
        memoryUsage: parseInt(vmSize) / os.totalmem() * 100,
        diskIO: 0 // Would require IO accounting enabled
      };
    } catch (error) {
      logger.error(`Failed to get Linux process metrics for PID ${pid}:`, error);
      return null;
    }
  }
}

export default new SystemMonitorService();
