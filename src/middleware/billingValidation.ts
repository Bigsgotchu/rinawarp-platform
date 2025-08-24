import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { validateCreditCard } from '../utils/validation';

export const validateBilling = {
  addPaymentMethod: (req: Request, res: Response, next: NextFunction) => {
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return next(new AppError('Payment method ID is required', 'INVALID_INPUT', 400));
    }

    // Validate payment method ID format
    if (typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_')) {
      return next(new AppError('Invalid payment method ID format', 'INVALID_INPUT', 400));
    }

    next();
  },

  processPayment: (req: Request, res: Response, next: NextFunction) => {
    const { amount, currency, paymentMethodId } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return next(new AppError('Invalid payment amount', 'INVALID_INPUT', 400));
    }

    if (!currency || currency !== 'usd') {
      return next(new AppError('Invalid or unsupported currency', 'INVALID_INPUT', 400));
    }

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return next(new AppError('Invalid payment method ID', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateInvoice: (req: Request, res: Response, next: NextFunction) => {
    const { items, dueDate, customerId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return next(new AppError('Invoice must contain at least one item', 'INVALID_INPUT', 400));
    }

    for (const item of items) {
      if (!item.description || !item.amount || typeof item.amount !== 'number') {
        return next(new AppError('Invalid invoice item format', 'INVALID_INPUT', 400));
      }
    }

    if (!dueDate || isNaN(new Date(dueDate).getTime())) {
      return next(new AppError('Invalid due date', 'INVALID_INPUT', 400));
    }

    if (!customerId) {
      return next(new AppError('Customer ID is required', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateCreditCardInfo: (req: Request, res: Response, next: NextFunction) => {
    const {
      number,
      expiryMonth,
      expiryYear,
      cvc,
      name,
    } = req.body;

    // Validate card number using Luhn algorithm
    if (!validateCreditCard(number)) {
      return next(new AppError('Invalid credit card number', 'INVALID_INPUT', 400));
    }

    // Validate expiry date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (!expiryMonth || !expiryYear ||
        expiryMonth < 1 || expiryMonth > 12 ||
        expiryYear < currentYear ||
        (expiryYear === currentYear && expiryMonth < currentMonth)) {
      return next(new AppError('Invalid expiry date', 'INVALID_INPUT', 400));
    }

    // Validate CVC
    if (!cvc || !/^\d{3,4}$/.test(cvc)) {
      return next(new AppError('Invalid CVC', 'INVALID_INPUT', 400));
    }

    // Validate cardholder name
    if (!name || typeof name !== 'string' || name.length < 2) {
      return next(new AppError('Invalid cardholder name', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateRefund: (req: Request, res: Response, next: NextFunction) => {
    const { paymentId, amount, reason } = req.body;

    if (!paymentId) {
      return next(new AppError('Payment ID is required', 'INVALID_INPUT', 400));
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return next(new AppError('Invalid refund amount', 'INVALID_INPUT', 400));
    }

    const validReasons = ['requested_by_customer', 'fraudulent', 'duplicate'];
    if (!reason || !validReasons.includes(reason)) {
      return next(new AppError('Invalid refund reason', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateBillingAddress: (req: Request, res: Response, next: NextFunction) => {
    const {
      line1,
      city,
      country,
      postalCode,
    } = req.body;

    if (!line1 || typeof line1 !== 'string' || line1.length < 5) {
      return next(new AppError('Invalid street address', 'INVALID_INPUT', 400));
    }

    if (!city || typeof city !== 'string' || city.length < 2) {
      return next(new AppError('Invalid city', 'INVALID_INPUT', 400));
    }

    if (!country || typeof country !== 'string' || country.length !== 2) {
      return next(new AppError('Invalid country code', 'INVALID_INPUT', 400));
    }

    if (!postalCode || typeof postalCode !== 'string') {
      return next(new AppError('Invalid postal code', 'INVALID_INPUT', 400));
    }

    next();
  },
};
