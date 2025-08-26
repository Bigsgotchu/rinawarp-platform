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

interface RegisterFormProps {
  onSuccess?: () => void;
  onLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onLogin,
}) => {
  const { register } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: {
    email: string;
    password: string;
    displayName: string;
  }) => {
    try {
      setError(null);
      await register(data);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const passwordValidator = (value: string) => {
    if (value.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(value)) {
      return 'Password must contain at least one number';
    }
    return '';
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
              name="displayName"
              label="Display Name"
              required
              validationMessage="Please enter your name"
            />
          </div>

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
              validator={passwordValidator}
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
              Register
            </Button>
            {onLogin && (
              <Button
                type="button"
                fillMode="flat"
                onClick={() => onLogin()}
              >
                Already have an account? Login
              </Button>
            )}
          </div>
        </FormElement>
      )}
    />
  );
};
