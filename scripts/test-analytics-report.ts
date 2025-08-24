import AnalyticsEmailService from '../src/services/AnalyticsEmailService';

async function testAnalyticsReport() {
  try {
    // Initialize the email service
    await AnalyticsEmailService.initialize();

    // Get email from command line args or use default
    const testEmail = process.argv[2] || 'test@example.com';

    console.log(`Sending test analytics report to ${testEmail}...`);
    
    // Send test report
    await AnalyticsEmailService.sendTestReport(testEmail);
    
    console.log('Test report sent successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to send test report:', error);
    process.exit(1);
  }
}

testAnalyticsReport();
