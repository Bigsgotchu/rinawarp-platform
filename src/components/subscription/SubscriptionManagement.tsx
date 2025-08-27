import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSubscription } from '../../hooks/useSubscription';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  '& .MuiCardContent-root': {
    flexGrow: 1,
  },
}));

const StatusChip = styled(Box)(({ theme, status }: { theme: any; status: string }) => {
  const getColor = () => {
    switch (status.toLowerCase()) {
      case 'active':
        return theme.palette.success.main;
      case 'past_due':
        return theme.palette.warning.main;
      case 'canceled':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return {
    display: 'inline-block',
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: getColor(),
    color: theme.palette.common.white,
    fontWeight: 500,
    fontSize: '0.875rem',
  };
});

export const SubscriptionManagement: React.FC = () => {
  const {
    currentSubscription,
    isLoading,
    error,
    cancelSubscription,
    createCustomerPortalSession,
  } = useSubscription();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!currentSubscription) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="h6" gutterBottom>
          No Active Subscription
        </Typography>
        <Button
          variant="contained"
          color="primary"
          href="/pricing"
          sx={{ mt: 2 }}
        >
          View Plans
        </Button>
      </Box>
    );
  }

  const handleCancelSubscription = async () => {
    setProcessing(true);
    try {
      await cancelSubscription(cancelImmediately);
      setCancelDialogOpen(false);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={8}>
        <StyledCard>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5">Subscription Details</Typography>
              <StatusChip status={currentSubscription.status}>
                {currentSubscription.status}
              </StatusChip>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography color="text.secondary">Current Plan</Typography>
                <Typography variant="h6">{currentSubscription.currentPlan}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography color="text.secondary">Billing Period Ends</Typography>
                <Typography variant="h6">
                  {formatDate(currentSubscription.currentPeriodEnd)}
                </Typography>
              </Grid>

              {currentSubscription.cancelAtPeriodEnd && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    Your subscription will be canceled on{' '}
                    {formatDate(currentSubscription.currentPeriodEnd)}
                  </Alert>
                </Grid>
              )}
            </Grid>

            <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={createCustomerPortalSession}
              >
                Manage Billing
              </Button>
              {!currentSubscription.cancelAtPeriodEnd && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Cancel Subscription
                </Button>
              )}
            </Box>
          </CardContent>
        </StyledCard>
      </Grid>

      <Grid item xs={12} md={4}>
        <StyledCard>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Need Help?
            </Typography>
            <Typography paragraph>
              Have questions about your subscription or need assistance?
              Our support team is here to help.
            </Typography>
            <Button variant="outlined" color="primary" href="/support">
              Contact Support
            </Button>
          </CardContent>
        </StyledCard>
      </Grid>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel your subscription?
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <Button
              variant={cancelImmediately ? 'contained' : 'outlined'}
              color="primary"
              onClick={() => setCancelImmediately(false)}
              sx={{ mr: 1 }}
            >
              Cancel at Period End
            </Button>
            <Button
              variant={!cancelImmediately ? 'contained' : 'outlined'}
              color="error"
              onClick={() => setCancelImmediately(true)}
            >
              Cancel Immediately
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCancelDialogOpen(false)}
            disabled={processing}
          >
            Keep Subscription
          </Button>
          <Button
            onClick={handleCancelSubscription}
            color="error"
            disabled={processing}
          >
            {processing ? <CircularProgress size={24} /> : 'Confirm Cancellation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};
