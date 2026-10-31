import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  CreditCard,
  Search,
  Plus,
  Loader2,
  CheckCircle,
  X,
} from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    invoiceId: '',
    paymentMethod: 'UPI',
    amount: '',
    transactionReference: '',
    notes: '',
  });

  const { isCustomer } = useAuth();
  const { success, error } = useToast();

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payments');
      setPayments(res.data.data);
    } catch (err: any) {
      error(err.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleInvoices = async () => {
    try {
      const res = await api.get('/invoices');
      const unpaid = (res.data.data || []).filter((i: any) => i.outstandingBalance > 0);
      setInvoices(unpaid);
      if (unpaid.length > 0 && !form.invoiceId) {
        setForm((prev) => ({
          ...prev,
          invoiceId: unpaid[0].id,
          amount: String(unpaid[0].outstandingBalance),
          transactionReference: `TX-${Date.now().toString().slice(-6)}`,
        }));
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const openRecordModal = () => {
    fetchEligibleInvoices();
    setIsModalOpen(true);
  };

  const handleInvoiceSelect = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    setForm((prev) => ({
      ...prev,
      invoiceId: id,
      amount: inv ? String(inv.outstandingBalance) : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amt = parseFloat(form.amount);
      await api.post('/payments', {
        ...form,
        amount: amt,
      });
      success(`Payment of ₹${amt.toFixed(2)} recorded.`);
      setIsModalOpen(false);
      fetchPayments();
    } catch (err: any) {
      error(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Payments Ledger & Collections
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete transaction record across UPI, NEFT bank transfers, and cards
          </p>
        </div>

        {!isCustomer && (
          <button
            onClick={openRecordModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {/* Payments Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No payments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Payment #</th>
                  <th className="py-3.5 px-4">Invoice Ref</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Channel</th>
                  <th className="py-3.5 px-4">Tx Reference</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Audited By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {p.paymentNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-indigo-600 font-semibold">
                      {p.invoice?.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {p.customer.companyName || p.customer.user.name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700 text-[10px]">
                        {p.paymentMethod.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                      {p.transactionReference}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-emerald-600">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {p.recordedBy?.name || 'System Scheduler'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Record Payment</h2>
                <p className="text-[11px] text-slate-500">Post transaction against an open invoice</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Open Invoice *</label>
                <select
                  required
                  value={form.invoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="">Select Invoice...</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.customer.companyName || inv.customer.user.name} (Due: ₹{inv.outstandingBalance})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="500.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-indigo-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transaction Reference *</label>
                <input
                  type="text"
                  required
                  value={form.transactionReference}
                  onChange={(e) => setForm({ ...form, transactionReference: e.target.value.toUpperCase() })}
                  placeholder="e.g. TX-UPI-99201"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Payment receipt note..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
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
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
