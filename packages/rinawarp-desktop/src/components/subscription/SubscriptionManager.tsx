/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import { Grid } from '@progress/kendo-react-grid';
import { Card } from '@progress/kendo-react-layout';
import { Button } from '@progress/kendo-react-buttons';
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs';
import { useAuth } from '../../contexts/AuthContext';
import { SubscriptionService } from '../../services/subscription.service';
import {
  SubscriptionPlan,
  SubscriptionDetails,
  Invoice,
} from '../../types/profile';

export const SubscriptionManager: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionDetails | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const subscriptionService = SubscriptionService.getInstance();

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [plans, subscription, invoices] = await Promise.all([
        subscriptionService.getSubscriptionPlans(),
        subscriptionService.getCurrentSubscription(user.id),
        subscriptionService.getInvoices(user.id),
      ]);
      setPlans(plans);
      setCurrentSubscription(subscription);
      setInvoices(invoices);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const subscription = await subscriptionService.subscribeToPlan(user.id, planId);
      setCurrentSubscription(subscription);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      await subscriptionService.cancelSubscription(user.id);
      await loadSubscriptionData();
      setShowCancelDialog(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    try {
      await subscriptionService.manageSubscription(user.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="subscription-manager">
      {/* Current Subscription */}
      {currentSubscription && (
        <Card>
          <div className="k-card-header">
            <h3>Current Subscription</h3>
          </div>
          <div className="k-card-body">
            <div>Plan: {currentSubscription.plan}</div>
            <div>Status: {currentSubscription.status}</div>
            <div>
              Current Period: {new Date(currentSubscription.currentPeriodStart).toLocaleDateString()} -
              {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
            </div>
            {currentSubscription.cancelAtPeriodEnd && (
              <div className="k-messagebox k-messagebox-warning">
                Your subscription will be cancelled at the end of the current period.
              </div>
            )}
            <div className="k-card-actions">
              <Button onClick={handleManageSubscription}>Manage Subscription</Button>
              {!currentSubscription.cancelAtPeriodEnd && (
                <Button onClick={() => setShowCancelDialog(true)} look="outline">
                  Cancel Subscription
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Available Plans */}
      <div className="plans-grid">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <div className="k-card-header">
              <h3>{plan.name}</h3>
            </div>
            <div className="k-card-body">
              <div className="price">
                ${plan.price}/{plan.interval}
              </div>
              <ul>
                {plan.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              <div className="limits">
                <div>AI Requests: {plan.limits.aiRequests}/month</div>
                <div>Storage: {plan.limits.storage}GB</div>
                <div>Team Members: {plan.limits.teamMembers}</div>
              </div>
            </div>
            <div className="k-card-actions">
              <Button
                onClick={() => handleSubscribe(plan.id)}
                themeColor="primary"
                disabled={currentSubscription?.plan.toLowerCase() === plan.name.toLowerCase()}
              >
                {currentSubscription?.plan.toLowerCase() === plan.name.toLowerCase()
                  ? 'Current Plan'
                  : 'Subscribe'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Billing History */}
      <Card>
        <div className="k-card-header">
          <h3>Billing History</h3>
        </div>
        <div className="k-card-body">
          <Grid
            data={invoices}
            sortable={true}
            pageable={true}
          >
            <Grid.Column field="date" title="Date" />
            <Grid.Column field="amount" title="Amount" />
            <Grid.Column field="status" title="Status" />
            <Grid.Column
              title="Actions"
              cell={(props) => (
                <td>
                  {props.dataItem.pdfUrl && (
                    <Button
                      icon="download"
                      look="flat"
                      onClick={() => window.open(props.dataItem.pdfUrl)}
                    >
                      Download
                    </Button>
                  )}
                </td>
              )}
            />
          </Grid>
        </div>
      </Card>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <Dialog title="Cancel Subscription" onClose={() => setShowCancelDialog(false)}>
          <p>Are you sure you want to cancel your subscription?</p>
          <p>You will continue to have access until the end of your current billing period.</p>
          <DialogActionsBar>
            <Button onClick={handleCancel} themeColor="error">
              Yes, Cancel Subscription
            </Button>
            <Button onClick={() => setShowCancelDialog(false)} look="outline">
              No, Keep Subscription
            </Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {error && (
        <div className="k-messagebox k-messagebox-error">
          {error}
        </div>
      )}
    </div>
  );
};
