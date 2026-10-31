import { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from './lib/auth';
import type { Role } from './api/types';
import { AppShell } from './layouts/AppShell';
import { PageLoader } from './components/ui';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from './pages/auth/AuthPages';
import { FinanceDashboard } from './pages/finance/FinanceDashboard';
import { SubscriptionsPage } from './pages/staff/SubscriptionsPage';
import { NewSubscriptionPage } from './pages/staff/NewSubscriptionPage';
import { SubscriptionDetailPage } from './pages/staff/SubscriptionDetailPage';
import { InvoicesPage } from './pages/staff/InvoicesPage';
import { InvoiceDetailPage } from './pages/staff/InvoiceDetailPage';
import { PaymentsPage } from './pages/staff/PaymentsPage';
import { CustomersPage } from './pages/staff/CustomersPage';
import { ProductsPage } from './pages/admin/ProductsPage';
import { PlansPage } from './pages/admin/PlansPage';
import { TaxesPage } from './pages/admin/TaxesPage';
import { DiscountsPage } from './pages/admin/DiscountsPage';
import { TemplatesPage } from './pages/admin/TemplatesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { CustomerPortal } from './pages/customer/CustomerPortal';
import { MyInvoicesPage } from './pages/customer/MyInvoicesPage';
import { ProfilePage } from './pages/customer/ProfilePage';

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8"><PageLoader /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

const STAFF: Role[] = ['ADMIN', 'STAFF'];

export function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireRole roles={STAFF}><AppShell /></RequireRole>}>
        <Route path="/dashboard" element={<FinanceDashboard />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/subscriptions/new" element={<NewSubscriptionPage />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/catalog/products" element={<ProductsPage />} />
        <Route path="/catalog/plans" element={<PlansPage />} />
        <Route path="/catalog/templates" element={<TemplatesPage />} />
        <Route path="/catalog/discounts" element={<DiscountsPage />} />
      </Route>
      <Route element={<RequireRole roles={['ADMIN']}><AppShell /></RequireRole>}>
        <Route path="/catalog/taxes" element={<TaxesPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>
      <Route element={<RequireRole roles={['CUSTOMER']}><AppShell /></RequireRole>}>
        <Route path="/portal" element={<CustomerPortal />} />
        <Route path="/portal/subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="/portal/invoices" element={<MyInvoicesPage />} />
        <Route path="/portal/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/portal/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
    </Routes>
  );
}
