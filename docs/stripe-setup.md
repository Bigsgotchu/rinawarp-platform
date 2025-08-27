# Stripe Integration Setup Guide

## Prerequisites
- Stripe account
- Access to production environment
- Domain with SSL certificate

## Steps to Set Up Stripe

### 1. Create Stripe Account
1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete business verification
3. Add your bank account for payouts

### 2. Get API Keys
1. Go to Developers → API Keys in Stripe Dashboard
2. Note down:
   - Publishable key
   - Secret key
   - Webhook signing secret (create this in step 4)

### 3. Configure Customer Portal
1. Go to Settings → Customer Portal in Stripe Dashboard
2. Configure branding:
   - Add your logo
   - Set brand colors
   - Customize email templates
3. Configure features:
   - Enable subscription management
   - Enable payment method management
   - Set allowed subscription updates
4. Set return URLs:
   - Success URL: https://your-domain.com/subscription
   - Default return URL: https://your-domain.com/account

### 4. Set Up Webhooks
1. Go to Developers → Webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: https://api.your-domain.com/api/webhooks/stripe
4. Select events to listen for:
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
5. Note down the signing secret

### 5. Update Environment Variables
Add these to your production environment:
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 6. Configure Products and Prices
1. Go to Products → Add Product
2. For each subscription tier:
   - Create a product
   - Add price points (monthly/yearly)
   - Note down price IDs
   - Add metadata:
     - tierId: [your-tier-id]
     - features: [JSON string of features]

### 7. Test in Test Mode
1. Switch to test mode in Stripe Dashboard
2. Use test card numbers:
   - Success: 4242 4242 4242 4242
   - Failed: 4000 0000 0000 0002
3. Test full subscription lifecycle:
   - Subscribe
   - Update subscription
   - Cancel subscription
   - Failed payment
   - Payment retry

### 8. Production Checklist
- [ ] SSL certificate installed
- [ ] Webhook endpoint accessible
- [ ] Test mode disabled
- [ ] Live API keys configured
- [ ] Customer Portal branded
- [ ] Products and prices set up
- [ ] Test successful subscription flow
- [ ] Test failed payment handling
- [ ] Monitor webhook delivery
- [ ] Set up Stripe alerts

### 9. Monitoring
1. Set up Stripe alerts:
   - Failed payment attempts
   - Webhook failures
   - Unusual activity
2. Monitor webhook events:
   ```bash
   # View webhook logs
   tail -f /var/log/rinawarp/stripe-webhooks.log
   
   # Check webhook status
   curl https://api.your-domain.com/health/webhooks
   ```

### 10. Common Issues
1. Webhook Failures
   - Check webhook signing secret
   - Verify SSL certificate
   - Check server logs
   - Ensure raw body parsing

2. Payment Failures
   - Check card validation
   - Verify price configuration
   - Check customer communication

3. Subscription Updates
   - Verify proration settings
   - Check permission configuration
   - Test billing cycle alignment

## Testing Webhooks Locally
Use Stripe CLI for local development:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
```

## Security Best Practices
1. Never log full card data
2. Use Stripe Elements for secure input
3. Validate webhook signatures
4. Use strong CORS policies
5. Keep API keys secure
6. Regular security audits
7. Monitor for unusual activity

## Support and Documentation
- [Stripe Documentation](https://stripe.com/docs)
- [API Reference](https://stripe.com/docs/api)
- [Support Portal](https://support.stripe.com)
- Internal Support: devops@your-company.com
