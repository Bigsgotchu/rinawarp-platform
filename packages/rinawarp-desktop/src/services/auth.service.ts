/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from '@firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from '@firebase/firestore';
import jwt from 'jsonwebtoken';
import { auth, db } from '../config/firebase';
import { logger } from '../utils/logger';
import {
  User,
  ApiKey,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
} from '../types/auth';

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private token: string | null = null;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );

      const token = await userCredential.user.getIdToken();
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      const userData = userDoc.data() as User;

      // Update last login
      await updateDoc(doc(db, 'users', userCredential.user.uid), {
        lastLogin: new Date(),
      });

      this.currentUser = userData;
      this.token = token;

      return {
        user: userData,
        token,
        refreshToken: userCredential.user.refreshToken,
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  public async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );

      if (credentials.displayName) {
        await updateProfile(userCredential.user, {
          displayName: credentials.displayName,
        });
      }

      await sendEmailVerification(userCredential.user);

      const token = await userCredential.user.getIdToken();
      const userData: User = {
        id: userCredential.user.uid,
        email: credentials.email,
        displayName: credentials.displayName,
        createdAt: new Date(),
        lastLogin: new Date(),
        subscription: {
          status: 'active',
          plan: 'free',
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        },
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);

      this.currentUser = userData;
      this.token = token;

      return {
        user: userData,
        token,
        refreshToken: userCredential.user.refreshToken,
      };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.token = null;
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  public async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  public async createApiKey(name: string, scopes: string[]): Promise<ApiKey> {
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      const apiKey: ApiKey = {
        id: crypto.randomUUID(),
        name,
        key: jwt.sign(
          {
            userId: this.currentUser.id,
            scopes,
          },
          process.env.JWT_SECRET!,
          { expiresIn: '1y' }
        ),
        createdAt: new Date(),
        scopes,
      };

      const userRef = doc(db, 'users', this.currentUser.id);
      await updateDoc(userRef, {
        apiKeys: [...(this.currentUser.apiKeys || []), apiKey],
      });

      this.currentUser.apiKeys = [...(this.currentUser.apiKeys || []), apiKey];

      return apiKey;
    } catch (error) {
      logger.error('API key creation failed:', error);
      throw error;
    }
  }

  public async deleteApiKey(keyId: string): Promise<void> {
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      const updatedKeys = this.currentUser.apiKeys?.filter(
        (key) => key.id !== keyId
      );

      const userRef = doc(db, 'users', this.currentUser.id);
      await updateDoc(userRef, {
        apiKeys: updatedKeys,
      });

      this.currentUser.apiKeys = updatedKeys;
    } catch (error) {
      logger.error('API key deletion failed:', error);
      throw error;
    }
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null && this.token !== null;
  }
}
