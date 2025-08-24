import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, Paper, Grid } from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchAnalyticsReport, fetchSubscriptionPreferences } from '../../api/analytics';
import RevenueMetrics from './RevenueMetrics';
import SubscriptionMetrics from './SubscriptionMetrics';
import UsageMetrics from './UsageMetrics';
import CustomerMetrics from './CustomerMetrics';
import EmailPreferences from './EmailPreferences';
import DateRangePicker from './DateRangePicker';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorAlert from '../common/ErrorAlert';

const AnalyticsDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date()
  });

  // Fetch analytics data
  const {
    data: analyticsData,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
    refetch: refetchAnalytics
  } = useQuery(
    ['analytics', dateRange],
    () => fetchAnalyticsReport(dateRange.startDate, dateRange.endDate),
    {
      refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
    }
  );

  // Fetch email subscription preferences
  const {
    data: preferences,
    isLoading: isLoadingPreferences,
    error: preferencesError
  } = useQuery(['subscriptionPreferences'], fetchSubscriptionPreferences);

  // Handle date range changes
  const handleDateRangeChange = (newRange: { startDate: Date; endDate: Date }) => {
    setDateRange(newRange);
  };

  if (isLoadingAnalytics || isLoadingPreferences) {
    return <LoadingSpinner />;
  }

  if (analyticsError || preferencesError) {
    return (
      <ErrorAlert
        error={analyticsError || preferencesError}
        onRetry={() => refetchAnalytics()}
      />
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                Analytics Dashboard
              </Typography>
              <DateRangePicker
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onChange={handleDateRangeChange}
              />
            </Box>
          </Grid>

          {/* Email Preferences */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <EmailPreferences
                preferences={preferences}
              />
            </Paper>
          </Grid>

          {/* Metrics Grid */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <RevenueMetrics
                data={analyticsData?.revenue}
                dateRange={dateRange}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <SubscriptionMetrics
                data={analyticsData?.subscriptions}
                dateRange={dateRange}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <UsageMetrics
                data={analyticsData?.usage}
                dateRange={dateRange}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <CustomerMetrics
                data={analyticsData?.customers}
                dateRange={dateRange}
              />
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default AnalyticsDashboard;
