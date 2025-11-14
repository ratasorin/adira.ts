import { spawn, ChildProcess } from "child_process";
import { AdiraConfig } from "./config";

export interface VerdaccioManager {
  start: (config: AdiraConfig) => Promise<ChildProcess | null>;
  stop: (process: ChildProcess | null) => void;
  isPortInUse: (port: number) => Promise<boolean>;
}

export const verdaccioManager: VerdaccioManager = {
  start: async (config: AdiraConfig): Promise<ChildProcess | null> => {
    const { verdaccioPort = 8888 } = config;
    const net = require('net');

    // Check if port is already in use
    const portInUse = await verdaccioManager.isPortInUse(verdaccioPort);
    if (portInUse) {
      console.log(`✅ Port ${verdaccioPort} is already in use. Assuming Verdaccio is running externally.`);
      return null;
    }

    console.log(`🚀 Starting Verdaccio on port ${verdaccioPort}...`);

    const verdaccioProcess = spawn('npx', ['verdaccio', '--listen', String(verdaccioPort)], {
      stdio: 'inherit',
      shell: true,
    });

    // Wait for Verdaccio to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    return verdaccioProcess;
  },

  stop: (process: ChildProcess | null) => {
    if (process) {
      console.log('🛑 Stopping Verdaccio...');
      process.kill('SIGTERM');
    }
  },

  isPortInUse: async (port: number): Promise<boolean> => {
    const net = require('net');
    
    return new Promise<boolean>((resolve) => {
      const server = net.createServer();

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          console.error(`Error checking port ${port}:`, err.message);
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close(() => resolve(false)); // Port is free
      });

      server.listen(port);
    });
  }
};