"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalService = void 0;
const pty = __importStar(require("node-pty"));
const events_1 = require("events");
const src_1 = require("../../../shared/src");
const src_2 = require("../../../ai/src");
class TerminalService extends events_1.EventEmitter {
    constructor() {
        super();
        this.commandHistory = [];
        this.ai = src_2.AIService.getInstance();
        this.state = {
            pid: 0,
            cwd: process.cwd(),
            shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
            dimensions: {
                rows: 24,
                cols: 80,
            },
        };
    }
    static getInstance() {
        if (!TerminalService.instance) {
            TerminalService.instance = new TerminalService();
        }
        return TerminalService.instance;
    }
    start(options = {}) {
        try {
            this.ptyProcess = pty.spawn(options.shell || this.state.shell, [], {
                name: 'xterm-color',
                cwd: options.cwd || this.state.cwd,
                env: options.env || process.env,
                rows: options.rows || this.state.dimensions.rows,
                cols: options.cols || this.state.dimensions.cols,
            });
            this.state = {
                pid: this.ptyProcess.pid,
                cwd: options.cwd || this.state.cwd,
                shell: options.shell || this.state.shell,
                dimensions: {
                    rows: options.rows || this.state.dimensions.rows,
                    cols: options.cols || this.state.dimensions.cols,
                },
            };
            this.setupEventHandlers();
            src_1.logger.info(`Terminal started with PID ${this.state.pid}`);
        }
        catch (error) {
            src_1.logger.error('Failed to start terminal:', error);
            throw error;
        }
    }
    resize(rows, cols) {
        if (this.ptyProcess) {
            this.ptyProcess.resize(cols, rows);
            this.state.dimensions = { rows, cols };
        }
    }
    async executeCommand(cmd) {
        return new Promise((resolve, reject) => {
            if (!this.ptyProcess) {
                reject(new Error('Terminal not initialized'));
                return;
            }
            const startTime = Date.now();
            let output = '';
            let error;
            const timeout = setTimeout(() => {
                const err = new Error('Command execution timed out');
                err.code = 'TIMEOUT';
                err.cmd = cmd.command;
                reject(err);
            }, cmd.timeout || 30000);
            const marker = '__CMD_DONE__:';
            let exitCode = null;
            const dataHandler = (data) => {
                output += data;
                const idx = output.lastIndexOf(marker);
                if (idx !== -1) {
                    const after = output.slice(idx + marker.length).trim();
                    const match = after.match(/^(\d+)/);
                    if (match) {
                        exitCode = parseInt(match[1], 10);
                        cleanupAndResolve();
                    }
                }
            };
            const dataSub = this.ptyProcess.onData(dataHandler);
            const cleanupAndResolve = () => {
                clearTimeout(timeout);
                dataSub.dispose();
                const cleanedOutput = output.replace(new RegExp(`${marker}\\d+`), '').trim();
                const result = {
                    command: cmd.command,
                    output: cleanedOutput,
                    exitCode: exitCode ?? 0,
                    error,
                    duration: Date.now() - startTime,
                };
                this.commandHistory.push(cmd.command);
                resolve(result);
            };
            this.ptyProcess.write(`${cmd.command} ; echo ${marker}$?` + '\\n');
            // Fallback: if marker not detected within timeout, return whatever we have
            // The timeout cleanup is handled above
        });
    }
    async getSuggestions(currentCommand) {
        try {
            const analysis = await this.ai.analyzeCommand(currentCommand, {
                previousCommands: this.commandHistory.slice(-5),
                currentDirectory: this.state.cwd,
            });
            return analysis.nextCommands || [];
        }
        catch (error) {
            src_1.logger.error('Error getting command suggestions:', error);
            return [];
        }
    }
    setupEventHandlers() {
        if (!this.ptyProcess)
            return;
        this.dataSubscription?.dispose();
        this.exitSubscription?.dispose();
        this.dataSubscription = this.ptyProcess.onData((data) => {
            this.emit('data', data);
        });
        this.exitSubscription = this.ptyProcess.onExit((evt) => {
            src_1.logger.info(`Terminal exited with code ${evt.exitCode}`);
            this.emit('exit', evt.exitCode);
        });
        process.on('exit', () => {
            this.ptyProcess?.kill();
        });
    }
    get processId() {
        return this.state.pid;
    }
    get currentDirectory() {
        return this.state.cwd;
    }
    get currentShell() {
        return this.state.shell;
    }
}
exports.TerminalService = TerminalService;
exports.default = TerminalService;
//# sourceMappingURL=service.js.map