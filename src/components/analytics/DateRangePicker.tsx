import React, { useState } from 'react';
import {
  Button,
  ButtonGroup,
  Box,
  Popover,
  TextField,
  Stack,
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (range: { startDate: Date; endDate: Date }) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [tempStartDate, setTempStartDate] = useState<Date>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date>(endDate);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApply = () => {
    onChange({
      startDate: startOfDay(tempStartDate),
      endDate: endOfDay(tempEndDate)
    });
    handleClose();
  };

  const handleQuickSelect = (days: number) => {
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, days));
    onChange({ startDate: start, endDate: end });
  };

  const open = Boolean(anchorEl);
  const id = open ? 'date-range-popover' : undefined;

  return (
    <Box>
      <Button
        aria-describedby={id}
        onClick={handleClick}
        variant="outlined"
        startIcon={<CalendarIcon />}
      >
        {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
      </Button>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* Quick select buttons */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Quick Select
              </Typography>
              <ButtonGroup size="small" fullWidth>
                <Button onClick={() => handleQuickSelect(7)}>Last 7 Days</Button>
                <Button onClick={() => handleQuickSelect(30)}>Last 30 Days</Button>
                <Button onClick={() => handleQuickSelect(90)}>Last 90 Days</Button>
              </ButtonGroup>
            </Box>

            {/* Custom date range */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Custom Range
              </Typography>
              <Stack direction="row" spacing={2}>
                <DatePicker
                  label="Start Date"
                  value={tempStartDate}
                  onChange={(date) => date && setTempStartDate(date)}
                  maxDate={tempEndDate}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true
                    }
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={tempEndDate}
                  onChange={(date) => date && setTempEndDate(date)}
                  minDate={tempStartDate}
                  maxDate={new Date()}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true
                    }
                  }}
                />
              </Stack>
            </Box>

            {/* Apply button */}
            <Button
              variant="contained"
              onClick={handleApply}
              fullWidth
            >
              Apply Range
            </Button>
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
};

export default DateRangePicker;
