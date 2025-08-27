import React, { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Typography,
  Box,
  TextField,
  Alert,
} from '@mui/material';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import axios from 'axios';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutFormProps {
  planId: string;
  isAnnual: boolean;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  planId,
  isAnnual,
  onSuccess,
  onError,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      // Create payment method
      const { error: cardError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
        billing_details: {
          email,
        },
      });

      if (cardError) {
        throw new Error(cardError.message);
      }

      // Start subscription
      const { data } = await axios.post('/api/billing/subscriptions', {
        paymentMethodId: paymentMethod.id,
        plan: planId,
        billingType: isAnnual ? 'yearly' : 'monthly',
        email,
      });

      if (data.requiresAction) {
        const { error: confirmError } = await stripe.confirmCardPayment(
          data.clientSecret
        );
        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      onSuccess();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading || !stripe}
          >
            {loading ? 'Processing...' : 'Subscribe Now'}
          </Button>
        </Grid>
      </Grid>
    </form>
  );
};

interface SubscriptionCheckoutProps {
  planId: string;
  planName: string;
  price: string;
  period: string;
  features: string[];
}

export default function SubscriptionCheckout({
  planId,
  planName,
  price,
  period,
  features,
}: SubscriptionCheckoutProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = () => {
    setSuccess(true);
    setError(null);
  };

  const handleError = (message: string) => {
    setError(message);
    setSuccess(false);
  };

  if (success) {
    return (
      <Container maxWidth="sm">
        <Alert severity="success" sx={{ mb: 3 }}>
          Thank you for your subscription! You can now access all {planName} features.
        </Alert>
        <Button variant="contained" color="primary" href="/dashboard" fullWidth>
          Go to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Subscribe to {planName}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 4 }}>
            <Typography variant="h3" component="div" gutterBottom>
              {price}
              <Typography
                variant="subtitle1"
                component="span"
                color="text.secondary"
              >
                /{period}
              </Typography>
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Button
                variant={isAnnual ? 'contained' : 'outlined'}
                onClick={() => setIsAnnual(!isAnnual)}
                fullWidth
              >
                {isAnnual
                  ? '🎉 Save with annual billing'
                  : 'Switch to annual billing (save 20%)'}
              </Button>
            </Box>

            <Elements stripe={stripePromise}>
              <CheckoutForm
                planId={planId}
                isAnnual={isAnnual}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            </Elements>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
