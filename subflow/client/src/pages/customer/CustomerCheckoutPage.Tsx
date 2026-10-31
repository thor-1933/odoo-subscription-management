import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import api from '../../api/client';

type PaymentMethod = 'UPI' | 'CARD' | 'NET_BANKING';

interface CheckoutSummary {
  plan: {
    id: string;
    name: string;
    billingFrequency: string;
    price: number;
    description?: string | null;
  };
  customer: {
    name: string;
    email: string;
    companyName?: string | null;
    billingAddress?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  };
  pricing: {
    subtotal: number;
    taxName: string;
    taxRate: number;
    taxAmount: number;
    total: number;
  };
  demoMode: boolean;
}

interface CheckoutResult {
  subscriptionId: string;
  subscriptionNumber: string;
  status: string;
  planName: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentId: string;
  transactionReference: string;
  amount: number;
  paymentDate: string;
  demoMode: boolean;
}

const formatINR = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const newAttemptKey = () => globalThis.crypto.randomUUID();

export const CustomerCheckoutPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const attemptKey = useMemo(() => new URLSearchParams(location.search).get('attempt'), [location.search]);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [upiId, setUpiId] = useState('');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!attemptKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptKey)) {
      navigate(`${location.pathname}?attempt=${newAttemptKey()}`, { replace: true });
    }
  }, [attemptKey, location.pathname, navigate]);

  useEffect(() => {
    let active = true;
    if (!planId) {
      setLoading(false);
      setErrorMessage('No subscription plan was selected.');
      return () => {
        active = false;
      };
    }

    api.get(`/plans/${encodeURIComponent(planId)}/checkout`)
      .then((response) => {
        if (active) setSummary(response.data.data);
      })
      .catch((error: Error) => {
        if (active) setErrorMessage(error.message || 'Unable to load this plan for checkout.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [planId]);

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setErrorMessage('');

    if (!summary || !planId || !attemptKey) return;
    if (paymentMethod === 'UPI' && !simulateFailure && !/^[\w.-]+@[\w.-]+$/.test(upiId.trim())) {
      setFormError('Enter a demo UPI ID such as demo@upi.');
      return;
    }

    setProcessing(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 850));
      const response = await api.post('/subscriptions/demo-checkout', {
        planId,
        idempotencyKey: attemptKey,
        paymentMethod,
        ...(paymentMethod === 'UPI' ? { upiId: upiId.trim() } : {}),
        simulateFailure,
      });
      const result = response.data.data as CheckoutResult;
      sessionStorage.setItem('subflow-demo-checkout-result', JSON.stringify(result));
      navigate('/portal/checkout/success', { state: result, replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Demo payment could not be completed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-[#173b32]" aria-hidden="true" />
        <span className="sr-only">Loading secure demo checkout</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <section className="subflow-shell mx-auto max-w-2xl p-8" role="alert">
        <h1 className="editorial-heading text-3xl">Checkout unavailable</h1>
        <p className="mt-3 text-sm text-slate-600">{errorMessage}</p>
        <Link to="/portal/plans" className="subflow-button-primary mt-6">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to plans
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/portal/plans" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#173b32] hover:text-[#0d2b25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173b32]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All plans
      </Link>

      <header className="subflow-shell overflow-hidden">
        <div className="border-b border-[#dfe7e3] bg-[#edf3f1] px-6 py-5 sm:px-8">
          <p className="subflow-section-label">Secure checkout · Demo environment</p>
          <h1 className="editorial-heading mt-2 text-3xl sm:text-4xl">Make this plan yours.</h1>
          <p className="mt-2 text-sm text-slate-600">Review your order and complete a simulated payment. Nothing will be charged.</p>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <form id="checkout-form" onSubmit={submitPayment} className="space-y-7">
            <section aria-labelledby="customer-details-heading">
              <p className="subflow-section-label">01 · Billing profile</p>
              <h2 id="customer-details-heading" className="editorial-heading mt-2 text-2xl">Customer details</h2>
              <div className="mt-4 grid gap-3 rounded-2xl border border-[#dfe7e3] bg-white/70 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Account holder</p>
                  <p className="mt-1 font-semibold text-slate-900">{summary.customer.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="mt-1 break-all font-medium text-slate-700">{summary.customer.email}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">Billing address</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {[summary.customer.companyName, summary.customer.billingAddress, summary.customer.city, summary.customer.state, summary.customer.postalCode]
                      .filter(Boolean)
                      .join(', ') || 'No billing address on file'}
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="payment-method-heading">
              <p className="subflow-section-label">02 · Payment method</p>
              <h2 id="payment-method-heading" className="editorial-heading mt-2 text-2xl">Choose how to pay</h2>
              <fieldset className="mt-4 space-y-3">
                <legend className="sr-only">Demo payment method</legend>
                {([
                  ['UPI', 'UPI', 'Use a dummy UPI ID'],
                  ['CARD', 'Debit or credit card', 'Test card •••• 4242 · no card details collected'],
                  ['NET_BANKING', 'Net banking', 'Simulated bank redirect'],
                ] as const).map(([value, label, detail]) => (
                  <label key={value} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${paymentMethod === value ? 'border-[#173b32] bg-[#edf3f1]' : 'border-[#dfe7e3] bg-white/70 hover:border-[#9eb6ad]'}`}>
                    <input
                      type="radio"
                      name="payment-method"
                      value={value}
                      checked={paymentMethod === value}
                      onChange={() => {
                        setPaymentMethod(value);
                        setFormError('');
                      }}
                      className="mt-1 accent-[#173b32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173b32]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{label}</span>
                      <span className="mt-1 block text-xs text-slate-600">{detail}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {paymentMethod === 'UPI' && (
                <div className="mt-4">
                  <label htmlFor="demo-upi-id" className="mb-1.5 block text-sm font-medium text-slate-700">Dummy UPI ID</label>
                  <input
                    id="demo-upi-id"
                    type="text"
                    autoComplete="off"
                    value={upiId}
                    onChange={(event) => {
                      setUpiId(event.target.value);
                      setFormError('');
                    }}
                    placeholder="demo@upi"
                    className="subflow-input"
                    aria-describedby="upi-demo-help"
                    maxLength={120}
                  />
                  <p id="upi-demo-help" className="mt-1.5 text-xs text-slate-500">Use test-only details. This ID is validated for the demo and is not stored.</p>
                </div>
              )}

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-[#c8d7d1] bg-[#faf8f4] p-4">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(event) => setSimulateFailure(event.target.checked)}
                  className="mt-1 accent-[#173b32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173b32]"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">Test a declined payment</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">Demo-only test scenario. A decline creates no subscription, invoice, or payment record.</span>
                </span>
              </label>

              {formError && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{formError}</p>}
              {errorMessage && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
                  <p>{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setSimulateFailure(false);
                      window.setTimeout(() => {
                        (document.getElementById('checkout-form') as HTMLFormElement | null)?.requestSubmit();
                      }, 0);
                    }}
                    className="mt-2 min-h-11 font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </section>

            <button type="submit" disabled={processing} className="subflow-button-primary min-h-12 w-full">
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span aria-live="polite">Simulating payment…</span>
                </>
              ) : (
                <>
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  Confirm demo payment · {formatINR(summary.pricing.total)}
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-500">Demo Mode — No Real Money Charged</p>
          </form>

          <aside className="h-fit rounded-2xl border border-[#dfe7e3] bg-[#faf8f4] p-5 sm:p-6" aria-labelledby="order-summary-heading">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="subflow-section-label">Order summary</p>
                <h2 id="order-summary-heading" className="editorial-heading mt-2 text-2xl">{summary.plan.name}</h2>
              </div>
              <ShieldCheck className="h-6 w-6 shrink-0 text-[#2f6a52]" aria-label="Secure demo checkout" />
            </div>
            {summary.plan.description && <p className="mt-2 text-sm leading-6 text-slate-600">{summary.plan.description}</p>}
            <div className="mt-5 inline-flex rounded-full border border-[#dfeae5] bg-[#edf3f1] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#173b32]">
              Billed {summary.plan.billingFrequency.toLowerCase()}
            </div>

            <dl className="mt-6 space-y-3 border-t border-[#dfe7e3] pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Plan price</dt>
                <dd className="font-mono font-medium text-slate-900">{formatINR(summary.pricing.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">{summary.pricing.taxName} ({summary.pricing.taxRate}%)</dt>
                <dd className="font-mono font-medium text-slate-900">{formatINR(summary.pricing.taxAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[#dfe7e3] pt-4 text-base">
                <dt className="font-semibold text-slate-900">Total payable</dt>
                <dd className="font-mono text-lg font-bold text-[#173b32]">{formatINR(summary.pricing.total)}</dd>
              </div>
            </dl>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#dfe7e3] bg-white/75 p-4 text-xs leading-5 text-slate-600">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#173b32]" aria-hidden="true" />
              <p>For demonstration only. No bank is contacted, no real money moves, and no card numbers or security codes are collected.</p>
            </div>
          </aside>
        </div>
      </header>
    </div>
  );
};

export const CustomerCheckoutSuccessPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result = (location.state as CheckoutResult | null) || (() => {
    try {
      return JSON.parse(sessionStorage.getItem('subflow-demo-checkout-result') || 'null') as CheckoutResult | null;
    } catch {
      return null;
    }
  })();

  if (!result?.subscriptionId || !result.invoiceId) {
    return (
      <section className="subflow-shell mx-auto max-w-2xl p-8">
        <h1 className="editorial-heading text-3xl">No completed demo payment found</h1>
        <p className="mt-3 text-sm text-slate-600">Choose a plan to start a new demo checkout.</p>
        <Link to="/portal/plans" className="subflow-button-primary mt-6">Browse plans</Link>
      </section>
    );
  }

  return (
    <section className="subflow-shell mx-auto max-w-3xl overflow-hidden" aria-labelledby="payment-success-title">
      <div className="bg-[#173b32] px-6 py-10 text-center text-white sm:px-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#d4e5dc]">Demo transaction complete</p>
        <h1 id="payment-success-title" className="editorial-heading mt-2 text-4xl text-white sm:text-5xl">Payment Successful</h1>
        <p className="mt-3 text-sm text-white/80">Your subscription is active. No real money was charged.</p>
      </div>

      <div className="p-6 sm:p-9">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Plan', result.planName],
            ['Amount', formatINR(result.amount)],
            ['Transaction reference', result.transactionReference],
            ['Subscription reference', result.subscriptionNumber],
            ['Status', result.status],
            ['Date and time', new Date(result.paymentDate).toLocaleString('en-IN')],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[#dfe7e3] bg-white/70 p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => navigate('/portal/subscriptions')} className="subflow-button-primary min-h-11 flex-1">
            View My Subscription <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate('/portal/invoices')} className="subflow-button-secondary min-h-11 flex-1">
            View Invoice <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">Invoice {result.invoiceNumber} is available in your invoice list.</p>
      </div>
    </section>
  );
};
