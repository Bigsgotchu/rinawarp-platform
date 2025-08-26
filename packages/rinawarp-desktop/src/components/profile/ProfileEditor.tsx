/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import {
  Form,
  FormElement,
  Field,
  FieldWrapper,
} from '@progress/kendo-react-form';
import { Input } from '@progress/kendo-react-inputs';
import { DropDownList } from '@progress/kendo-react-dropdowns';
import { Switch } from '@progress/kendo-react-inputs';
import { Button } from '@progress/kendo-react-buttons';
import { Dialog } from '@progress/kendo-react-dialogs';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileService } from '../../services/profile.service';
import { UserProfile, UserPreferences } from '../../types/profile';

const fontFamilies = [
  'Menlo',
  'Monaco',
  'Consolas',
  'Source Code Pro',
  'Fira Code',
  'JetBrains Mono',
];

const terminalTypes = ['bash', 'zsh', 'fish', 'powershell'];

export const ProfileEditor: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileService = ProfileService.getInstance();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const profile = await profileService.getProfile(user.id);
      setProfile(profile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    if (!user || !profile) return;
    try {
      setLoading(true);
      setError(null);

      const preferences: Partial<UserPreferences> = {
        theme: formData.theme,
        fontSize: formData.fontSize,
        fontFamily: formData.fontFamily,
        terminalType: formData.terminalType,
        notifications: {
          emailNotifications: formData.emailNotifications,
          desktopNotifications: formData.desktopNotifications,
          updateNotifications: formData.updateNotifications,
          securityAlerts: formData.securityAlerts,
        },
      };

      const updates = {
        displayName: formData.displayName,
        preferences,
      };

      const updatedProfile = await profileService.updateProfile(user.id, updates);
      setProfile(updatedProfile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!profile) {
    return <div>No profile found</div>;
  }

  return (
    <Dialog title="Profile Settings" width={600}>
      <Form
        onSubmit={handleSubmit}
        initialValues={{
          displayName: profile.displayName,
          theme: profile.preferences.theme,
          fontSize: profile.preferences.fontSize,
          fontFamily: profile.preferences.fontFamily,
          terminalType: profile.preferences.terminalType,
          emailNotifications: profile.preferences.notifications.emailNotifications,
          desktopNotifications: profile.preferences.notifications.desktopNotifications,
          updateNotifications: profile.preferences.notifications.updateNotifications,
          securityAlerts: profile.preferences.notifications.securityAlerts,
        }}
        render={(formRenderProps) => (
          <FormElement>
            <fieldset>
              <legend>General</legend>
              <Field
                name="displayName"
                component={Input}
                label="Display Name"
              />
              <Field
                name="theme"
                component={DropDownList}
                label="Theme"
                data={['light', 'dark', 'system']}
              />
            </fieldset>

            <fieldset>
              <legend>Terminal Preferences</legend>
              <Field
                name="fontSize"
                component={Input}
                type="number"
                label="Font Size"
                min={8}
                max={32}
              />
              <Field
                name="fontFamily"
                component={DropDownList}
                label="Font Family"
                data={fontFamilies}
              />
              <Field
                name="terminalType"
                component={DropDownList}
                label="Default Shell"
                data={terminalTypes}
              />
            </fieldset>

            <fieldset>
              <legend>Notifications</legend>
              <FieldWrapper>
                <Field
                  name="emailNotifications"
                  component={Switch}
                  label="Email Notifications"
                />
              </FieldWrapper>
              <FieldWrapper>
                <Field
                  name="desktopNotifications"
                  component={Switch}
                  label="Desktop Notifications"
                />
              </FieldWrapper>
              <FieldWrapper>
                <Field
                  name="updateNotifications"
                  component={Switch}
                  label="Update Notifications"
                />
              </FieldWrapper>
              <FieldWrapper>
                <Field
                  name="securityAlerts"
                  component={Switch}
                  label="Security Alerts"
                />
              </FieldWrapper>
            </fieldset>

            {error && (
              <div className="k-messagebox k-messagebox-error">
                {error}
              </div>
            )}

            <div className="k-form-buttons">
              <Button
                type="submit"
                themeColor="primary"
                disabled={!formRenderProps.allowSubmit}
              >
                Save Changes
              </Button>
              <Button type="reset" onClick={formRenderProps.onFormReset}>
                Reset
              </Button>
            </div>
          </FormElement>
        )}
      />
    </Dialog>
  );
};
