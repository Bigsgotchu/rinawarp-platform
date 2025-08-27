const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

async function loadSecrets() {
  try {
    const secrets = new AWS.SecretsManager({
      region: process.env.AWS_REGION || 'us-west-2'
    });

    const result = await secrets.getSecretValue({ SecretId: 'rinawarp/app-secrets' }).promise();
    const secretData = JSON.parse(result.SecretString);

    // Merge secrets into process.env
    Object.assign(process.env, secretData);

    console.log('✨ Secrets loaded successfully');
  } catch (error) {
    console.error('Error loading secrets:', error);
    process.exit(1);
  }
}

module.exports = loadSecrets;

// If running directly (not imported), load secrets
if (require.main === module) {
  loadSecrets();
}
