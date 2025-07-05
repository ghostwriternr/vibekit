const express = require('express');
const { spawn } = require('child_process');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: process.env.MESSAGE || 'Container is running',
    instanceId: process.env.CLOUDFLARE_DEPLOYMENT_ID || 'local',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Command execution endpoint
app.post('/execute', async (req, res) => {
  const { command, timeout = 30000 } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  console.log(`Executing command: ${command}`);
  
  try {
    const result = await executeCommand(command, timeout);
    res.json({
      success: true,
      command,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      command,
      timestamp: new Date().toISOString()
    });
  }
});

// Container info endpoint
app.get('/info', (req, res) => {
  res.json({
    container: 'vibekit-cloudflare-container',
    version: '1.0.0',
    framework: 'cloudflare-containers',
    capabilities: ['command-execution', 'file-operations', 'network-access'],
    environment: process.env.NODE_ENV || 'development',
    message: process.env.MESSAGE || 'No message set',
    instanceId: process.env.CLOUDFLARE_DEPLOYMENT_ID || 'local',
    port: port,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint with simple web interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>VibeKit Cloudflare Container</title>
      <style>
        body { font-family: system-ui; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { padding: 15px; border-radius: 8px; margin: 15px 0; }
        .healthy { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #e9ecef; }
        button { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        input[type="text"] { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; margin: 10px 0; font-size: 16px; }
        .message { background: #cce7ff; color: #004085; padding: 10px; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 VibeKit Cloudflare Container</h1>
        <div class="status healthy">
          ✅ Container is running and healthy
        </div>
        
        <div class="message">
          💬 Message: ${process.env.MESSAGE || 'No message set'}<br>
          🆔 Instance ID: ${process.env.CLOUDFLARE_DEPLOYMENT_ID || 'local'}
        </div>
        
        <h3>Test Command Execution</h3>
        <input type="text" id="command" placeholder="Enter command (e.g., echo 'Hello World', ls, pwd)" value="echo 'Hello from Cloudflare Container!'">
        <button onclick="executeCommand()">Execute Command</button>
        
        <h3>Output:</h3>
        <pre id="output">Ready to execute commands...</pre>
        
        <script>
          async function executeCommand() {
            const command = document.getElementById('command').value;
            const output = document.getElementById('output');
            
            try {
              output.textContent = 'Executing...';
              const response = await fetch('/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
              });
              
              const result = await response.json();
              output.textContent = JSON.stringify(result, null, 2);
            } catch (error) {
              output.textContent = 'Error: ' + error.message;
            }
          }
        </script>
      </div>
    </body>
    </html>
  `);
});

// Function to execute commands
function executeCommand(command, timeout) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Split command into parts
    const parts = command.trim().split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      timeout: timeout
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        stdout: stdout,
        stderr: stderr,
        exitCode: code,
        duration: duration
      });
    });
    
    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      reject(new Error(`Command failed: ${error.message}`));
    });
    
    // Handle timeout
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }
    }, timeout);
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`VibeKit Container listening on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Execute endpoint: http://localhost:${port}/execute`);
  console.log(`Info endpoint: http://localhost:${port}/info`);
  console.log(`Web interface: http://localhost:${port}`);
});