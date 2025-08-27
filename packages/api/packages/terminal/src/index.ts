export * from './types';

import { TerminalService } from './service';

// Create and export the singleton instance
const terminalInstance = TerminalService.getInstance();

// Export both the class and instance
export { TerminalService };
export default terminalInstance;
