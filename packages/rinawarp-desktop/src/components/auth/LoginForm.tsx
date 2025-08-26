/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useState } from 'react';
import { Form, FormElement } from '@progress/kendo-react-form';
import { Input } from '@progress/kendo-react-inputs';
import { Button } from '@progress/kendo-react-buttons';
import { useAuth } from '../../contexts/AuthContext';

interface LoginFormProps {
  onSuccess?: () => void;
  onForgotPassword?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onForgotPassword,
}) => {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: { email: string; password: string }) => {
    try {
      setError(null);
      await login(data);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Form
      onSubmit={handleSubmit}
      render={(formRenderProps) => (
        <FormElement
          style={{
            maxWidth: '400px',
            margin: 'auto',
          }}
        >
          <div className="k-form-field">
            <Input
              name="email"
              label="Email"
              type="email"
              required
              validationMessage="Please enter a valid email"
            />
          </div>

          <div className="k-form-field">
            <Input
              name="password"
              label="Password"
              type="password"
              required
              validationMessage="Please enter your password"
            />
          </div>

          {error && (
            <div className="k-form-field">
              <div className="k-messagebox k-messagebox-error">
                {error}
              </div>
            </div>
          )}

          <div className="k-form-buttons">
            <Button
              type="submit"
              themeColor="primary"
              disabled={!formRenderProps.allowSubmit}
            >
              Login
            </Button>
            {onForgotPassword && (
              <Button
                type="button"
                fillMode="flat"
                onClick={() => onForgotPassword()}
              >
                Forgot Password?
              </Button>
            )}
          </div>
        </FormElement>
      )}
    />
  );
};
