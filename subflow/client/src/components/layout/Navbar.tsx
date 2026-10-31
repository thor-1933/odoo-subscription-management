import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';
import { PlayCircle, Loader2, LogOut, User as UserIcon, Shield, Briefcase, UserCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { success, error, info } = useToast();
  const [runningBilling, setRunningBilling] = useState(false);

  const handleRunBillingNow = async () => {
    try {
      setRunningBilling(true);
      info('Executing automated recurring billing cycle...');
      const res = await api.post('/billing/run-now');
      success(
        res.data?.message ||
          `Billing completed: ${res.data?.data?.invoicesGenerated} invoices generated.`
      );
    } catch (err: any) {
      error(err.message || 'Billing cycle execution failed.');
    } finally {
      setRunningBilling(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173b32] text-lg font-black text-white shadow-[0_12px_24px_-14px_rgba(23,59,50,0.85)]">
            S
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight text-slate-900">SubFlow</span>
            <span className="rounded-full border border-[#dfeae5] bg-[#edf3f1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#173b32]">
              Brightloop
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={handleRunBillingNow}
              disabled={runningBilling}
              className="subflow-button-primary px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em]"
              title="Execute immediate automated recurring billing cycle across all eligible subscriptions"
            >
              {runningBilling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
              <span>Run Billing Now</span>
            </button>
          )}

          <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                user?.role === 'ADMIN'
                  ? 'border-[#dfeae5] bg-[#edf3f1] text-[#173b32]'
                  : user?.role === 'STAFF'
                    ? 'border-[#dfeae5] bg-[#f3f7f5] text-[#3e5f57]'
                    : 'border-[#dfeae5] bg-[#edf5ee] text-[#2f6a52]'
              }`}
            >
              {user?.role === 'ADMIN' && <Shield className="w-3 h-3" />}
              {user?.role === 'STAFF' && <Briefcase className="w-3 h-3" />}
              {user?.role === 'CUSTOMER' && <UserCheck className="w-3 h-3" />}
              {user?.role}
            </span>

            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">{user?.name}</p>
              <p className="max-w-[150px] truncate text-[11px] text-slate-500">{user?.email}</p>
            </div>

            <button
              onClick={logout}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
