import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/public/ResetPasswordPage';

// Admin / Staff Pages
import { DashboardPage } from './pages/admin/DashboardPage';
import { ProductsPage } from './pages/admin/ProductsPage';
import { PlansPage } from './pages/admin/PlansPage';
import { CustomersPage } from './pages/admin/CustomersPage';
import { QuotationsPage } from './pages/admin/QuotationsPage';
import { SubscriptionsPage } from './pages/admin/SubscriptionsPage';
import { InvoicesPage } from './pages/admin/InvoicesPage';
import { PaymentsPage } from './pages/admin/PaymentsPage';
import { TaxesPage } from './pages/admin/TaxesPage';
import { DiscountsPage } from './pages/admin/DiscountsPage';
import { UsersPage } from './pages/admin/UsersPage';

// Customer Pages
import { CustomerDashboardPage } from './pages/customer/CustomerDashboardPage';
import { CustomerSubscriptionsPage } from './pages/customer/CustomerSubscriptionsPage';
import { CustomerPlansPage } from './pages/customer/CustomerPlansPage';
import { CustomerInvoicesPage } from './pages/customer/CustomerInvoicesPage';
import { CustomerPaymentsPage } from './pages/customer/CustomerPaymentsPage';
import { CustomerProfilePage } from './pages/customer/CustomerProfilePage';
import { CustomerCheckoutPage, CustomerCheckoutSuccessPage } from './pages/customer/CustomerCheckoutPage';

// Route Redirection Helper
const RootRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <LandingPage />;
  return <Navigate to={user.role === 'CUSTOMER' ? '/portal' : '/dashboard'} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Admin & Staff Protected Routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/taxes" element={<TaxesPage />} />
              <Route
                path="/discounts"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <DiscountsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Customer Portal Protected Routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/portal/checkout/success" element={<CustomerCheckoutSuccessPage />} />
              <Route path="/portal/checkout/:planId" element={<CustomerCheckoutPage />} />
              <Route path="/portal" element={<CustomerDashboardPage />} />
              <Route path="/portal/subscriptions" element={<CustomerSubscriptionsPage />} />
              <Route path="/portal/plans" element={<CustomerPlansPage />} />
              <Route path="/portal/invoices" element={<CustomerInvoicesPage />} />
              <Route path="/portal/payments" element={<CustomerPaymentsPage />} />
              <Route path="/portal/profile" element={<CustomerProfilePage />} />
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
