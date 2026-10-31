import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Package,
  Plus,
  Search,
  Layers,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [activeProductForVariant, setActiveProductForVariant] = useState<any>(null);

  // Product Form state
  const [productForm, setProductForm] = useState({
    code: '',
    name: '',
    type: 'SERVICE',
    basePrice: '',
    costPrice: '',
    description: '',
    isActive: true,
  });

  // Variant Form state
  const [variantForm, setVariantForm] = useState({
    name: '',
    sku: '',
    priceAdjustment: '',
  });

  const { isAdmin } = useAuth();
  const { success, error } = useToast();

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const res = await api.get('/products', { params });
      setProducts(res.data.data);
    } catch (err: any) {
      error(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const openCreateModal = () => {
    setSelectedProduct(null);
    setProductForm({
      code: '',
      name: '',
      type: 'SOFTWARE',
      basePrice: '',
      costPrice: '',
      description: '',
      isActive: true,
    });
    setIsProductModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setSelectedProduct(p);
    setProductForm({
      code: p.code,
      name: p.name,
      type: p.type,
      basePrice: String(p.basePrice),
      costPrice: String(p.costPrice),
      description: p.description || '',
      isActive: p.isActive,
    });
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...productForm,
        basePrice: parseFloat(productForm.basePrice),
        costPrice: parseFloat(productForm.costPrice || '0'),
      };

      if (selectedProduct) {
        await api.put(`/products/${selectedProduct.id}`, payload);
        success('Product updated successfully');
      } else {
        await api.post('/products', payload);
        success('Product created successfully');
      }
      setIsProductModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      error(err.message || 'Product save failed');
    }
  };

  const handleArchiveProduct = async (id: string) => {
    if (!confirm('Are you sure you want to archive this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      success('Product archived');
      fetchProducts();
    } catch (err: any) {
      error(err.message || 'Archive failed');
    }
  };

  // Variants modal
  const openVariantModal = (product: any) => {
    setActiveProductForVariant(product);
    setVariantForm({ name: '', sku: '', priceAdjustment: '' });
    setIsVariantModalOpen(true);
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/products/variants', {
        productId: activeProductForVariant.id,
        name: variantForm.name,
        sku: variantForm.sku,
        priceAdjustment: parseFloat(variantForm.priceAdjustment || '0'),
      });
      success('Product variant created');
      setVariantForm({ name: '', sku: '', priceAdjustment: '' });
      // Refresh current product's variants
      const updated = await api.get(`/products/${activeProductForVariant.id}`);
      setActiveProductForVariant(updated.data.data);
      fetchProducts();
    } catch (err: any) {
      error(err.message || 'Variant creation failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Product & Variant Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage subscription software, service lines, and configured pricing variants
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Product</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by code, name, description..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none"
        >
          <option value="">All Product Types</option>
          <option value="SOFTWARE">Software / Cloud ERP</option>
          <option value="SERVICE">Professional Service</option>
          <option value="DIGITAL">Digital Engine / API</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No products match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Code / Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Base Price</th>
                  <th className="py-3.5 px-4">Configured Variants</th>
                  <th className="py-3.5 px-4">Status</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.code}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700 text-[10px]">
                        {p.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ₹{p.basePrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(p.variants || []).length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">No variants</span>
                        ) : (
                          p.variants.map((v: any) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium text-[11px]"
                            >
                              <span>{v.name}</span>
                              <strong className="text-indigo-900">
                                (₹{(p.basePrice + v.priceAdjustment).toLocaleString('en-IN')})
                              </strong>
                            </span>
                          ))
                        )}
                        <button
                          onClick={() => openVariantModal(p)}
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Configure Variants"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {p.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> Archived
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchiveProduct(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Archive Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {selectedProduct ? 'Edit Product' : 'Create New Product'}
              </h2>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Code *</label>
                  <input
                    type="text"
                    required
                    value={productForm.code}
                    onChange={(e) => setProductForm({ ...productForm, code: e.target.value.toUpperCase() })}
                    placeholder="PRD-BIZ-ERP"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Type</label>
                  <select
                    value={productForm.type}
                    onChange={(e) => setProductForm({ ...productForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="SOFTWARE">Software / Cloud App</option>
                    <option value="SERVICE">Professional Service</option>
                    <option value="DIGITAL">Digital Engine / API</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Brightloop Business Software"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.basePrice}
                    onChange={(e) => setProductForm({ ...productForm, basePrice: e.target.value })}
                    placeholder="1000.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Internal Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.costPrice}
                    onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                    placeholder="250.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Feature highlights, SLA terms, tier details..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIGURE VARIANTS MODAL */}
      {isVariantModalOpen && activeProductForVariant && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Configure Variants for {activeProductForVariant.name}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Base Price: <strong>₹{activeProductForVariant.basePrice.toLocaleString('en-IN')}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsVariantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Existing Variants List */}
            <div className="mb-4 space-y-2">
              <label className="block text-xs font-bold text-slate-700">Existing Variants</label>
              {(activeProductForVariant.variants || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No variants added yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {activeProductForVariant.variants.map((v: any) => {
                    const effectivePrice = activeProductForVariant.basePrice + v.priceAdjustment;
                    return (
                      <div key={v.id} className="p-3 flex items-center justify-between bg-slate-50/50">
                        <div>
                          <p className="font-bold text-slate-900">{v.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">SKU: {v.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-indigo-700">
                            Effective: ₹{effectivePrice.toLocaleString('en-IN')}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            ({v.priceAdjustment >= 0 ? `+₹${v.priceAdjustment}` : `-₹${Math.abs(v.priceAdjustment)}`} adjustment)
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add New Variant Form (Example: Odoo brand +₹560 -> ₹1,560) */}
            {isAdmin && (
              <form onSubmit={handleAddVariant} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <p className="font-bold text-slate-700">Add Variant</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 mb-0.5">Variant Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Odoo brand"
                      value={variantForm.name}
                      onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">SKU *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BIZ-ODOO"
                      value={variantForm.sku}
                      onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white uppercase font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-0.5">Price Adjustment (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="+560"
                    value={variantForm.priceAdjustment}
                    onChange={(e) => setVariantForm({ ...variantForm, priceAdjustment: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-indigo-600"
                  />
                  {variantForm.priceAdjustment && (
                    <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                      Calculated Final Price: ₹
                      {(
                        activeProductForVariant.basePrice + parseFloat(variantForm.priceAdjustment || '0')
                      ).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                  >
                    Add Variant
                  </button>
                </div>
              </form>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
