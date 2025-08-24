import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush
} from 'recharts';
import { format } from 'date-fns';
import { Box, Typography, useTheme } from '@mui/material';

interface SubscriptionChartProps {
  data: {
    date: string;
    totalSubscriptions: number;
    activeSubscriptions: number;
    churnRate: number;
    mrr: number;
    arr: number;
  }[];
  loading?: boolean;
}

const SubscriptionChart: React.FC<SubscriptionChartProps> = ({ data, loading }) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading subscription data...</Typography>
      </Box>
    );
  }

  const formatXAxis = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d');
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 1
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {format(new Date(label), 'MMMM d, yyyy')}
          </Typography>
          {payload.map((entry: any) => (
            <Box key={entry.name} sx={{ my: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  color: entry.color,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2
                }}
              >
                <span>{entry.name}:</span>
                <strong>
                  {entry.name === 'Churn Rate'
                    ? formatPercentage(entry.value)
                    : entry.name.includes('MRR') || entry.name.includes('ARR')
                    ? formatCurrency(entry.value)
                    : formatNumber(entry.value)}
                </strong>
              </Typography>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  const renderYAxis = (position: 'left' | 'right', formatter: (value: number) => string) => (
    <YAxis
      yAxisId={position}
      orientation={position}
      tickFormatter={formatter}
      tick={{ fill: theme.palette.text.secondary }}
    />
  );

  return (
    <Box sx={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            tick={{ fill: theme.palette.text.secondary }}
          />
          {/* Subscriptions axis (left) */}
          {renderYAxis('left', formatNumber)}
          {/* Revenue axis (right) */}
          {renderYAxis('right', formatCurrency)}

          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Brush dataKey="date" height={30} stroke={theme.palette.primary.main} />

          {/* Subscription metrics */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="totalSubscriptions"
            name="Total Subscriptions"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="activeSubscriptions"
            name="Active Subscriptions"
            stroke={theme.palette.success.main}
            strokeWidth={2}
            dot={false}
          />

          {/* Revenue metrics */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="mrr"
            name="MRR"
            stroke={theme.palette.info.main}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="arr"
            name="ARR"
            stroke={theme.palette.warning.main}
            strokeWidth={2}
            dot={false}
            opacity={0.7}
          />

          {/* Churn rate - using a different pattern */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="churnRate"
            name="Churn Rate"
            stroke={theme.palette.error.main}
            strokeDasharray="5 5"
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default SubscriptionChart;
