import React, { useState } from 'react';
import { PricingPlan, pricingPlans } from '../../data/pricing';
import { Button, Card, Container, Grid, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(3),
  '&.popular': {
    border: `2px solid ${theme.palette.primary.main}`,
    position: 'relative',
    '&::before': {
      content: '"Most Popular"',
      position: 'absolute',
      top: '-12px',
      right: '24px',
      background: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '0.875rem',
    },
  },
}));

const FeatureList = styled('ul')(({ theme }) => ({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  marginTop: theme.spacing(2),
  '& li': {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
    '& svg': {
      color: theme.palette.success.main,
      marginRight: theme.spacing(1),
    },
  },
}));

const BillingToggle = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(4),
  gap: theme.spacing(2),
}));

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);

  const handleBillingChange = () => {
    setIsAnnual(!isAnnual);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h2" align="center" gutterBottom>
        Choose Your Plan
      </Typography>
      <Typography variant="h6" align="center" color="text.secondary" paragraph>
        Get started with RinaWarp Terminal today
      </Typography>

      <BillingToggle>
        <Typography
          color={!isAnnual ? 'primary' : 'text.secondary'}
          variant="subtitle1"
        >
          Monthly
        </Typography>
        <Button
          variant={isAnnual ? 'contained' : 'outlined'}
          onClick={handleBillingChange}
        >
          Save with annual billing
        </Button>
        <Typography
          color={isAnnual ? 'primary' : 'text.secondary'}
          variant="subtitle1"
        >
          Annually
        </Typography>
      </BillingToggle>

      <Grid container spacing={4}>
        {pricingPlans.map((plan: PricingPlan) => (
          <Grid item xs={12} md={4} key={plan.id}>
            <StyledCard className={plan.isPopular ? 'popular' : ''}>
              <Typography variant="h4" component="h3" gutterBottom>
                {plan.name}
              </Typography>
              <Typography variant="h3" component="div" gutterBottom>
                {plan.price}
                <Typography
                  variant="subtitle1"
                  component="span"
                  color="text.secondary"
                >
                  /{plan.period}
                </Typography>
              </Typography>
              <Typography color="text.secondary" paragraph>
                {plan.description}
              </Typography>
              <FeatureList>
                {plan.features.map((feature, index) => (
                  <li key={index}>
                    <CheckIcon />
                    {feature}
                  </li>
                ))}
              </FeatureList>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant={plan.isPopular ? 'contained' : 'outlined'}
                color="primary"
                size="large"
                fullWidth
                href={plan.ctaLink}
                sx={{ mt: 3 }}
              >
                {plan.ctaText}
              </Button>
            </StyledCard>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
