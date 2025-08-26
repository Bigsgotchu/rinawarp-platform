/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { doc, getDoc, updateDoc } from '@firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import {
  UserProfile,
  UserPreferences,
  NotificationPreferences,
  UsageMetrics,
} from '../types/profile';

export class ProfileService {
  private static instance: ProfileService;
  private currentProfile: UserProfile | null = null;

  private constructor() {}

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  public async getProfile(userId: string): Promise<UserProfile> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }

      this.currentProfile = userDoc.data() as UserProfile;
      return this.currentProfile;
    } catch (error) {
      logger.error('Failed to fetch user profile:', error);
      throw error;
    }
  }

  public async updateProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, updates);
      
      // Fetch and return updated profile
      return await this.getProfile(userId);
    } catch (error) {
      logger.error('Failed to update user profile:', error);
      throw error;
    }
  }

  public async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserProfile> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { preferences });
      
      return await this.getProfile(userId);
    } catch (error) {
      logger.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  public async updateNotifications(
    userId: string,
    notifications: Partial<NotificationPreferences>
  ): Promise<UserProfile> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { 'preferences.notifications': notifications });
      
      return await this.getProfile(userId);
    } catch (error) {
      logger.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  public async updateUsageMetrics(
    userId: string,
    metrics: Partial<UsageMetrics>
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { usage: metrics });
    } catch (error) {
      logger.error('Failed to update usage metrics:', error);
      throw error;
    }
  }

  public async incrementUsageMetrics(
    userId: string,
    metric: keyof UsageMetrics,
    increment: number = 1
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        [`usage.${metric}`]: increment
      });
    } catch (error) {
      logger.error('Failed to increment usage metrics:', error);
      throw error;
    }
  }

  public getCurrentProfile(): UserProfile | null {
    return this.currentProfile;
  }
}
