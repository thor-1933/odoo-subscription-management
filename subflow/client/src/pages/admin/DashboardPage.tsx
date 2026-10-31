import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Repeat,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  CreditCard,
  PlayCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningBilling, setRunningBilling] = useState(false);

  const { isAdmin } = useAuth();
  const { success, error, info } = useToast();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/dashboard');
      setData(res.data);
    } catch (err: any) {
      error(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRunBillingNow = async () => {
    try {
      setRunningBilling(true);
      info('Executing automated recurring billing cycle...');
      const res = await api.post('/billing/run-now');
      success(
        res.data?.message ||
          `Billing completed: ${res.data?.data?.invoicesGenerated} invoices generated.`
      );
      // Refresh analytics to show updated invoices and MRR
      await fetchDashboardData();
    } catch (err: any) {
      error(err.message || 'Billing cycle execution failed.');
    } finally {
      setRunningBilling(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const operational = data?.operational || {};

  const COLORS = ['#173b32', '#2f6a52', '#d4a251', '#9d3b3b', '#6f7f7b'];

  return (
    <div className="space-y-8">
      <div className="subflow-shell overflow-hidden">
        <div className="flex flex-col gap-4 bg-[radial-gradient(circle_at_top_left,_rgba(23,59,50,0.08),transparent_30%),linear-gradient(135deg,#fbfaf7_0%,#f1f7f4_100%)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#173b32]">Revenue Intelligence</p>
            <h1 className="editorial-heading mt-2 text-3xl text-slate-900 sm:text-4xl">
              Operating ledger
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Real-time telemetry for Brightloop Software subscription operations
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleRunBillingNow}
              disabled={runningBilling}
              className="subflow-button-primary self-start"
            >
              {runningBilling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              <span>Execute Billing Run</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="subflow-kpi">
          <div className="mb-4 flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Monthly recurring</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight text-slate-900">
            ₹{kpis.mrr?.toLocaleString('en-IN') || '0'}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            ARR: <strong className="text-slate-900">₹{kpis.arr?.toLocaleString('en-IN') || '0'}</strong>
          </div>
        </div>

        <div className="subflow-kpi">
          <div className="mb-4 flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Collected revenue</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight text-slate-900">
            ₹{kpis.totalCollectedRevenue?.toLocaleString('en-IN') || '0'}
          </div>
          <div className="mt-3 text-xs font-semibold text-emerald-600">All recorded payments</div>
        </div>

        <div className="subflow-kpi">
          <div className="mb-4 flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Active subscriptions</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Repeat className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight text-slate-900">{kpis.activeSubscriptions || 0}</div>
          <div className="mt-3 text-xs text-slate-500">Across {kpis.totalCustomers || 0} customers</div>
        </div>

        <div className="subflow-kpi">
          <div className="mb-4 flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Outstanding balance</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight text-slate-900">
            ₹{kpis.outstandingReceivables?.toLocaleString('en-IN') || '0'}
          </div>
          <div className="mt-3 text-xs font-semibold text-rose-600">
            {kpis.overdueInvoicesCount || 0} overdue (₹{kpis.overdueInvoicesAmount?.toLocaleString('en-IN') || '0'})
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Growth Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Revenue Growth Trend</h3>
              <p className="text-xs text-slate-500">Historical billing and collection trajectory</p>
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
              Trailing 6 Months
            </span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.revenueTrend || []}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', borderColor: '#e2e8f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Payment Channels</h3>
            <p className="text-xs text-slate-500 mb-4">Total collections by gateway/channel</p>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.paymentMethods || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="total"
                  >
                    {(charts.paymentMethods || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => `₹${Number(val).toLocaleString('en-IN')}`}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-slate-100">
            {(charts.paymentMethods || []).map((pm: any, idx: number) => (
              <div key={pm.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  {pm.name}
                </span>
                <span className="font-bold text-slate-800">
                  ₹{pm.total.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Highlights: Overdue Invoices & Upcoming Renewals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Invoices Widget */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Overdue Invoices</h3>
            </div>
            <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-full">
              Action Required
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {(operational.overdueInvoices || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No overdue invoices currently.</p>
            ) : (
              operational.overdueInvoices.map((inv: any) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{inv.invoiceNumber}</p>
                    <p className="text-slate-500">{inv.customer.companyName || inv.customer.user.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-rose-600">₹{inv.outstandingBalance.toFixed(2)}</p>
                    <p className="text-[11px] text-slate-400">Due: {new Date(inv.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Renewals Widget */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Upcoming Renewals (30 Days)</h3>
            </div>
            <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
              {kpis.upcomingRenewalsCount || 0} Scheduled
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {(operational.upcomingRenewals || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No subscriptions expiring within 30 days.</p>
            ) : (
              operational.upcomingRenewals.map((sub: any) => (
                <div key={sub.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{sub.subscriptionNumber}</p>
                    <p className="text-slate-500">{sub.customer.companyName} · {sub.plan.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">₹{(sub.grandTotal || sub.plan.price).toFixed(2)}</p>
                    <p className="text-[11px] text-indigo-600">
                      Renews: {new Date(sub.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
