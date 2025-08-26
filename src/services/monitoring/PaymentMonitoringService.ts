import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import { AlertService } from './AlertService';

class PaymentMonitoringService {
  private static instance: PaymentMonitoringService;
  private alertService: AlertService;

  private constructor() {
    this.alertService = new AlertService();
  }

  public static getInstance(): PaymentMonitoringService {
    if (!PaymentMonitoringService.instance) {
      PaymentMonitoringService.instance = new PaymentMonitoringService();
    }
    return PaymentMonitoringService.instance;
  }

  // Monitor for suspicious payment patterns
  async monitorPaymentPatterns(userId: string, amount: number): Promise<void> {
    try {
      const ONE_HOUR = 60 * 60 * 1000;
      const SIX_HOURS = 6 * ONE_HOUR;

      // Get recent payment attempts
      const recentPayments = await prisma.paymentAttempt.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - SIX_HOURS),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Check for rapid successive payments
      if (recentPayments.length >= 5) {
        const timeDiff =
          recentPayments[0].createdAt.getTime() -
          recentPayments[4].createdAt.getTime();

        if (timeDiff < ONE_HOUR) {
          await this.alertService.sendAlert('SUSPICIOUS_PAYMENT_PATTERN', {
            userId,
            paymentCount: recentPayments.length,
            timeWindow: 'past hour',
            totalAmount: amount,
          });
        }
      }

      // Check for unusual payment amounts
      const averageAmount =
        recentPayments.reduce((sum, payment) => sum + payment.amount, 0) /
        recentPayments.length;

      if (amount > averageAmount * 5) {
        await this.alertService.sendAlert('UNUSUAL_PAYMENT_AMOUNT', {
          userId,
          amount,
          averageAmount,
          difference: 'over 5x average',
        });
      }
    } catch (error) {
      logger.error('Failed to monitor payment patterns:', error);
      throw error;
    }
  }

  // Track failed payment attempts
  async trackFailedPayment(userId: string, error: any): Promise<void> {
    try {
      const ONE_DAY = 24 * 60 * 60 * 1000;

      // Record failed attempt
      await prisma.paymentFailure.create({
        data: {
          userId,
          errorCode: error.code || 'UNKNOWN',
          errorMessage: error.message,
          timestamp: new Date(),
        },
      });

      // Check for multiple failures
      const recentFailures = await prisma.paymentFailure.count({
        where: {
          userId,
          timestamp: {
            gte: new Date(Date.now() - ONE_DAY),
          },
        },
      });

      if (recentFailures >= 3) {
        await this.alertService.sendAlert('MULTIPLE_PAYMENT_FAILURES', {
          userId,
          failureCount: recentFailures,
          timeWindow: 'past 24 hours',
        });

        // Update user's risk score
        await prisma.user.update({
          where: { id: userId },
          data: {
            riskScore: {
              increment: 10,
            },
          },
        });
      }
    } catch (error) {
      logger.error('Failed to track payment failure:', error);
      throw error;
    }
  }

  // Monitor chargeback risk
  async assessChargebackRisk(
    userId: string,
    amount: number
  ): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    requiresAdditionalVerification: boolean;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          paymentHistory: true,
          chargebacks: true,
        },
      });

      if (!user) throw new Error('User not found');

      let riskScore = 0;

      // Factor 1: Account age
      const accountAge = Date.now() - user.createdAt.getTime();
      if (accountAge < 30 * 24 * 60 * 60 * 1000) {
        // Less than 30 days
        riskScore += 30;
      }

      // Factor 2: Payment history
      const successfulPayments = user.paymentHistory.filter(
        p => p.status === 'SUCCESS'
      ).length;
      if (successfulPayments < 3) {
        riskScore += 20;
      }

      // Factor 3: Previous chargebacks
      const chargebackCount = user.chargebacks.length;
      riskScore += chargebackCount * 25;

      // Factor 4: Transaction amount relative to history
      const averageTransactionAmount =
        user.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0) /
          user.paymentHistory.length || 0;

      if (amount > averageTransactionAmount * 3) {
        riskScore += 15;
      }

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (riskScore >= 70) {
        riskLevel = 'HIGH';
      } else if (riskScore >= 40) {
        riskLevel = 'MEDIUM';
      }

      // Log risk assessment
      logger.info('Chargeback risk assessment', {
        userId,
        riskScore,
        riskLevel,
        factors: {
          accountAge,
          successfulPayments,
          chargebackCount,
          transactionAmount: amount,
          averageTransactionAmount,
        },
      });

      return {
        riskLevel,
        requiresAdditionalVerification: riskScore >= 60,
      };
    } catch (error) {
      logger.error('Failed to assess chargeback risk:', error);
      throw error;
    }
  }

  // Transaction monitoring
  async monitorTransaction(transactionId: string): Promise<void> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: true,
          paymentMethod: true,
        },
      });

      if (!transaction) throw new Error('Transaction not found');

      // Check for velocity
      const velocityCheck = await this.checkTransactionVelocity(
        transaction.userId,
        transaction.amount
      );

      if (velocityCheck.isAnomalous) {
        await this.alertService.sendAlert('TRANSACTION_VELOCITY_ANOMALY', {
          transactionId,
          userId: transaction.userId,
          amount: transaction.amount,
          velocity: velocityCheck.velocity,
        });
      }

      // Check for location anomalies
      if (transaction.ipAddress && transaction.paymentMethod.lastUsedIp) {
        const locationCheck = await this.checkLocationAnomaly(
          transaction.ipAddress,
          transaction.paymentMethod.lastUsedIp
        );

        if (locationCheck.isAnomalous) {
          await this.alertService.sendAlert('LOCATION_ANOMALY', {
            transactionId,
            userId: transaction.userId,
            currentLocation: locationCheck.currentLocation,
            previousLocation: locationCheck.previousLocation,
          });
        }
      }

      // Record monitoring event
      await prisma.transactionMonitoring.create({
        data: {
          transactionId,
          velocityAnomaly: velocityCheck.isAnomalous,
          locationAnomaly: false, // Set based on your location check
          riskScore: this.calculateRiskScore(transaction),
          monitoringData: {
            velocity: velocityCheck,
            // Add other monitoring data
          },
        },
      });
    } catch (error) {
      logger.error('Failed to monitor transaction:', error);
      throw error;
    }
  }

  private async checkTransactionVelocity(userId: string, amount: number) {
    // Implementation for checking transaction velocity
    // This would typically involve analyzing the frequency and volume of recent transactions
    return {
      isAnomalous: false,
      velocity: 0,
    };
  }

  private calculateRiskScore(transaction: any): number {
    // Implement risk scoring logic
    return 0;
  }

  private async checkLocationAnomaly(currentIp: string, previousIp: string) {
    // Implementation for checking location anomalies
    return {
      isAnomalous: false,
      currentLocation: '',
      previousLocation: '',
    };
  }
}

export default PaymentMonitoringService;
