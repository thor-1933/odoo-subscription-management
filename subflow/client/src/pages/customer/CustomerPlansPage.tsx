import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ShoppingBag, Check, Loader2 } from 'lucide-react';

export const CustomerPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { error } = useToast();

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
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Available Subscription Plans
        </h1>
        <p className="text-xs text-slate-500 mt-1">
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
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:border-indigo-400 transition-all"
            >
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 uppercase tracking-wider">
                  {plan.billingFrequency}
                </span>

                <h3 className="text-base font-bold text-slate-900 mt-3">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{plan.description}</p>

                <div className="mt-4 pb-4 border-b border-slate-100">
                  <span className="text-2xl font-extrabold text-slate-900">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-400 font-medium ml-1">
                    / {plan.billingFrequency.toLowerCase()}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Multi-tenant cloud SLA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Automated period billing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Instant invoice dispatch</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <a
                  href="mailto:sales@brightloop.io?subject=Inquiry regarding plan"
                  className="w-full block text-center py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                >
                  Contact Sales for Activation
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
