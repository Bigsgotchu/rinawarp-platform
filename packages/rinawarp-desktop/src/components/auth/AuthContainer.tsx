/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useState } from 'react';
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs';
import { Button } from '@progress/kendo-react-buttons';
import { Input } from '@progress/kendo-react-inputs';
import { Loader } from '@progress/kendo-react-indicators';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { useAuth } from '../../contexts/AuthContext';

type AuthView = 'login' | 'register' | 'forgot-password';

interface AuthContainerProps {
  onAuthSuccess?: () => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({ onAuthSuccess }) => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const { resetPassword, loading, error } = useAuth();

  const handleAuthSuccess = () => {
    onAuthSuccess?.();
  };

  const handleForgotPassword = async () => {
    if (!email) return;
    try {
      await resetPassword(email);
      // Show success message and return to login
      alert('Password reset email has been sent. Please check your inbox.');
      setView('login');
    } catch (err) {
      // Error is handled by the auth context
    }
  };

  const renderView = () => {
    switch (view) {
      case 'login':
        return (
          <Dialog title="Login to RinaWarp" width={500}>
            <LoginForm
              onSuccess={handleAuthSuccess}
              onForgotPassword={() => setView('forgot-password')}
            />
            <DialogActionsBar>
              <div style={{ textAlign: 'center', width: '100%' }}>
                Don't have an account?{' '}
                <Button
                  look="flat"
                  onClick={() => setView('register')}
                >
                  Register now
                </Button>
              </div>
            </DialogActionsBar>
          </Dialog>
        );

      case 'register':
        return (
          <Dialog title="Create your RinaWarp Account" width={500}>
            <RegisterForm
              onSuccess={handleAuthSuccess}
              onLogin={() => setView('login')}
            />
          </Dialog>
        );

      case 'forgot-password':
        return (
          <Dialog title="Reset Password" width={500}>
            <div style={{ padding: '20px' }}>
              <p>
                Enter your email address and we'll send you instructions to reset your
                password.
              </p>
              <div style={{ marginTop: '20px' }}>
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.value)}
                  required
                />
              </div>
              {error && (
                <div className="k-messagebox k-messagebox-error" style={{ marginTop: '10px' }}>
                  {error}
                </div>
              )}
              <DialogActionsBar>
                <Button
                  themeColor="primary"
                  onClick={handleForgotPassword}
                  disabled={!email || loading}
                >
                  {loading ? <Loader size="small" /> : 'Send Reset Instructions'}
                </Button>
                <Button look="flat" onClick={() => setView('login')}>
                  Back to Login
                </Button>
              </DialogActionsBar>
            </div>
          </Dialog>
        );
    }
  };

  return (
    <div className="auth-container" style={{ padding: '20px' }}>
      {loading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <Loader size="large" type="infinite-spinner" />
        </div>
      )}
      {renderView()}
    </div>
  );
};

// Create a Higher Order Component for protected routes
export const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Loader size="large" type="infinite-spinner" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return <AuthContainer />;
    }

    return <WrappedComponent {...props} />;
  };
};
