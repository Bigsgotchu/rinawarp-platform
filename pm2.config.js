module.exports = {
  apps: [
    {
      name: 'rinawarp-server',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'rinawarp-monitoring',
      script: './dist/services/MonitoringService.js',
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'rinawarp-performance',
      script: './dist/services/PerformanceService.js',
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
