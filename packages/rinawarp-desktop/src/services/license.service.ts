/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { ipcRenderer } from 'electron';
import { logger } from '../utils/logger';
import { SecureConfigManager } from '../config/secure-config';

interface License {
  key: string;
  type: 'trial' | 'pro' | 'enterprise';
  expiresAt?: Date;
  features: string[];
  company?: string;
  email: string;
}

interface LicenseValidation {
  isValid: boolean;
  error?: string;
  license?: License;
}

export class LicenseService {
  private static instance: LicenseService;
  private currentLicense: License | null = null;
  private validationInterval: NodeJS.Timeout | null = null;
  private secureConfig: SecureConfigManager;

  private constructor() {
    this.secureConfig = SecureConfigManager.getInstance();
    this.startValidationLoop();
  }

  public static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService();
    }
    return LicenseService.instance;
  }

  private async startValidationLoop() {
    // Validate license on startup
    await this.validateLicense();

    // Set up periodic validation (every 24 hours)
    this.validationInterval = setInterval(() => {
      this.validateLicense().catch(logger.error);
    }, 24 * 60 * 60 * 1000);
  }

  private generateHardwareId(): string {
    // Request hardware-specific info from main process
    return ipcRenderer.invoke('license:get-hardware-id');
  }

  public async activateLicense(key: string, email: string): Promise<LicenseValidation> {
    try {
      const hardwareId = await this.generateHardwareId();
      
      // Call license activation API
      const response = await fetch('https://api.rinawarptechnologies.com/v1/license/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey: key,
          email,
          hardwareId,
        }),
      });

      if (!response.ok) {
        throw new Error('License activation failed');
      }

      const license = await response.json();
      
      // Store license securely
      await this.secureConfig.setLicense(license);
      this.currentLicense = license;

      return {
        isValid: true,
        license,
      };

    } catch (error) {
      logger.error('License activation failed:', error);
      return {
        isValid: false,
        error: (error as Error).message,
      };
    }
  }

  private async validateLicense(): Promise<LicenseValidation> {
    try {
      const storedLicense = await this.secureConfig.getLicense();
      if (!storedLicense) {
        return { isValid: false, error: 'No license found' };
      }

      const hardwareId = await this.generateHardwareId();
      
      // Validate with license server
      const response = await fetch('https://api.rinawarptechnologies.com/v1/license/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey: storedLicense.key,
          hardwareId,
        }),
      });

      if (!response.ok) {
        throw new Error('License validation failed');
      }

      const validation = await response.json();
      
      if (validation.isValid) {
        this.currentLicense = validation.license;
        return validation;
      } else {
        this.currentLicense = null;
        return {
          isValid: false,
          error: validation.error,
        };
      }

    } catch (error) {
      logger.error('License validation failed:', error);
      return {
        isValid: false,
        error: (error as Error).message,
      };
    }
  }

  public async deactivateLicense(): Promise<boolean> {
    try {
      if (!this.currentLicense) {
        return true;
      }

      const hardwareId = await this.generateHardwareId();
      
      // Call deactivation API
      const response = await fetch('https://api.rinawarptechnologies.com/v1/license/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey: this.currentLicense.key,
          hardwareId,
        }),
      });

      if (!response.ok) {
        throw new Error('License deactivation failed');
      }

      // Clear stored license
      await this.secureConfig.clearLicense();
      this.currentLicense = null;

      return true;

    } catch (error) {
      logger.error('License deactivation failed:', error);
      return false;
    }
  }

  public isFeatureEnabled(feature: string): boolean {
    if (!this.currentLicense) return false;
    return this.currentLicense.features.includes(feature);
  }

  public getLicenseType(): string | null {
    return this.currentLicense?.type || null;
  }

  public isLicenseExpired(): boolean {
    if (!this.currentLicense?.expiresAt) return false;
    return new Date(this.currentLicense.expiresAt) < new Date();
  }

  public async getLicenseStatus(): Promise<{
    isValid: boolean;
    type?: string;
    expiresAt?: Date;
    features?: string[];
    error?: string;
  }> {
    const validation = await this.validateLicense();
    
    if (!validation.isValid) {
      return {
        isValid: false,
        error: validation.error,
      };
    }

    return {
      isValid: true,
      type: validation.license?.type,
      expiresAt: validation.license?.expiresAt,
      features: validation.license?.features,
    };
  }
}
