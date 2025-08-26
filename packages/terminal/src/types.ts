export interface TerminalOptions {
  cwd?: string;
  shell?: string;
  env?: Record<string, string>;
  rows?: number;
  cols?: number;
}

export interface TerminalState {
  pid: number;
  cwd: string;
  shell: string;
  dimensions: {
    rows: number;
    cols: number;
  };
}

export interface TerminalCommand {
  command: string;
  cwd: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface CommandResult {
  command: string;
  output: string;
  exitCode: number;
  error?: string;
  duration: number;
}

export interface TerminalError extends Error {
  code?: string;
  cmd?: string;
  killed?: boolean;
  signal?: string;
}
