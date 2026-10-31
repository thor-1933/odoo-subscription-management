import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Repeat,
  FileSpreadsheet,
  FileText,
  CreditCard,
  Package,
  CalendarCheck,
  Users,
  Percent,
  Receipt,
  UserCog,
  ShoppingBag,
  User,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, isAdmin, isCustomer } = useAuth();

  const activeClass =
    'flex items-center gap-3 rounded-xl border border-[#d7dfdb] bg-[#edf3f1] px-3 py-2.5 text-sm font-semibold text-[#173b32] shadow-sm transition-all';
  const inactiveClass =
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-[#f3f7f5] hover:text-[#173b32]';

  if (isCustomer) {
    return (
      <aside className="hidden w-72 shrink-0 border-r border-slate-200/80 bg-white/80 p-4 backdrop-blur-xl lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-6">
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#dfe7e3] bg-[#f4f7f5] px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#173b32] text-sm font-bold text-white shadow-[0_14px_24px_-16px_rgba(23,59,50,0.9)]">
                S
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Portal</p>
                <p className="text-sm font-semibold text-slate-800">Customer Hub</p>
              </div>
            </div>
            <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Customer Portal
            </p>
            <nav className="space-y-1.5">
              <NavLink to="/portal" end className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </NavLink>
              <NavLink to="/portal/subscriptions" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                <Repeat className="w-4 h-4" />
                <span>My Subscriptions</span>
              </NavLink>
              <NavLink to="/portal/plans" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                <ShoppingBag className="w-4 h-4" />
                <span>Available Plans</span>
              </NavLink>
              <NavLink to="/portal/invoices" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                <FileText className="w-4 h-4" />
                <span>My Invoices</span>
              </NavLink>
              <NavLink to="/portal/payments" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                <CreditCard className="w-4 h-4" />
                <span>Payment History</span>
              </NavLink>
              <NavLink to="/portal/profile" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                <User className="w-4 h-4" />
                <span>Account Profile</span>
              </NavLink>
            </nav>
          </div>
        </div>

        <div className="rounded-2xl border border-[#dfe7e3] bg-[#edf3f1] p-3 text-xs text-slate-600">
          <p className="font-semibold text-[#173b32]">Need billing assistance?</p>
          <p className="mt-1">Contact support@brightloop.io</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200/80 bg-white/80 p-4 backdrop-blur-xl lg:flex lg:flex-col lg:justify-between">
      <div className="space-y-6">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#dfe7e3] bg-[#f4f7f5] px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#173b32] text-sm font-bold text-white shadow-[0_14px_24px_-16px_rgba(23,59,50,0.9)]">
            S
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
            <p className="text-sm font-semibold text-slate-800">SubFlow OS</p>
          </div>
        </div>

        <div>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Intelligence
          </p>
          <nav className="space-y-1.5">
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <LayoutDashboard className="w-4 h-4" />
              <span>SaaS Analytics</span>
            </NavLink>
          </nav>
        </div>

        <div>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Revenue & Contracts
          </p>
          <nav className="space-y-1.5">
            <NavLink to="/subscriptions" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <Repeat className="w-4 h-4" />
              <span>Subscriptions</span>
            </NavLink>
            <NavLink to="/quotations" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <FileSpreadsheet className="w-4 h-4" />
              <span>Quotations</span>
            </NavLink>
            <NavLink to="/invoices" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <FileText className="w-4 h-4" />
              <span>Invoices</span>
            </NavLink>
            <NavLink to="/payments" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <CreditCard className="w-4 h-4" />
              <span>Payments</span>
            </NavLink>
          </nav>
        </div>

        <div>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Catalog & Customers
          </p>
          <nav className="space-y-1.5">
            <NavLink to="/products" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <Package className="w-4 h-4" />
              <span>Products & Variants</span>
            </NavLink>
            <NavLink to="/plans" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <CalendarCheck className="w-4 h-4" />
              <span>Subscription Plans</span>
            </NavLink>
            <NavLink to="/customers" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <Users className="w-4 h-4" />
              <span>Customers</span>
            </NavLink>
          </nav>
        </div>

        <div>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Configuration
          </p>
          <nav className="space-y-1.5">
            <NavLink to="/taxes" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <Receipt className="w-4 h-4" />
              <span>Tax Rules</span>
            </NavLink>
            {isAdmin && (
              <>
                <NavLink to="/discounts" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                  <Percent className="w-4 h-4" />
                  <span>Discount Rules</span>
                </NavLink>
                <NavLink to="/users" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                  <UserCog className="w-4 h-4" />
                  <span>Staff & Roles</span>
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </div>

      <div className="rounded-2xl border border-[#dfe7e3] bg-[#edf3f1] p-3 text-xs text-[#173b32]">
        <p className="font-bold">SubFlow Enterprise v1.0</p>
        <p className="mt-1 text-slate-600">Brightloop SaaS Engine</p>
      </div>
    </aside>
  );
};
