import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const tokenRequestDuration = new Trend('token_request_duration');
const apiRequestDuration = new Trend('api_request_duration');
const successRate = new Rate('success_rate');
const errorRate = new Rate('error_rate');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete within 500ms
    'token_request_duration': ['p(95)<1000'],  // 95% of token requests within 1s
    'api_request_duration': ['p(95)<200'],  // 95% of API requests within 200ms
    'success_rate': ['rate>0.95'],  // 95% success rate
  },
};

// Test setup
const API_URL = __ENV.API_URL || 'https://api.staging.rinawarptech.com';
const TEST_EMAIL = 'performance-test@rinawarptech.com';
const TEST_PASSWORD = 'performance-test-password';

export function setup() {
  // Get test auth token
  const loginRes = http.post(`${API_URL}/auth/login`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });
  
  return {
    token: loginRes.json().token,
  };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  group('API Health Check', function() {
    const healthRes = http.get(`${API_URL}/health`);
    check(healthRes, {
      'health check successful': (r) => r.status === 200,
    });
    sleep(1);
  });

  group('Core API Functions', function() {
    // Test completion endpoint
    const completionRes = http.post(`${API_URL}/ai/completion`, {
      prompt: `Generate a test response for: ${randomString(10)}`,
      max_tokens: 100,
    }, { headers });

    check(completionRes, {
      'completion successful': (r) => r.status === 200,
      'completion contains text': (r) => r.json().text.length > 0,
    });
    apiRequestDuration.add(completionRes.timings.duration);
    successRate.add(completionRes.status === 200);
    errorRate.add(completionRes.status !== 200);

    sleep(2);

    // Test file search endpoint
    const searchRes = http.post(`${API_URL}/search`, {
      query: randomString(5),
      path: '/test/path',
    }, { headers });

    check(searchRes, {
      'search successful': (r) => r.status === 200,
    });
    apiRequestDuration.add(searchRes.timings.duration);
    successRate.add(searchRes.status === 200);
    errorRate.add(searchRes.status !== 200);

    sleep(1);
  });

  group('User Management', function() {
    // Get user profile
    const profileRes = http.get(`${API_URL}/user/profile`, { headers });
    
    check(profileRes, {
      'profile fetch successful': (r) => r.status === 200,
      'profile contains email': (r) => r.json().email === TEST_EMAIL,
    });
    apiRequestDuration.add(profileRes.timings.duration);
    successRate.add(profileRes.status === 200);
    errorRate.add(profileRes.status !== 200);

    sleep(1);

    // Update user preferences
    const prefsRes = http.put(`${API_URL}/user/preferences`, {
      theme: 'dark',
      notifications: true,
    }, { headers });

    check(prefsRes, {
      'preferences update successful': (r) => r.status === 200,
    });
    apiRequestDuration.add(prefsRes.timings.duration);
    successRate.add(prefsRes.status === 200);
    errorRate.add(prefsRes.status !== 200);
  });
}

export function teardown(data) {
  // Cleanup test data if needed
  const headers = {
    'Authorization': `Bearer ${data.token}`,
  };
  
  http.put(`${API_URL}/user/preferences/reset`, {}, { headers });
}
