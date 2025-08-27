import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      verifySubscription();
    } else {
      setError('No session ID found');
      setLoading(false);
    }
  }, [sessionId]);

  const verifySubscription = async () => {
    try {
      const response = await fetch('/api/checkout/verify-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify subscription');
      }

      setLoading(false);
      // Automatically redirect after 5 seconds
      setTimeout(() => {
        navigate('/subscription');
      }, 5000);
    } catch (err) {
      setError('Failed to verify subscription status');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="subscription-success loading">
        <div className="spinner"></div>
        <p>Confirming your subscription...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-success error">
        <h1>Oops!</h1>
        <p>{error}</p>
        <button onClick={() => navigate('/subscription')}>
          Return to Subscriptions
        </button>
      </div>
    );
  }

  return (
    <div className="subscription-success">
      <div className="success-content">
        <div className="checkmark">✓</div>
        <h1>Thank You!</h1>
        <p>Your subscription has been activated successfully.</p>
        <p className="redirect-notice">
          You will be redirected to your subscription dashboard in 5 seconds...
        </p>
        <button onClick={() => navigate('/subscription')}>
          Go to Dashboard Now
        </button>
      </div>

      <style jsx>{`
        .subscription-success {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
        }

        .success-content {
          background: white;
          padding: 3rem;
          border-radius: 1rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                     0 2px 4px -1px rgba(0, 0, 0, 0.06);
          max-width: 500px;
          width: 100%;
        }

        .checkmark {
          font-size: 4rem;
          color: #10B981;
          margin-bottom: 1rem;
        }

        h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
        }

        .redirect-notice {
          color: #6B7280;
          margin: 2rem 0;
        }

        button {
          background-color: #4F46E5;
          color: white;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        button:hover {
          background-color: #4338CA;
        }

        .loading {
          text-align: center;
        }

        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #4F46E5;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error h1 {
          color: #DC2626;
        }
      `}</style>
    </div>
  );
}
