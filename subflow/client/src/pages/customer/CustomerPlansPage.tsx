import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ShoppingBag, Check, Loader2, ArrowRight } from 'lucide-react';

export const CustomerPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { error } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const res = await api.get('/plans');
        setPlans(res.data.data || []);
      } catch (err: any) {
        error(err.message || 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  return (
    <div className="space-y-6">
      <div className="subflow-shell p-6 sm:p-8">
        <p className="subflow-section-label">Choose your service cadence</p>
        <h1 className="editorial-heading mt-2 text-3xl text-slate-900 sm:text-4xl">
          Available Subscription Plans
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Explore recurring service tiers offered by Brightloop Software
        </p>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="subflow-card flex flex-col justify-between p-6 transition-transform hover:-translate-y-1"
            >
              <div>
                <span                 className="rounded-full border border-[#dfeae5] bg-[#edf3f1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#173b32]">
                  {plan.billingFrequency}
                </span>

                <h2 className="editorial-heading mt-3 text-2xl text-slate-900">{plan.name}</h2>
                <p className="mt-2 min-h-10 text-sm leading-6 text-slate-600">{plan.description}</p>

                <div className="mt-5 border-b border-[#e5e9e5] pb-5">
                  <span className="font-mono text-2xl font-semibold text-slate-900">
                    ₹{Number(plan.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="ml-1 text-xs font-medium text-slate-500">
                    / {plan.billingFrequency.toLowerCase()}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-[#2f6a52]" aria-hidden="true" />
                    <span>Multi-tenant cloud SLA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-[#2f6a52]" aria-hidden="true" />
                    <span>Automated period billing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-[#2f6a52]" aria-hidden="true" />
                    <span>Instant invoice dispatch</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[#e5e9e5] pt-4">
                <button
                  type="button"
                  onClick={() => navigate(`/portal/checkout/${encodeURIComponent(plan.id)}?attempt=${crypto.randomUUID()}`)}
                  className="subflow-button-primary w-full"
                >
                  Choose Plan
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
