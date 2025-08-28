import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface FeatureFlagOptions {
  defaultValue?: boolean;
  refreshInterval?: number;
}

export function useFeatureFlag(
  featureName: string,
  options: FeatureFlagOptions = {}
): boolean {
  const { defaultValue = false, refreshInterval = 60000 } = options;
  const [isEnabled, setIsEnabled] = useState(defaultValue);
  const { user } = useAuth();

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkFeatureFlag = async () => {
      try {
        const response = await fetch(`/api/feature-flags/${featureName}`, {
          headers: {
            'Authorization': `Bearer ${user?.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch feature flag status');
          return;
        }

        const { enabled } = await response.json();
        setIsEnabled(enabled);
      } catch (error) {
        console.error('Error checking feature flag:', error);
      }
    };

    // Check immediately
    checkFeatureFlag();

    // Set up interval if specified
    if (refreshInterval > 0) {
      interval = setInterval(checkFeatureFlag, refreshInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [featureName, user, refreshInterval]);

  return isEnabled;
}

// Example usage:
// const isNewFeatureEnabled = useFeatureFlag('new-feature', { defaultValue: false });
// if (isNewFeatureEnabled) {
//   return <NewFeature />;
// }
