"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const shared_1 = require("@rinawarp/shared");
const prisma = new client_1.PrismaClient({
    log: [
        {
            emit: 'event',
            level: 'query',
        },
        {
            emit: 'event',
            level: 'error',
        },
        {
            emit: 'event',
            level: 'info',
        },
        {
            emit: 'event',
            level: 'warn',
        },
    ],
});
exports.prisma = prisma;
prisma.$on('query', (e) => {
    shared_1.logger.debug('Query: ' + e.query);
});
prisma.$on('error', (e) => {
    shared_1.logger.error('Prisma Error: ' + e.message);
});
prisma.$on('info', (e) => {
    shared_1.logger.info('Prisma Info: ' + e.message);
});
prisma.$on('warn', (e) => {
    shared_1.logger.warn('Prisma Warning: ' + e.message);
});
//# sourceMappingURL=database.js.map