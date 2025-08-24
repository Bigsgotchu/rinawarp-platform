import { automatedEmailService } from '../services/automated-emails';

export function initializeAutomatedEmails() {
  console.log('Initializing automated email service...');
  
  // The service is initialized when imported
  // We just need to make sure it's imported and running
  
  if (automatedEmailService) {
    console.log('✓ Automated email service initialized successfully');
    console.log('Scheduled tasks:');
    console.log('  • Daily usage checks at 9 AM');
    console.log('  • Weekly reports every Monday at 8 AM');
    console.log('  • Monthly summaries on 1st of each month at 7 AM');
  } else {
    console.error('× Failed to initialize automated email service');
  }
}
