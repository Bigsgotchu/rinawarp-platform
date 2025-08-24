import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { Box, Typography, useTheme } from '@mui/material';
import { formatCurrency } from '../../../utils/format';

interface RevenueChartProps {
  data: {
    date: string;
    totalRevenue: number;
    recurringRevenue: number;
    oneTimeRevenue: number;
    refunds: number;
    netRevenue: number;
  }[];
  loading?: boolean;
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data, loading }) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading revenue data...</Typography>
      </Box>
    );
  }

  const formatXAxis = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d');
  };

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value);
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
                <strong>{formatCurrency(entry.value)}</strong>
              </Typography>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <ComposedChart
          data={data}
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            tick={{ fill: theme.palette.text.secondary }}
          />
          <YAxis
            tickFormatter={formatTooltipValue}
            tick={{ fill: theme.palette.text.secondary }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Net Revenue Line */}
          <Line
            type="monotone"
            dataKey="netRevenue"
            name="Net Revenue"
            stroke={theme.palette.success.main}
            strokeWidth={2}
            dot={false}
          />

          {/* Recurring Revenue Bar */}
          <Bar
            dataKey="recurringRevenue"
            name="Recurring Revenue"
            fill={theme.palette.primary.main}
            opacity={0.8}
          />

          {/* One-time Revenue Bar */}
          <Bar
            dataKey="oneTimeRevenue"
            name="One-time Revenue"
            fill={theme.palette.info.main}
            opacity={0.8}
          />

          {/* Refunds Area */}
          <Area
            type="monotone"
            dataKey="refunds"
            name="Refunds"
            fill={theme.palette.error.main}
            stroke={theme.palette.error.dark}
            opacity={0.1}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RevenueChart;
