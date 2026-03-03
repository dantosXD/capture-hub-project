import { execSync } from 'child_process';
import http from 'http';

// Function to check if server is running
function checkServer() {
  return new Promise((resolve) => {
    http.get('http://localhost:3000/api/health', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Server health:', data);
        resolve(true);
      });
    }).on('error', () => resolve(false));
  });
}

// Function to stop server
async function stopServer() {
  try {
    // Find process on port 3000
    const result = execSync('netstat -ano | findstr ":3000"', { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const pids = new Set();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        pids.add(parts[parts.length - 1]);
      }
    }

    // Kill all PIDs
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
        console.log(`Killed process ${pid}`);
      } catch (e) {
        // Ignore
      }
    }

    // Wait a bit
    await new Promise(r => setTimeout(r, 3000));

    // Verify server is stopped
    const running = await checkServer();
    if (!running) {
      console.log('Server stopped successfully');
      return true;
    } else {
      console.log('Server still running!');
      return false;
    }
  } catch (e) {
    console.error('Error stopping server:', e.message);
    return false;
  }
}

stopServer().then(success => {
  process.exit(success ? 0 : 1);
});
