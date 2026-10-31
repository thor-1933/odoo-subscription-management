import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  CalendarCheck,
  Plus,
  Edit2,
  Check,
  X,
  Loader2,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    billingFrequency: 'MONTHLY',
    price: '',
    minQuantity: '1',
    availabilityStart: new Date().toISOString().slice(0, 10),
    availabilityEnd: '',
    autoClose: false,
    allowEarlyCancellation: true,
    allowPause: true,
    allowRenewal: true,
    isActive: true,
    description: '',
  });

  const { isAdmin } = useAuth();
  const { success, error } = useToast();

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/plans');
      setPlans(res.data.data);
    } catch (err: any) {
      error(err.message || 'Failed to fetch subscription plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreateModal = () => {
    setSelectedPlan(null);
    setForm({
      name: '',
      code: '',
      billingFrequency: 'MONTHLY',
      price: '',
      minQuantity: '1',
      availabilityStart: new Date().toISOString().slice(0, 10),
      availabilityEnd: '',
      autoClose: false,
      allowEarlyCancellation: true,
      allowPause: true,
      allowRenewal: true,
      isActive: true,
      description: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setSelectedPlan(p);
    setForm({
      name: p.name,
      code: p.code,
      billingFrequency: p.billingFrequency,
      price: String(p.price),
      minQuantity: String(p.minQuantity),
      availabilityStart: new Date(p.availabilityStart).toISOString().slice(0, 10),
      availabilityEnd: p.availabilityEnd ? new Date(p.availabilityEnd).toISOString().slice(0, 10) : '',
      autoClose: p.autoClose,
      allowEarlyCancellation: p.allowEarlyCancellation,
      allowPause: p.allowPause,
      allowRenewal: p.allowRenewal,
      isActive: p.isActive,
      description: p.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        minQuantity: parseInt(form.minQuantity, 10),
        availabilityEnd: form.availabilityEnd || null,
      };

      if (selectedPlan) {
        await api.put(`/plans/${selectedPlan.id}`, payload);
        success('Plan updated');
      } else {
        await api.post('/plans', payload);
        success('Plan created');
      }
      setIsModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      error(err.message || 'Failed to save plan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Subscription Plans & Billing Cadence
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure recurring frequencies, cancellation policies, and availability dates
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Plan</span>
          </button>
        )}
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border ${
                plan.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'
              } p-6 shadow-sm flex flex-col justify-between relative hover:border-indigo-300 transition-all`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 uppercase tracking-wider">
                    {plan.billingFrequency}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => openEditModal(plan)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded-md"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{plan.code}</p>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">{plan.description}</p>

                <div className="mt-4 pb-4 border-b border-slate-100">
                  <span className="text-2xl font-extrabold text-slate-900">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-400 font-medium ml-1">
                    / {plan.billingFrequency.toLowerCase()}
                  </span>
                </div>

                {/* Policies checklist */}
                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    {plan.allowEarlyCancellation ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>Early Cancellation</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {plan.allowPause ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>Pause Subscription</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {plan.allowRenewal ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>Self-Service Renewal</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {plan.autoClose ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-slate-300" />
                    )}
                    <span>Auto-Close at Expiry</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Min Qty: {plan.minQuantity}</span>
                <span>{plan.isActive ? 'Active' : 'Archived'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {selectedPlan ? 'Edit Subscription Plan' : 'Configure New Subscription Plan'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Professional Monthly"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plan Code *</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="PLAN-PRO-MO"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Cadence *</label>
                  <select
                    value={form.billingFrequency}
                    onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly (Annual)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plan Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="2499.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-extrabold text-indigo-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Availability Start</label>
                  <input
                    type="date"
                    required
                    value={form.availabilityStart}
                    onChange={(e) => setForm({ ...form, availabilityStart: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Availability End (Optional)</label>
                  <input
                    type="date"
                    value={form.availabilityEnd}
                    onChange={(e) => setForm({ ...form, availabilityEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plan Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Included entitlements, quota, support levels..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Policy Toggles */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <p className="font-bold text-slate-700">Plan Policy Rules</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowEarlyCancellation}
                      onChange={(e) => setForm({ ...form, allowEarlyCancellation: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span>Allow Early Cancellation</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowPause}
                      onChange={(e) => setForm({ ...form, allowPause: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span>Allow Pause</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowRenewal}
                      onChange={(e) => setForm({ ...form, allowRenewal: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span>Allow Renewal</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.autoClose}
                      onChange={(e) => setForm({ ...form, autoClose: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span>Auto-Close at Expiry</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
