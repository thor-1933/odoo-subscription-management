import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  FileText,
  Search,
  Download,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  X,
} from 'lucide-react';

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Payment Modal State
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'UPI',
    amount: '',
    transactionReference: '',
    notes: '',
  });
  const [recordingPayment, setRecordingPayment] = useState(false);

  const { isCustomer } = useAuth();
  const { success, error } = useToast();

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (overdueOnly) params.overdue = 'true';
      if (search) params.search = search;

      const res = await api.get('/invoices', { params });
      setInvoices(res.data.data);
    } catch (err: any) {
      error(err.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, overdueOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleDownloadPDF = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice-${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      success(`Invoice ${invoiceNumber} downloaded`);
    } catch (err: any) {
      error(err.message || 'PDF download failed');
    }
  };

  const openPaymentModal = (invoice: any) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentForm({
      paymentMethod: 'UPI',
      amount: String(invoice.outstandingBalance),
      transactionReference: `TX-${Date.now().toString().slice(-6)}`,
      notes: '',
    });
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    try {
      setRecordingPayment(true);
      const amount = parseFloat(paymentForm.amount);
      if (isNaN(amount) || amount <= 0) {
        error('Please specify a positive payment amount.');
        return;
      }

      await api.post('/payments', {
        invoiceId: selectedInvoiceForPayment.id,
        paymentMethod: paymentForm.paymentMethod,
        amount,
        transactionReference: paymentForm.transactionReference,
        notes: paymentForm.notes,
      });

      success(`Payment of ₹${amount.toFixed(2)} recorded successfully.`);
      setSelectedInvoiceForPayment(null);
      fetchInvoices();
    } catch (err: any) {
      error(err.message || 'Payment recording failed.');
    } finally {
      setRecordingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Invoices & Accounts Receivable
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated recurring invoices, payment reconciliation, and downloadable PDFs
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, customer name, company..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-2 text-xs">
          {['', 'CONFIRMED', 'PAID', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setOverdueOnly(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === s && !overdueOnly
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {s || 'All Invoices'}
            </button>
          ))}

          <button
            onClick={() => {
              setOverdueOnly(!overdueOnly);
              setStatusFilter('');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              overdueOnly
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue Only</span>
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No invoices found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Invoice Date</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Grand Total</th>
                  <th className="py-3.5 px-4">Balance Due</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invoices.map((inv) => {
                  const isOverdue =
                    inv.status !== 'PAID' && new Date(inv.dueDate) < new Date();

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {inv.customer.companyName || inv.customer.user.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {inv.subscription?.subscriptionNumber || 'Direct Invoice'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(inv.invoiceDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={isOverdue ? 'font-bold text-rose-600' : 'text-slate-600'}>
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </span>
                        {isOverdue && (
                          <span className="ml-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-1 rounded">
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        ₹{inv.grandTotal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold">
                        {inv.outstandingBalance > 0 ? (
                          <span className="text-rose-600">
                            ₹{inv.outstandingBalance.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-emerald-600">₹0.00</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isOverdue
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {isOverdue ? 'OVERDUE' : inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* PDF Download Button */}
                          <button
                            onClick={() => handleDownloadPDF(inv.id, inv.invoiceNumber)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Record Payment Button (Requirement 13) */}
                          {!isCustomer && inv.outstandingBalance > 0 && inv.status !== 'CANCELLED' && (
                            <button
                              onClick={() => openPaymentModal(inv)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-all"
                              title="Record Payment"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Record Pay</span>
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

      {/* RECORD PAYMENT MODAL (Requirement 13) */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Record Payment for {selectedInvoiceForPayment.invoiceNumber}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Customer: {selectedInvoiceForPayment.customer.companyName || selectedInvoiceForPayment.customer.user.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoiceForPayment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl mb-4 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-500">Outstanding Balance:</span>
                <p className="text-base font-extrabold text-indigo-900">
                  ₹{selectedInvoiceForPayment.outstandingBalance.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Grand Total:</span>
                <p className="font-bold text-slate-800">
                  ₹{selectedInvoiceForPayment.grandTotal.toFixed(2)}
                </p>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other Enterprise Settlement</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={selectedInvoiceForPayment.outstandingBalance}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="e.g. 1000.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-indigo-700"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Support partial or full payment up to ₹{selectedInvoiceForPayment.outstandingBalance.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transaction Reference *</label>
                <input
                  type="text"
                  required
                  value={paymentForm.transactionReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                  placeholder="e.g. UPI-99881122 or NEFT-HDFC-001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Ledger Remarks</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Reference invoice month, payment voucher #..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {recordingPayment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
