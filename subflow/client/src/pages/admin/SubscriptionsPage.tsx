import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Repeat,
  Search,
  Play,
  Pause,
  RotateCcw,
  Ban,
  Clock,
  Eye,
  Loader2,
  X,
  History,
  Calendar,
} from 'lucide-react';

export const SubscriptionsPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { isCustomer } = useAuth();
  const { success, error, info } = useToast();

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/subscriptions', { params });
      setSubscriptions(res.data.data);
    } catch (err: any) {
      error(err.message || 'Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [statusFilter]);

  const viewDetails = async (id: string) => {
    try {
      const res = await api.get(`/subscriptions/${id}`);
      setSelectedSub(res.data.data);
      setIsDetailModalOpen(true);
    } catch (err: any) {
      error(err.message || 'Could not load subscription details');
    }
  };

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'cancel' | 'renew') => {
    try {
      setActionLoadingId(id);
      const res = await api.post(`/subscriptions/${id}/${action}`, {
        reason: `Triggered by user interface (${action})`,
      });
      success(res.data?.message || `Subscription ${action}d successfully`);
      fetchSubscriptions();
      if (selectedSub?.id === id) {
        viewDetails(id);
      }
    } catch (err: any) {
      error(err.message || `Failed to ${action} subscription`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Active Subscriptions & Contracts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor recurring schedules, next billing dates, and lifecycle state transitions
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        {['', 'ACTIVE', 'CONFIRMED', 'PAUSED', 'CLOSED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              statusFilter === s
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {s || 'All Subscriptions'}
          </button>
        ))}
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No subscriptions found matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Sub #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Plan & Frequency</th>
                  <th className="py-3.5 px-4">Next Billing Date</th>
                  <th className="py-3.5 px-4">Recurring Charge</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {subscriptions.map((s) => {
                  const isNextBillingPast = new Date(s.nextBillingDate) <= new Date();

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {s.subscriptionNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {s.customer.companyName || s.customer.user.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{s.customer.user.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800">{s.plan.name}</span>
                        <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {s.plan.billingFrequency}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className={isNextBillingPast ? 'font-bold text-rose-600' : 'text-slate-700'}>
                            {new Date(s.nextBillingDate).toLocaleDateString()}
                          </span>
                        </div>
                        {isNextBillingPast && s.status === 'ACTIVE' && (
                          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1 rounded">
                            Due for billing
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        ₹{(s.grandTotal || s.plan.price).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : s.status === 'PAUSED'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : s.status === 'CLOSED'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => viewDetails(s.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Subscription Details & Audit"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Pause / Resume */}
                          {s.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleAction(s.id, 'pause')}
                              disabled={actionLoadingId === s.id}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Pause Subscription"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {s.status === 'PAUSED' && (
                            <button
                              onClick={() => handleAction(s.id, 'resume')}
                              disabled={actionLoadingId === s.id}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Resume Subscription"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Renew */}
                          {s.status !== 'CLOSED' && (
                            <button
                              onClick={() => handleAction(s.id, 'renew')}
                              disabled={actionLoadingId === s.id}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Renew Subscription"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Cancel */}
                          {s.status !== 'CLOSED' && (
                            <button
                              onClick={() => {
                                if (confirm('Cancel this subscription?')) {
                                  handleAction(s.id, 'cancel');
                                }
                              }}
                              disabled={actionLoadingId === s.id}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Cancel Subscription"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUBSCRIPTION DETAIL & STATUS HISTORY MODAL */}
      {isDetailModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Subscription {selectedSub.subscriptionNumber}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Plan: {selectedSub.plan.name} ({selectedSub.plan.billingFrequency})
                </p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-slate-400 font-semibold block">Customer</span>
                  <span className="font-bold text-slate-800">
                    {selectedSub.customer.companyName || selectedSub.customer.user.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Next Billing</span>
                  <span className="font-bold text-indigo-700">
                    {new Date(selectedSub.nextBillingDate).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Total Rate</span>
                  <span className="font-extrabold text-slate-900">
                    ₹{selectedSub.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Line items */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Entitled Products & Lines</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedSub.lines.map((l: any) => (
                    <div key={l.id} className="p-3 flex items-center justify-between bg-white">
                      <div>
                        <p className="font-bold text-slate-900">
                          {l.product.name} {l.variant && `(${l.variant.name})`}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Qty: {l.quantity} × ₹{l.unitPrice.toFixed(2)} (Tax: {l.taxRate}%)
                        </p>
                      </div>
                      <div className="font-bold text-slate-900">
                        ₹{l.lineTotal.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status History (Requirement 8) */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Lifecycle Audit Trail</span>
                </h4>
                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {(selectedSub.statusHistory || []).length === 0 ? (
                    <p className="text-slate-400 italic">No historical status transitions recorded.</p>
                  ) : (
                    selectedSub.statusHistory.map((h: any) => (
                      <div key={h.id} className="text-[11px] p-2 bg-white rounded-lg border border-slate-200 flex items-start justify-between">
                        <div>
                          <span className="font-bold text-slate-800">
                            {h.previousStatus} → {h.newStatus}
                          </span>
                          <p className="text-slate-500 mt-0.5">{h.reason || 'Status updated'}</p>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
