module.exports = {
  apps: [
    {
      name: 'rinawarp',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
    },
    {
      name: 'rinawarp-worker',
      script: './dist/worker.js',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'rinawarp-docs',
      script: './dist/docs-server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],

  deploy: {
    production: {
      user: 'node',
      host: ['production-server'],
      ref: 'origin/main',
      repo: 'git@github.com:Bigsgotchu/rinawarp.git',
      path: '/var/www/rinawarp',
      'post-deploy':
        'npm install && npm run build && npm run db:migrate && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production',
      },
    },
    staging: {
      user: 'node',
      host: ['staging-server'],
      ref: 'origin/develop',
      repo: 'git@github.com:Bigsgotchu/rinawarp.git',
      path: '/var/www/rinawarp-staging',
      'post-deploy':
        'npm install && npm run build && npm run db:migrate && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging',
      },
    },
  },
};
