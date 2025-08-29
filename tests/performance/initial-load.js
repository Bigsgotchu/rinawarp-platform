import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests must complete within 500ms
    http_req_failed: ['rate<0.01'],     // Less than 1% of requests can fail
    errors: ['rate<0.05'],              // Less than 5% error rate
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.perf.rinawarptech.com';

export default function() {
  group('API Health Check', function() {
    const response = http.get(`${BASE_URL}/health`);
    check(response, {
      'status is 200': (r) => r.status === 200,
    });
    errorRate.add(response.status !== 200);
  });

  group('Basic Terminal Operations', function() {
    // Initialize terminal session
    const initResponse = http.post(`${BASE_URL}/terminal/session`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'bash',
        cwd: '/tmp',
      }),
    });
    
    check(initResponse, {
      'session created': (r) => r.status === 200,
      'session id exists': (r) => r.json().sessionId !== undefined,
    });
    errorRate.add(initResponse.status !== 200);

    if (initResponse.status === 200) {
      const sessionId = initResponse.json().sessionId;

      // Execute simple command
      const execResponse = http.post(`${BASE_URL}/terminal/${sessionId}/exec`, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'echo "Hello World"',
        }),
      });
      
      check(execResponse, {
        'command executed': (r) => r.status === 200,
        'output received': (r) => r.json().output.includes('Hello World'),
      });
      errorRate.add(execResponse.status !== 200);

      sleep(1);
    }
  });

  group('AI Completions', function() {
    const completionResponse = http.post(`${BASE_URL}/ai/completion`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write a function to calculate fibonacci numbers',
        maxTokens: 100,
      }),
    });
    
    check(completionResponse, {
      'completion successful': (r) => r.status === 200,
      'completion received': (r) => r.json().completion !== undefined,
    });
    errorRate.add(completionResponse.status !== 200);

    sleep(2);
  });

  group('File Operations', function() {
    // Search files
    const searchResponse = http.post(`${BASE_URL}/search`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'function main',
        path: '/test',
      }),
    });
    
    check(searchResponse, {
      'search successful': (r) => r.status === 200,
      'results received': (r) => Array.isArray(r.json().results),
    });
    errorRate.add(searchResponse.status !== 200);

    sleep(1);
  });
}
