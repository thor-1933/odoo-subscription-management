import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

type DemoRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string }; demoRole?: DemoRole } | null;
  const from = state?.from?.pathname;
  const demoRole = state?.demoRole;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      error('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      const user = await login({ email, password });
      success(`Welcome back, ${user.name}!`);
      if (from) {
        navigate(from, { replace: true });
      } else {
        navigate(user.role === 'CUSTOMER' ? '/portal' : '/dashboard', { replace: true });
      }
    } catch (err: any) {
      error(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-grid px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-[#214539] bg-[#173b32] p-8 text-white shadow-[0_38px_80px_-32px_rgba(23,59,50,0.9)] sm:p-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f5efe7] text-xl font-bold text-[#173b32]">S</div>
            <span className="text-2xl font-extrabold tracking-tight">SubFlow</span>
          </Link>
          <div className="mt-10 max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#dfeae5]">Brightloop Software</p>
            <h1 className="editorial-heading mt-4 text-4xl text-white sm:text-5xl">
              Billing clarity for modern subscription teams.
            </h1>
            <p className="mt-5 text-base leading-7 text-[#dfeae5]">
              Manage recurring revenue, customer contracts, and financial operations from one connected workspace.
            </p>
          </div>
          <div className="mt-10 space-y-3">
            {['Automated recurring billing workflows', 'Invoice lifecycle and payment reconciliation', 'Operational analytics and customer visibility'].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#edf5f0]">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="subflow-shell p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="editorial-heading text-3xl text-slate-900">
              {demoRole ? `Sign in to ${demoRole.toLowerCase()} workspace` : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">Enter your account details to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="name@company.com"
                className="subflow-input"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="login-password">Password</label>
                <Link to="/forgot-password" className="text-xs font-medium text-[#173b32] hover:text-[#0d2b25]">
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="subflow-input"
              />
            </div>

            <button type="submit" disabled={loading} className="subflow-button-primary w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-[#173b32] hover:text-[#0d2b25]">
              Register as a customer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
