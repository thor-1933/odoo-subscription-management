import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  X,
  FileCheck,
} from 'lucide-react';

export const QuotationsPage: React.FC = () => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerId: '',
    planId: '',
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    terms: 'Net 15 days upon invoice issuance.',
    notes: '',
    couponCode: '',
    lines: [
      {
        productId: '',
        variantId: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 18,
      },
    ],
  });

  const { isCustomer } = useAuth();
  const { success, error, info } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;

      const [qRes, cRes, pRes, plRes, tRes] = await Promise.all([
        api.get('/quotations', { params }),
        api.get('/customers').catch(() => ({ data: { data: [] } })),
        api.get('/products'),
        api.get('/plans'),
        api.get('/taxes').catch(() => ({ data: { data: [] } })),
      ]);

      setQuotations(qRes.data.data);
      setCustomers(cRes.data.data || []);
      setProducts(pRes.data.data || []);
      setPlans(plRes.data.data || []);
      setTaxes(tRes.data.data || []);
    } catch (err: any) {
      error(err.message || 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          productId: products[0]?.id || '',
          variantId: '',
          quantity: 1,
          unitPrice: products[0]?.basePrice || 0,
          taxRate: 18,
        },
      ],
    }));
  };

  const removeLine = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  const handleProductChange = (idx: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    const updated = [...formData.lines];
    updated[idx].productId = productId;
    updated[idx].variantId = '';
    updated[idx].unitPrice = prod ? prod.basePrice : 0;
    setFormData({ ...formData, lines: updated });
  };

  const handleVariantChange = (idx: number, variantId: string) => {
    const updated = [...formData.lines];
    const prod = products.find((p) => p.id === updated[idx].productId);
    updated[idx].variantId = variantId;

    if (prod) {
      let price = prod.basePrice;
      if (variantId) {
        const variant = prod.variants.find((v: any) => v.id === variantId);
        if (variant) price += variant.priceAdjustment;
      }
      updated[idx].unitPrice = price;
    }
    setFormData({ ...formData, lines: updated });
  };

  const handleLineValueChange = (idx: number, field: string, value: any) => {
    const updated = [...formData.lines];
    (updated[idx] as any)[field] = value;
    setFormData({ ...formData, lines: updated });
  };

  // Live total computation in form
  const computedSubtotal = formData.lines.reduce(
    (acc, l) => acc + (l.unitPrice || 0) * (l.quantity || 1),
    0
  );
  const computedTax = formData.lines.reduce(
    (acc, l) => acc + (((l.unitPrice || 0) * (l.quantity || 1) * (l.taxRate || 0)) / 100),
    0
  );
  const computedGrandTotal = computedSubtotal + computedTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.planId) {
      error('Please select customer and target subscription plan.');
      return;
    }

    try {
      await api.post('/quotations', formData);
      success('Quotation generated successfully');
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Quotation creation failed');
    }
  };

  const handleConvertToSubscription = async (id: string) => {
    try {
      setConvertingId(id);
      info('Converting accepted quotation into active recurring subscription...');
      const res = await api.post(`/quotations/${id}/convert`);
      success(`Successfully activated subscription: ${res.data.data.subscriptionNumber}`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Conversion failed.');
    } finally {
      setConvertingId(null);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.patch(`/quotations/${id}/status`, { status });
      success(`Quotation marked as ${status}`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Status update failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Quotations & Estimates
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build multi-item price estimates, apply coupon codes, and convert to active contracts
          </p>
        </div>

        {!isCustomer && (
          <button
            onClick={() => {
              if (customers.length > 0) formData.customerId = customers[0].id;
              if (plans.length > 0) formData.planId = plans[0].id;
              if (products.length > 0) {
                formData.lines[0].productId = products[0].id;
                formData.lines[0].unitPrice = products[0].basePrice;
              }
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Draft Quotation</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        {['', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              statusFilter === s
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {s || 'All Statuses'}
          </button>
        ))}
      </div>

      {/* Quotations Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : quotations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No quotations found for the selected view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Quote #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items / Plan</th>
                  <th className="py-3.5 px-4">Grand Total</th>
                  <th className="py-3.5 px-4">Validity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {q.quotationNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {q.customer.companyName || q.customer.user.name}
                      </div>
                      <div className="text-[11px] text-slate-400">{q.customer.user.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800">
                        {q.lines.length} Line Item{q.lines.length > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      ₹{q.grandTotal.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(q.validUntil).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          q.status === 'ACCEPTED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : q.status === 'SENT'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : q.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : q.status === 'EXPIRED'
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Convert to Subscription Button (Requirement 7) */}
                        {!q.convertedSubscriptionId && q.status !== 'REJECTED' && (
                          <button
                            onClick={() => handleConvertToSubscription(q.id)}
                            disabled={convertingId === q.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                            title="Convert into Active Subscription"
                          >
                            {convertingId === q.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <FileCheck className="w-3 h-3" />
                            )}
                            <span>Convert to Sub</span>
                          </button>
                        )}

                        {q.convertedSubscriptionId && (
                          <span className="text-[11px] text-emerald-700 font-semibold px-2 py-0.5 bg-emerald-50 rounded-md">
                            Converted ✔
                          </span>
                        )}

                        {/* Status updater for demo convenience */}
                        {q.status === 'DRAFT' && (
                          <button
                            onClick={() => handleStatusChange(q.id, 'SENT')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
                          >
                            Send
                          </button>
                        )}
                        {q.status === 'SENT' && (
                          <button
                            onClick={() => handleStatusChange(q.id, 'ACCEPTED')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-semibold"
                          >
                            Accept
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE QUOTATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Create New Quotation</h2>
                <p className="text-[11px] text-slate-500">Configure customer, recurring plan, and lines</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer *</label>
                  <select
                    required
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="">Select Customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName || c.user.name} ({c.user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Subscription Plan *</label>
                  <select
                    required
                    value={formData.planId}
                    onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="">Select Plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.billingFrequency} - ₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valid Until *</label>
                  <input
                    type="date"
                    required
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Coupon / Discount Code</label>
                  <input
                    type="text"
                    value={formData.couponCode}
                    onChange={(e) => setFormData({ ...formData, couponCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. EARLYBIRD20 or SAVE500"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase font-mono"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700">Product Line Items</label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {formData.lines.map((line, idx) => {
                    const selectedProd = products.find((p) => p.id === line.productId);
                    const variants = selectedProd?.variants || [];

                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="col-span-4">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Product</label>
                          <select
                            value={line.productId}
                            onChange={(e) => handleProductChange(idx, e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-[11px]"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-3">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Variant</label>
                          <select
                            value={line.variantId}
                            onChange={(e) => handleVariantChange(idx, e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-[11px]"
                          >
                            <option value="">Base (No variant)</option>
                            {variants.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.name} (+₹{v.priceAdjustment})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Unit Price</label>
                          <input
                            type="number"
                            value={line.unitPrice}
                            readOnly
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-slate-50 font-bold text-slate-800 text-[11px]"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleLineValueChange(idx, 'quantity', parseInt(e.target.value || '1', 10))}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-[11px]"
                          />
                        </div>

                        <div className="col-span-1 pt-4 text-center">
                          {formData.lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time calculated summary */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1 text-right">
                <p className="text-slate-600">Subtotal: <strong>₹{computedSubtotal.toFixed(2)}</strong></p>
                <p className="text-slate-600">Estimated Tax (18% GST): <strong>₹{computedTax.toFixed(2)}</strong></p>
                <p className="text-sm font-extrabold text-indigo-900 pt-1 border-t border-indigo-200">
                  Estimated Grand Total: ₹{computedGrandTotal.toFixed(2)}
                </p>
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
                  Create Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
