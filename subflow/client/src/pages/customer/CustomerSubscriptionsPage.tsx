import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  Repeat,
  Pause,
  Play,
  RotateCcw,
  Ban,
  Calendar,
  Loader2,
  CheckCircle,
} from 'lucide-react';

export const CustomerSubscriptionsPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { success, error } = useToast();

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscriptions');
      setSubscriptions(res.data.data);
    } catch (err: any) {
      error(err.message || 'Failed to fetch your subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'cancel' | 'renew') => {
    try {
      setActionLoadingId(id);
      const res = await api.post(`/subscriptions/${id}/${action}`, {
        reason: `Customer requested ${action} via portal`,
      });
      success(res.data?.message || `Subscription ${action} request processed`);
      fetchSubscriptions();
    } catch (err: any) {
      error(err.message || `Unable to ${action} subscription`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          My Subscriptions & Services
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review active licenses, next payment dates, and self-service lifecycle controls
        </p>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs">
          You currently have no active or historical subscriptions.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {subscriptions.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {s.subscriptionNumber}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      s.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : s.status === 'PAUSED'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{s.plan.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {s.plan.billingFrequency} Cadence · {s.paymentTerms}
                </p>

                <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recurring Total:</span>
                    <strong className="text-slate-900">
                      ₹{(s.grandTotal || s.plan.price).toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Next Billing Date:</span>
                    <strong className="text-indigo-700">
                      {new Date(s.nextBillingDate).toLocaleDateString()}
                    </strong>
                  </div>
                  {s.expiryDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contract End:</span>
                      <span className="text-slate-700">
                        {new Date(s.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="mt-3 text-xs text-slate-600">
                  <span className="font-bold text-slate-700 block mb-1">Entitlements:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
                    {s.lines.map((l: any) => (
                      <li key={l.id}>
                        {l.product.name} {l.variant && `(${l.variant.name})`} × {l.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                {s.status === 'ACTIVE' && s.plan.allowPause && (
                  <button
                    onClick={() => handleAction(s.id, 'pause')}
                    disabled={actionLoadingId === s.id}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-lg transition-all"
                  >
                    Pause Plan
                  </button>
                )}

                {s.status === 'PAUSED' && (
                  <button
                    onClick={() => handleAction(s.id, 'resume')}
                    disabled={actionLoadingId === s.id}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition-all"
                  >
                    Resume Plan
                  </button>
                )}

                {s.status !== 'CLOSED' && s.plan.allowRenewal && (
                  <button
                    onClick={() => handleAction(s.id, 'renew')}
                    disabled={actionLoadingId === s.id}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-all"
                  >
                    Renew
                  </button>
                )}

                {s.status !== 'CLOSED' && s.plan.allowEarlyCancellation && (
                  <button
                    onClick={() => {
                      if (confirm('Cancel this subscription?')) {
                        handleAction(s.id, 'cancel');
                      }
                    }}
                    disabled={actionLoadingId === s.id}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 font-bold rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
