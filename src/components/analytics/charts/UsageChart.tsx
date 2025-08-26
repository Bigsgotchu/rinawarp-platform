import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Sector,
} from 'recharts';
import {
  Box,
  Typography,
  useTheme,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';

interface UsageChartProps {
  data: {
    timeData: {
      date: string;
      commands: {
        total: number;
        byPlan: Record<string, number>;
      };
      workflows: {
        total: number;
        byPlan: Record<string, number>;
      };
    }[];
    planData: {
      plan: string;
      commands: number;
      workflows: number;
      activeUsers: number;
      averagePerUser: number;
    }[];
  };
  loading?: boolean;
}

type ViewType = 'time' | 'plan';
type MetricType = 'commands' | 'workflows';

const UsageChart: React.FC<UsageChartProps> = ({ data, loading }) => {
  const theme = useTheme();
  const [view, setView] = useState<ViewType>('time');
  const [metric, setMetric] = useState<MetricType>('commands');
  const [activePieIndex, setActivePieIndex] = useState<number>(-1);

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading usage data...</Typography>
      </Box>
    );
  }

  const handleViewChange = (
    event: React.MouseEvent<HTMLElement>,
    newView: ViewType
  ) => {
    if (newView !== null) {
      setView(newView);
    }
  };

  const handleMetricChange = (
    event: React.MouseEvent<HTMLElement>,
    newMetric: MetricType
  ) => {
    if (newMetric !== null) {
      setMetric(newMetric);
    }
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
  ];

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
            boxShadow: 1,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {view === 'time'
              ? formatDistanceToNow(new Date(label), { addSuffix: true })
              : label}
          </Typography>
          {payload.map((entry: any) => (
            <Box key={entry.name} sx={{ my: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  color: entry.color,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <span>{entry.name}:</span>
                <strong>{formatNumber(entry.value)}</strong>
              </Typography>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  const renderActiveShape = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
      payload,
      value,
    } = props;

    return (
      <g>
        <text
          x={cx}
          y={cy - 5}
          dy={8}
          textAnchor="middle"
          fill={theme.palette.text.primary}
        >
          {payload.plan}
        </text>
        <text
          x={cx}
          y={cy + 15}
          dy={8}
          textAnchor="middle"
          fill={theme.palette.text.secondary}
        >
          {formatNumber(value)}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
      </g>
    );
  };

  const TimeSeriesChart = () => (
    <ResponsiveContainer>
      <BarChart
        data={data.timeData}
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
          tick={{ fill: theme.palette.text.secondary }}
          tickFormatter={date =>
            formatDistanceToNow(new Date(date), { addSuffix: true })
          }
        />
        <YAxis
          tick={{ fill: theme.palette.text.secondary }}
          tickFormatter={formatNumber}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar
          dataKey={`${metric}.total`}
          name={metric === 'commands' ? 'Total Commands' : 'Total Workflows'}
          fill={theme.palette.primary.main}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  const PlanDistributionChart = () => (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          activeIndex={activePieIndex}
          activeShape={renderActiveShape}
          data={data.planData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          dataKey={metric}
          onMouseEnter={(data, index) => setActivePieIndex(index)}
          onMouseLeave={() => setActivePieIndex(-1)}
        >
          {data.planData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );

  return (
    <Box sx={{ width: '100%', height: 500 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={handleViewChange}
          size="small"
        >
          <ToggleButton value="time">Time Series</ToggleButton>
          <ToggleButton value="plan">Plan Distribution</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          value={metric}
          exclusive
          onChange={handleMetricChange}
          size="small"
        >
          <ToggleButton value="commands">Commands</ToggleButton>
          <ToggleButton value="workflows">Workflows</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {view === 'time' ? <TimeSeriesChart /> : <PlanDistributionChart />}
    </Box>
  );
};

export default UsageChart;
