import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Container,
  Grid,
  Typography,
  useTheme,
  Switch,
  FormControlLabel,
  Tooltip,
  Chip,
  Skeleton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import { PricingTier, PriceOption } from '../../types/pricing';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(3),
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
  },
  '&.popular': {
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
    borderStyle: 'solid',
  },
}));

const FeatureItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(1),
  '& .MuiSvgIcon-root': {
    marginRight: theme.spacing(1),
  },
}));

const BillingToggle = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(4),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
}));

interface PriceDisplayProps {
  option: PriceOption;
  interval: 'monthly' | 'yearly';
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({ option, interval }) => {
  const theme = useTheme();
  const isYearly = interval === 'yearly';
  const price = isYearly ? option.price * 10 : option.price; // 2 months free for yearly

  return (
    <Box>
      <Typography variant="h3" component="span">
        ${price}
      </Typography>
      <Typography variant="subtitle1" component="span" color="text.secondary">
        /{interval === 'monthly' ? 'mo' : 'yr'}
      </Typography>
      {isYearly && option.savings && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: theme.palette.success.main,
            marginTop: 1,
          }}
        >
          Save ${option.savings}/year
        </Typography>
      )}
    </Box>
  );
};

export const EnhancedPricingPage: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { currentSubscription, isLoading: subscriptionLoading } = useSubscription();
  const [isYearly, setIsYearly] = useState(false);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPricingTiers = async () => {
      try {
        const response = await fetch('/api/subscription/tiers');
        const data = await response.json();
        setTiers(data);
      } catch (error) {
        console.error('Failed to fetch pricing tiers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPricingTiers();
  }, []);

  const handleBillingToggle = () => {
    setIsYearly(!isYearly);
  };

  const handleSelectPlan = async (tier: PricingTier) => {
    if (!user) {
      // Redirect to sign up
      window.location.href = `/signup?plan=${tier.id}`;
      return;
    }

    if (currentSubscription) {
      // Redirect to subscription management
      window.location.href = `/account/subscription?upgrade=${tier.id}`;
      return;
    }

    // Redirect to checkout
    window.location.href = `/checkout?plan=${tier.id}&billing=${isYearly ? 'yearly' : 'monthly'}`;
  };

  if (loading || subscriptionLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Grid container spacing={4}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} md={4} key={i}>
              <Skeleton variant="rectangular" height={600} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h2" align="center" gutterBottom>
        Choose Your Plan
      </Typography>
      <Typography variant="h6" align="center" color="text.secondary" paragraph>
        Start building with RinaWarp Terminal today
      </Typography>

      <BillingToggle>
        <FormControlLabel
          control={
            <Switch
              checked={isYearly}
              onChange={handleBillingToggle}
              color="primary"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              Annual billing
              {isYearly && (
                <Chip
                  label="Save 20%"
                  color="success"
                  size="small"
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
          }
        />
      </BillingToggle>

      <Grid container spacing={4}>
        {tiers.map((tier) => (
          <Grid item xs={12} md={4} key={tier.id}>
            <StyledCard className={tier.isPopular ? 'popular' : ''}>
              {tier.isPopular && (
                <Chip
                  label="Most Popular"
                  color="primary"
                  sx={{
                    position: 'absolute',
                    top: -16,
                    right: 16,
                  }}
                />
              )}

              <Typography variant="h4" gutterBottom>
                {tier.name}
              </Typography>

              <Typography color="text.secondary" paragraph>
                {tier.description}
              </Typography>

              <PriceDisplay
                option={{
                  price: tier.price,
                  currency: tier.currency,
                  interval: tier.interval,
                  stripePriceId: tier.stripePriceId,
                  savings: isYearly ? tier.price * 2 : undefined,
                }}
                interval={isYearly ? 'yearly' : 'monthly'}
              />

              <Box sx={{ mt: 3, mb: 4 }}>
                {tier.features.map((feature, index) => (
                  <FeatureItem key={index}>
                    {feature.included ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <CancelIcon color="error" />
                    )}
                    <Typography>
                      {feature.name}
                      {feature.limit && ` - ${feature.limit}`}
                    </Typography>
                    {feature.description && (
                      <Tooltip title={feature.description}>
                        <InfoIcon
                          sx={{ ml: 1, fontSize: 16, color: 'action.disabled' }}
                        />
                      </Tooltip>
                    )}
                  </FeatureItem>
                ))}
              </Box>

              <Box sx={{ mt: 'auto' }}>
                <Button
                  variant={tier.isPopular ? 'contained' : 'outlined'}
                  color="primary"
                  size="large"
                  fullWidth
                  onClick={() => handleSelectPlan(tier)}
                >
                  {currentSubscription?.currentPlan === tier.id
                    ? 'Current Plan'
                    : 'Select Plan'}
                </Button>
              </Box>
            </StyledCard>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Need a custom plan?
        </Typography>
        <Typography color="text.secondary" paragraph>
          Contact us for enterprise pricing and custom features.
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          size="large"
          href="/contact"
          sx={{ mt: 2 }}
        >
          Contact Sales
        </Button>
      </Box>
    </Container>
  );
};
