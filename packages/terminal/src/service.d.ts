import { EventEmitter } from 'events';
import { TerminalOptions, TerminalCommand, CommandResult } from './types';
export declare class TerminalService extends EventEmitter {
    private static instance;
    private ptyProcess?;
    private state;
    private readonly ai;
    private commandHistory;
    private dataSubscription?;
    private exitSubscription?;
    private constructor();
    static getInstance(): TerminalService;
    start(options?: TerminalOptions): void;
    resize(rows: number, cols: number): void;
    executeCommand(cmd: TerminalCommand): Promise<CommandResult>;
    getSuggestions(currentCommand: string): Promise<string[]>;
    private setupEventHandlers;
    get processId(): number;
    get currentDirectory(): string;
    get currentShell(): string;
}
export default TerminalService;
