import { execSync } from 'child_process';

async function deployToRailway() {
  try {
    console.log('🚀 Starting Railway deployment...');

    // Build the application
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    // Run database migrations
    console.log('Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // Deploy to Railway
    console.log('Deploying to Railway...');
    execSync('railway up', { stdio: 'inherit' });

    // Deploy static assets to AWS S3 (if needed)
    if (process.env.AWS_S3_BUCKET) {
      console.log('Deploying static assets to S3...');
      execSync(`aws s3 sync ./public s3://${process.env.AWS_S3_BUCKET} --delete`, { stdio: 'inherit' });
    }

    // Invalidate CloudFront cache (if needed)
    if (process.env.CLOUDFRONT_DISTRIBUTION_ID) {
      console.log('Invalidating CloudFront cache...');
      execSync(`aws cloudfront create-invalidation --distribution-id ${process.env.CLOUDFRONT_DISTRIBUTION_ID} --paths "/*"`, { stdio: 'inherit' });
    }

    console.log('✅ Deployment completed successfully!');
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

deployToRailway();
