/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import axios from 'axios';
import { format } from 'date-fns';

/**
 * Fetch analytics report for a specified date range
 */
export const fetchAnalyticsReport = async (startDate: Date, endDate: Date) => {
  const response = await axios.get('/api/analytics/report', {
    params: {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd')
    }
  });
  return response.data;
};

/**
 * Fetch user's email subscription preferences
 */
export const fetchSubscriptionPreferences = async () => {
  const response = await axios.get('/api/analytics/subscriptions');
  return response.data;
};

/**
 * Update user's email subscription preferences
 */
export const updateSubscriptionPreferences = async (preferences: {
  dailyAnalytics: boolean;
  weeklyAnalytics: boolean;
  monthlyAnalytics: boolean;
}) => {
  const response = await axios.put('/api/analytics/subscriptions', preferences);
  return response.data;
};

/**
 * Fetch historical reports
 */
export const fetchHistoricalReports = async (
  startDate: Date,
  endDate: Date,
  type?: 'daily' | 'weekly' | 'monthly'
) => {
  const response = await axios.get('/api/analytics/reports/history', {
    params: {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
      type
    }
  });
  return response.data;
};

/**
 * Fetch plan-specific analytics
 */
export const fetchPlanAnalytics = async (
  plan: string,
  startDate: Date,
  endDate: Date
) => {
  const response = await axios.get(`/api/analytics/plans/${plan}`, {
    params: {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd')
    }
  });
  return response.data;
};

/**
 * Fetch usage trends
 */
export const fetchUsageTrends = async (
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month' = 'day'
) => {
  const response = await axios.get('/api/analytics/usage/trends', {
    params: {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
      interval
    }
  });
  return response.data;
};
