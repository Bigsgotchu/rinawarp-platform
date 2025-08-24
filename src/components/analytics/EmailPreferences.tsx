import React from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  Tooltip,
  IconButton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSubscriptionPreferences } from '../../api/analytics';
import { Info as InfoIcon } from '@mui/icons-material';

interface EmailPreferencesProps {
  preferences: {
    dailyAnalytics: boolean;
    weeklyAnalytics: boolean;
    monthlyAnalytics: boolean;
  };
}

const EmailPreferences: React.FC<EmailPreferencesProps> = ({ preferences }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Mutation for updating preferences
  const { mutate, isLoading, error } = useMutation(
    updateSubscriptionPreferences,
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['subscriptionPreferences']);
      }
    }
  );

  const handlePreferenceChange = (type: 'daily' | 'weekly' | 'monthly') => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const updatedPreferences = {
      ...preferences,
      [`${type}Analytics`]: event.target.checked
    };

    mutate(updatedPreferences);
  };

  const getReportDescription = (type: string): string => {
    switch (type) {
      case 'daily':
        return 'Sent every day at 6:00 AM UTC';
      case 'weekly':
        return 'Sent every Monday at 7:00 AM UTC';
      case 'monthly':
        return 'Sent on the 1st of each month at 8:00 AM UTC';
      default:
        return '';
    }
  };

  const getReportMetrics = (type: string): string => {
    const baseMetrics = 'Revenue, subscriptions, usage, and customer metrics';
    switch (type) {
      case 'daily':
        return `24-hour ${baseMetrics.toLowerCase()}`;
      case 'weekly':
        return `7-day ${baseMetrics.toLowerCase()} with week-over-week comparisons`;
      case 'monthly':
        return `30-day ${baseMetrics.toLowerCase()} with month-over-month trends`;
      default:
        return '';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Analytics Report Subscriptions
        </Typography>
        <Tooltip title="Configure which analytics reports you'd like to receive via email">
          <IconButton size="small" sx={{ ml: 1 }}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to update preferences. Please try again.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Daily Reports */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Daily Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {getReportDescription('daily')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {getReportMetrics('daily')}
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.dailyAnalytics}
                      onChange={handlePreferenceChange('daily')}
                      disabled={isLoading}
                    />
                  }
                  label={preferences.dailyAnalytics ? 'Subscribed' : 'Not subscribed'}
                />
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Weekly Reports */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Weekly Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {getReportDescription('weekly')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {getReportMetrics('weekly')}
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.weeklyAnalytics}
                      onChange={handlePreferenceChange('weekly')}
                      disabled={isLoading}
                    />
                  }
                  label={preferences.weeklyAnalytics ? 'Subscribed' : 'Not subscribed'}
                />
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Reports */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monthly Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {getReportDescription('monthly')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {getReportMetrics('monthly')}
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.monthlyAnalytics}
                      onChange={handlePreferenceChange('monthly')}
                      disabled={isLoading}
                    />
                  }
                  label={preferences.monthlyAnalytics ? 'Subscribed' : 'Not subscribed'}
                />
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          All reports are delivered in your timezone and include interactive charts and downloadable data.
          You can unsubscribe at any time through these settings or via the unsubscribe link in any report email.
        </Typography>
      </Box>
    </Box>
  );
};

export default EmailPreferences;
