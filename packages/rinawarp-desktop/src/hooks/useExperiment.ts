import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ExperimentVariant {
  id: string;
  name: string;
  config: Record<string, any>;
}

interface ExperimentOptions {
  defaultVariant?: string;
  context?: Record<string, any>;
}

export function useExperiment(
  experimentId: string,
  options: ExperimentOptions = {}
): {
  variant: ExperimentVariant | null;
  loading: boolean;
  error: Error | null;
  trackEvent: (eventType: string, eventData?: Record<string, any>) => Promise<void>;
} {
  const [variant, setVariant] = useState<ExperimentVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchVariant = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/experiments/${experimentId}/variant`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            context: {
              ...options.context,
              userId: user.id,
              userGroups: user.groups,
              environment: process.env.NODE_ENV
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch experiment variant');
        }

        const data = await response.json();
        setVariant(data.variant || null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        // Fall back to default variant if specified
        if (options.defaultVariant) {
          setVariant({
            id: 'default',
            name: options.defaultVariant,
            config: {}
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchVariant();
  }, [experimentId, user, options.context, options.defaultVariant]);

  const trackEvent = async (eventType: string, eventData: Record<string, any> = {}) => {
    if (!user || !variant) {
      return;
    }

    try {
      await fetch(`/api/experiments/${experimentId}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          variantId: variant.id,
          eventType,
          eventData
        })
      });
    } catch (error) {
      console.error('Failed to track experiment event:', error);
    }
  };

  return { variant, loading, error, trackEvent };
}

// Example usage:
/*
function MyComponent() {
  const { variant, loading, trackEvent } = useExperiment('new-feature-test', {
    defaultVariant: 'control',
    context: {
      userType: 'premium'
    }
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  const handleClick = () => {
    // Track a conversion event
    trackEvent('button_click', { buttonType: 'primary' });
  };

  return (
    <div>
      {variant?.name === 'treatment' ? (
        <button 
          onClick={handleClick}
          style={variant.config.buttonStyle}
        >
          {variant.config.buttonText}
        </button>
      ) : (
        <button onClick={handleClick}>
          Default Button
        </button>
      )}
    </div>
  );
}
*/
