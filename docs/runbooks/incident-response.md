# Incident Response Runbook

## Quick Reference

### Immediate Actions
1. Acknowledge the alert in Slack/Email
2. Check CloudWatch dashboard: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=RinaWarp-Platform
3. Join the incident channel: #incidents
4. If production is affected, notify stakeholders

### Rollback Procedures

#### Quick Rollback via GitHub UI
1. Go to Actions → Rollback workflow
2. Click "Run workflow"
3. Select environment and components to rollback
4. Monitor the rollback process

#### Manual Rollback Steps
If GitHub Actions is unavailable:

```bash
# 1. Configure AWS credentials
export AWS_PROFILE=rinawarp-prod  # or rinawarp-staging

# 2. Rollback API
kubectl rollout undo deployment/api -n rinawarp

# 3. Rollback Desktop App
aws s3 cp s3://downloads.rinawarptech.com/RinaWarp-[PREVIOUS_VERSION].dmg s3://downloads.rinawarptech.com/latest/RinaWarp-latest-macos.dmg
aws s3 cp s3://downloads.rinawarptech.com/RinaWarp-[PREVIOUS_VERSION].exe s3://downloads.rinawarptech.com/latest/RinaWarp-latest-windows.exe
aws s3 cp s3://downloads.rinawarptech.com/RinaWarp-[PREVIOUS_VERSION].AppImage s3://downloads.rinawarptech.com/latest/RinaWarp-latest-linux.AppImage

# 4. Invalidate CDN cache
aws cloudfront create-invalidation --distribution-id [DIST_ID] --paths "/*"
```

### Common Issues and Solutions

#### High API Error Rate
1. Check EKS logs:
   ```bash
   kubectl logs -n rinawarp -l app=api --tail=100
   ```
2. Check database connections:
   ```bash
   kubectl exec -it -n rinawarp deployment/api -- curl localhost:9090/metrics | grep db_connections
   ```
3. Verify AWS service health: https://status.aws.amazon.com/

#### Slow API Response
1. Check API latency metrics in CloudWatch
2. Verify database performance metrics
3. Check for high CPU/Memory usage:
   ```bash
   kubectl top pods -n rinawarp
   ```

#### Database Issues
1. Check RDS metrics in CloudWatch
2. Verify connection pool settings
3. Check for long-running queries:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE pg_stat_activity.query != '<IDLE>' 
   AND pg_stat_activity.query NOT ILIKE '%pg_stat_activity%' 
   ORDER BY duration desc;
   ```

### Post-Incident Procedures
1. Update incident log
2. Schedule post-mortem meeting
3. Create JIRA tickets for follow-up actions
4. Update runbook with new learnings

## Monitoring Reference

### Key Metrics
- API Response Time: < 500ms (p95)
- Error Rate: < 0.1%
- Database CPU: < 80%
- Database Connections: < 80% of max
- API Pod CPU: < 80%
- API Pod Memory: < 80%

### Alert Thresholds
- Critical: Requires immediate action
  - Error rate > 1%
  - API latency > 1s
  - Database CPU > 90%
  - Multiple pod restarts

- Warning: Investigate during business hours
  - Error rate > 0.5%
  - API latency > 500ms
  - Database CPU > 80%
  - Single pod restart

### Dashboard URLs
- Main Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=RinaWarp-Platform
- API Metrics: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=RinaWarp-API
- Database Metrics: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=RinaWarp-Database

## Emergency Contacts

### On-Call Rotation
Primary on-call engineer is listed in PagerDuty

### Escalation Path
1. On-call engineer
2. Engineering manager
3. CTO
4. CEO

### External Services
- AWS Support: Premium (15min response)
- Stripe Support: Priority
- DataDog Support: 24/7

## Recovery Time Objectives (RTO)

| Service    | RTO    | RPO    |
|------------|--------|---------|
| API        | 5 min  | 0 min   |
| Website    | 15 min | 0 min   |
| Desktop    | 30 min | 24 hrs  |
| Database   | 1 hr   | 5 min   |
