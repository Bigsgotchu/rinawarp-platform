import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'vite';

async function startVite() {
  const server = await createServer({
    configFile: './vite.config.ts',
  });
  await server.listen();
  return server;
}

function startElectron(): ChildProcess {
  const electronProcess = spawn('electron', ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
    },
  });

  electronProcess.on('close', () => {
    process.exit();
  });

  return electronProcess;
}

// Start development
async function main() {
  try {
    const viteServer = await startVite();
    console.log('Vite server started');
    const electronApp = startElectron();
    console.log('Electron app started');

    process.on('SIGINT', () => {
      electronApp.kill();
      viteServer.close();
      process.exit();
    });
  } catch (error) {
    console.error('Failed to start development servers:', error);
    process.exit(1);
  }
}

main();
