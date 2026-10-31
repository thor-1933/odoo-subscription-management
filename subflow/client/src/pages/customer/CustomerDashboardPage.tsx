import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Repeat,
  FileText,
  CreditCard,
  ShoppingBag,
  ArrowRight,
  Loader2,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export const CustomerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  const fetchPortalData = useCallback(async () => {
    setLoading(true);
    setHasLoadError(false);
    try {
      const [subRes, invRes, payRes] = await Promise.all([
        api.get('/subscriptions'),
        api.get('/invoices'),
        api.get('/payments'),
      ]);
      setSubscriptions(subRes.data.data || []);
      setInvoices(invRes.data.data || []);
      setPayments(payRes.data.data || []);
    } catch (err) {
      console.error('Portal data error:', err);
      setHasLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPortalData();
  }, [fetchPortalData]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="sr-only">Loading your account overview</span>
      </div>
    );
  }

  if (hasLoadError) {
    return (
      <section
        className="subflow-shell mx-auto max-w-3xl p-6 sm:p-10"
        role="alert"
        aria-labelledby="dashboard-load-error-title"
      >
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50">
            <AlertCircle className="h-6 w-6 text-rose-700" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52645e]">
              Account overview
            </p>
            <h1 id="dashboard-load-error-title" className="editorial-heading mt-2 text-2xl text-slate-900 sm:text-3xl">
              Your dashboard could not load
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              We couldn’t retrieve your subscriptions, invoices, and payments. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => void fetchPortalData()}
              className="subflow-button-primary mt-5 min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173b32]"
            >
              <span>Try Again</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE');
  const openInvoices = invoices.filter((i) => i.outstandingBalance > 0);
  const totalBalanceDue = openInvoices.reduce((acc, i) => acc + i.outstandingBalance, 0);

  return (
    <div className="space-y-8">
      <div className="subflow-shell overflow-hidden">
        <div className="flex flex-col gap-4 bg-[radial-gradient(circle_at_top_left,_rgba(23,59,50,0.08),transparent_30%),linear-gradient(135deg,#fbfaf7_0%,#f1f7f4_100%)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-[#dfeae5] bg-[#edf3f1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#173b32]">
              Self-service account portal
            </span>
            <h1 className="editorial-heading mt-3 text-3xl text-slate-900 sm:text-4xl">
              Welcome back, {user?.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {user?.customerProfile?.companyName || 'Brightloop Subscriber'} · Tax ID: {user?.customerProfile?.taxId || 'Not configured'}
            </p>
          </div>

          <Link to="/portal/plans" className="subflow-button-primary self-start">
            <ShoppingBag className="h-4 w-4" />
            <span>Browse Available Plans</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="subflow-kpi">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Active subscriptions</span>
          <div className="mt-4 text-3xl font-black tracking-tight text-slate-900">{activeSubs.length}</div>
          <Link to="/portal/subscriptions" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">
            <span>Manage plans</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="subflow-kpi">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Outstanding balance</span>
          <div className="mt-4 text-3xl font-black tracking-tight text-slate-900">₹{totalBalanceDue.toFixed(2)}</div>
          <Link to="/portal/invoices" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">
            <span>{openInvoices.length} open invoices</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="subflow-kpi">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Recorded payments</span>
          <div className="mt-4 text-3xl font-black tracking-tight text-emerald-600">{payments.length}</div>
          <Link to="/portal/payments" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">
            <span>View payment receipts</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="subflow-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Your active contracts</h2>
          <Link to="/portal/subscriptions" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
            View all
          </Link>
        </div>

        {subscriptions.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No subscriptions active currently.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {subscriptions.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900">{s.subscriptionNumber}</p>
                  <p className="text-slate-500 font-medium">
                    {s.plan.name} ({s.plan.billingFrequency})
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">₹{(s.grandTotal || s.plan.price).toFixed(2)}</p>
                  <p className="mt-1 text-[11px] text-indigo-600">
                    Next billing: {new Date(s.nextBillingDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
