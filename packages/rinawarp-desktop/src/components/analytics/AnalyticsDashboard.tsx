/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import {
  Chart,
  ChartSeries,
  ChartSeriesItem,
  ChartCategoryAxis,
  ChartCategoryAxisItem,
  ChartTooltip,
} from '@progress/kendo-react-charts';
import { Grid } from '@progress/kendo-react-grid';
import { DropDownList } from '@progress/kendo-react-dropdowns';
import { Button } from '@progress/kendo-react-buttons';
import { DateRangePicker } from '@progress/kendo-react-dateinputs';
import { Card } from '@progress/kendo-react-layout';
import { useAuth } from '../../contexts/AuthContext';
import { AnalyticsService } from '../../services/analytics.service';
import { AnalyticsReport, AnalyticsTimeframe } from '../../types/analytics';

const timeframeOptions = [
  { text: 'Last 24 Hours', value: 'day' },
  { text: 'Last Week', value: 'week' },
  { text: 'Last Month', value: 'month' },
];

export const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
    interval: 'day',
  });
  const [loading, setLoading] = useState(true);
  const analyticsService = AnalyticsService.getInstance();

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, timeframe]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const report = await analyticsService.getAnalytics(user!.id, timeframe);
      setReport(report);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = (event: any) => {
    const now = new Date();
    let start: Date;

    switch (event.value) {
      case 'day':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    setTimeframe({
      start,
      end: now,
      interval: event.value,
    });
  };

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  if (!report) {
    return <div>No analytics data available</div>;
  }

  return (
    <div className="analytics-dashboard">
      {/* Controls */}
      <div className="dashboard-controls">
        <DropDownList
          data={timeframeOptions}
          textField="text"
          valueField="value"
          value={timeframe.interval}
          onChange={handleTimeframeChange}
        />
        <DateRangePicker
          value={[timeframe.start, timeframe.end]}
          onChange={(e) => {
            if (e.value[0] && e.value[1]) {
              setTimeframe({
                ...timeframe,
                start: e.value[0],
                end: e.value[1],
              });
            }
          }}
        />
        <Button onClick={loadAnalytics}>Refresh</Button>
      </div>

      {/* Summary Cards */}
      <div className="metrics-summary">
        <Card>
          <div className="card-content">
            <h3>Commands</h3>
            <div className="metric">{report.data.commands.totalCommands}</div>
            <div className="trend">
              {report.trends.commandGrowth > 0 ? '+' : ''}
              {report.trends.commandGrowth.toFixed(1)}%
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-content">
            <h3>AI Usage</h3>
            <div className="metric">{report.data.aiUsage.totalRequests}</div>
            <div className="trend">
              {report.trends.aiUsageGrowth > 0 ? '+' : ''}
              {report.trends.aiUsageGrowth.toFixed(1)}%
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-content">
            <h3>Voice Commands</h3>
            <div className="metric">{report.data.voice.totalVoiceCommands}</div>
            <div className="subtitle">
              {report.data.voice.recognitionAccuracy.toFixed(1)}% accuracy
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-content">
            <h3>Active Sessions</h3>
            <div className="metric">{report.data.sessions.totalSessions}</div>
            <div className="subtitle">
              {report.data.sessions.averageSessionDuration / 60000} min avg
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="charts-section">
        <Card>
          <h3>Command Usage by Mode</h3>
          <Chart>
            <ChartSeries>
              <ChartSeriesItem
                type="column"
                data={[
                  report.data.sessions.sessionsByMode.agent,
                  report.data.sessions.sessionsByMode.regular,
                  report.data.sessions.sessionsByMode.voice,
                ]}
                name="Commands"
                color={['#FF6B6B', '#4ECDC4', '#45B7D1']}
              />
            </ChartSeries>
            <ChartCategoryAxis>
              <ChartCategoryAxisItem
                categories={['Agent Mode', 'Regular Mode', 'Voice Mode']}
              />
            </ChartCategoryAxis>
            <ChartTooltip visible={true} />
          </Chart>
        </Card>

        <Card>
          <h3>Most Used Commands</h3>
          <Grid
            data={Object.entries(report.data.commands.mostUsedCommands)
              .map(([command, count]) => ({ command, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10)}
          >
            <Grid.Column field="command" title="Command" />
            <Grid.Column field="count" title="Usage Count" />
          </Grid>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <h3>Performance Metrics</h3>
        <div className="performance-metrics">
          <div className="metric-item">
            <label>Response Latency</label>
            <div className="value">
              {report.data.performance.responseLatency.toFixed(2)}ms
            </div>
          </div>
          <div className="metric-item">
            <label>Error Rate</label>
            <div className="value">
              {report.data.performance.errorRate.toFixed(2)}%
            </div>
          </div>
          <div className="metric-item">
            <label>Success Rate</label>
            <div className="value">
              {report.data.commands.successRate.toFixed(2)}%
            </div>
          </div>
        </div>
      </Card>

      {/* Usage History */}
      <Card>
        <h3>Command History</h3>
        <Grid
          data={report.data.commands.commandHistory.slice(-50)}
          sortable={true}
          filterable={true}
          pageable={true}
        >
          <Grid.Column field="timestamp" title="Time" />
          <Grid.Column field="command" title="Command" />
          <Grid.Column field="mode" title="Mode" />
          <Grid.Column field="duration" title="Duration (ms)" />
          <Grid.Column field="exitCode" title="Exit Code" />
        </Grid>
      </Card>
    </div>
  );
};
