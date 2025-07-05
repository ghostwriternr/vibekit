// Test the production Cloudflare deployment
async function testProductionDeployment() {
  console.log('🧪 Testing Production Cloudflare Container Deployment...');
  
  const urls = [
    'https://vibekit-containers-v2.workers.dev',
    'https://vibekit-containers-v2.1488191cae1bfd1933a441a093246040.workers.dev'
  ];
  
  for (const baseUrl of urls) {
    console.log(`\\n📋 Testing: ${baseUrl}`);
    
    const endpoints = [
      { path: '/health', name: 'Health Check' },
      { path: '/info', name: 'Container Info' },
      { path: '/', name: 'Web Interface' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`  Testing ${endpoint.name}: ${baseUrl}${endpoint.path}`);
        
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          timeout: 10000
        });
        
        console.log(`    Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          if (endpoint.path === '/') {
            const text = await response.text();
            console.log(`    Response: ${text.substring(0, 100)}...`);
          } else {
            try {
              const json = await response.json();
              console.log(`    ✅ JSON Response:`, json);
            } catch (error) {
              const text = await response.text();
              console.log(`    Response:`, text.substring(0, 200));
            }
          }
        } else {
          const errorText = await response.text();
          console.log(`    ❌ Error:`, errorText.substring(0, 200));
        }
        
      } catch (error) {
        console.log(`    ❌ Connection failed: ${error.message}`);
      }
    }
    
    // Test command execution
    try {
      console.log(`  Testing Command Execution: ${baseUrl}/execute`);
      const execResponse = await fetch(`${baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'echo "Hello from production Cloudflare container!"' }),
        timeout: 15000
      });
      
      console.log(`    Execute Status: ${execResponse.status}`);
      
      if (execResponse.ok) {
        const result = await execResponse.json();
        console.log(`    ✅ Execute Result:`, result);
      } else {
        const error = await execResponse.text();
        console.log(`    ❌ Execute Error:`, error.substring(0, 200));
      }
      
    } catch (error) {
      console.log(`    ❌ Execute failed: ${error.message}`);
    }
  }
  
  console.log('\\n📝 Summary:');
  console.log('   • If all endpoints show connection errors, the deployment may still be propagating');
  console.log('   • Container startup can take 1-2 minutes after deployment');
  console.log('   • Check Cloudflare Dashboard → Workers & Pages for deployment status');
  console.log('   • Live URL should be: https://vibekit-containers-v2.workers.dev');
}

testProductionDeployment();