const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const PORT = process.env.COMMAND_SERVER_PORT || 8080;
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || '/var/vibe0';

// Ensure working directory exists
async function ensureWorkingDirectory(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Failed to create working directory: ${error.message}`);
  }
}

// Execute a command and stream output
function executeCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      background = false,
      timeoutMs = 30000,
      workingDirectory = WORKING_DIRECTORY,
      onStdout,
      onStderr,
      onExit
    } = options;

    console.log(`Executing command: ${command} in ${workingDirectory}`);

    // Spawn the command in a shell
    const child = spawn('bash', ['-c', command], {
      cwd: workingDirectory,
      env: { ...process.env },
      detached: background
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout if not running in background
    let timeout;
    if (!background && timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    // Handle stdout
    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (onStdout) onStdout(chunk);
    });

    // Handle stderr
    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (onStderr) onStderr(chunk);
    });

    // Handle exit
    child.on('exit', (code, signal) => {
      if (timeout) clearTimeout(timeout);
      
      if (!timedOut) {
        const exitCode = code !== null ? code : (signal ? 1 : 0);
        if (onExit) onExit(exitCode);
        resolve({ exitCode, stdout, stderr });
      }
    });

    // Handle errors
    child.on('error', (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });

    // If background, resolve immediately
    if (background) {
      child.unref();
      resolve({ 
        exitCode: 0, 
        stdout: 'Background command started', 
        stderr: '' 
      });
    }
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', pid: process.pid }));
    return;
  }

  // Execute command endpoint
  if (req.url === '/execute' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const {
          command,
          background = false,
          timeoutMs = 30000,
          workingDirectory = WORKING_DIRECTORY
        } = request;

        if (!command) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Command is required' }));
          return;
        }

        // Ensure working directory exists
        await ensureWorkingDirectory(workingDirectory);

        // For streaming responses
        if (!background && (req.headers.accept === 'application/x-ndjson' || req.headers['x-stream'] === 'true')) {
          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff'
          });

          try {
            await executeCommand(command, {
              background,
              timeoutMs,
              workingDirectory,
              onStdout: (data) => {
                res.write(JSON.stringify({ type: 'stdout', content: data }) + '\n');
              },
              onStderr: (data) => {
                res.write(JSON.stringify({ type: 'stderr', content: data }) + '\n');
              },
              onExit: (exitCode) => {
                res.write(JSON.stringify({ type: 'exit', exitCode }) + '\n');
                res.end();
              }
            });
          } catch (error) {
            res.write(JSON.stringify({ 
              type: 'error', 
              content: error.message 
            }) + '\n');
            res.end();
          }
        } else {
          // Non-streaming response
          try {
            const result = await executeCommand(command, {
              background,
              timeoutMs,
              workingDirectory
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: error.message,
              exitCode: 1 
            }));
          }
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });

    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Command execution server listening on port ${PORT}`);
  console.log(`Working directory: ${WORKING_DIRECTORY}`);
  
  // Ensure working directory exists on startup
  await ensureWorkingDirectory(WORKING_DIRECTORY);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});