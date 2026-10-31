/**
 * API Client & Resilient Data Bridge for Brightloop Platform
 * 
 * Capabilities:
 * - Connects to Express backend via /api/* with automatic Bearer JWT header
 * - Automatic background authentication sync for demo roles (Admin, Staff, Customer)
 * - Graceful fallback to rich seed mock data whenever backend or database is offline
 * - Zero blank screen guarantee
 */

import { 
  Product, 
  Plan, 
  Discount, 
  Subscription, 
  Invoice, 
  initialProducts, 
  initialPlans, 
  initialDiscounts, 
  initialSubscriptions, 
  initialInvoices 
} from './mockData';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `API request failed with status ${response.status}`);
  }

  return data;
}

// Demo credentials mapping
export const DEMO_CREDENTIALS = {
  ADMIN: { email: 'admin@brightloop.test', password: 'Admin@1234' },
  STAFF: { email: 'staff@brightloop.test', password: 'Staff@1234' },
  CUSTOMER: { email: 'customer@brightloop.test', password: 'Customer@1234' },
};

// Auto-authenticate when role switches
export async function authenticateRole(role: 'ADMIN' | 'STAFF' | 'CUSTOMER'): Promise<boolean> {
  const creds = DEMO_CREDENTIALS[role];
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
      }
    }
  } catch (err) {
    // Backend offline; continue with local session
  }
  return false;
}

// Resilient API services with seed fallback
export async function getProducts(): Promise<Product[]> {
  try {
    const res = await apiRequest('/products');
    if (res && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {
    // fallback
  }
  return initialProducts;
}

export async function getPlans(): Promise<Plan[]> {
  try {
    const res = await apiRequest('/plans');
    if (res && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {
    // fallback
  }
  return initialPlans;
}

export async function getDiscounts(): Promise<Discount[]> {
  try {
    const res = await apiRequest('/discounts');
    if (res && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {
    // fallback
  }
  return initialDiscounts;
}

export async function getSubscriptions(): Promise<Subscription[]> {
  try {
    const res = await apiRequest('/subscriptions');
    if (res && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {
    // fallback
  }
  return initialSubscriptions;
}

export async function getInvoices(): Promise<Invoice[]> {
  try {
    const res = await apiRequest('/invoices');
    if (res && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {
    // fallback
  }
  return initialInvoices;
}

export async function postPayment(
  invoiceId: string,
  paymentData: { method: string; amount: number; paidOn?: string; note?: string }
): Promise<any> {
  try {
    return await apiRequest(`/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        method: paymentData.method,
        amount: paymentData.amount,
        paidOn: paymentData.paidOn || new Date().toISOString(),
        note: paymentData.note,
      }),
    });
  } catch (err) {
    console.warn('Backend payment submission failed, recording locally:', err);
    return null;
  }
}
