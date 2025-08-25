export interface TerminalSize {
  rows: number;
  cols: number;
}

export interface TerminalOptions {
  initialSize?: TerminalSize;
  historySize?: number;
  tabWidth?: number;
  scrollback?: number;
  env?: Record<string, string>;
}

export interface TerminalState {
  cursorX: number;
  cursorY: number;
  size: TerminalSize;
  buffer: string[];
  history: string[];
  historyIndex: number;
  mode: TerminalMode;
}

export enum TerminalMode {
  NORMAL = 'normal',
  INSERT = 'insert',
  SEARCH = 'search',
  SELECT = 'select',
}

export interface TerminalCommand {
  command: string;
  args: string[];
  options: Record<string, any>;
  raw: string;
  timestamp: number;
}

export interface CommandResult {
  output: string;
  exitCode: number;
  error?: Error;
  duration: number;
  metadata?: Record<string, any>;
}

export interface TerminalEvent {
  type: TerminalEventType;
  data: any;
  timestamp: number;
}

export enum TerminalEventType {
  INPUT = 'input',
  OUTPUT = 'output',
  RESIZE = 'resize',
  MODE_CHANGE = 'mode_change',
  COMMAND = 'command',
  ERROR = 'error',
  CLEAR = 'clear',
}

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalProfile {
  id: string;
  name: string;
  theme: TerminalTheme;
  font: string;
  fontSize: number;
  lineHeight: number;
  padding: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  env: Record<string, string>;
}
