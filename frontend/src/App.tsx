import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  Package, 
  CreditCard, 
  FileText, 
  BarChart3, 
  ShieldCheck, 
  CheckCircle2,
  Receipt
} from 'lucide-react';

export function App() {
  const [currentRole, setCurrentRole] = useState<'ADMIN' | 'STAFF' | 'CUSTOMER'>('ADMIN');

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-primary-600 p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide">BRIGHTLOOP</h1>
            <p className="text-xs text-slate-400">Subscription Engine</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {currentRole === 'ADMIN' && (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Admin Panel</div>
              <a href="#catalog" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
                <Package className="w-4 h-4" /> Products & Plans
              </a>
              <a href="#users" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm">
                <Users className="w-4 h-4" /> Staff & Users
              </a>
              <a href="#finance" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm">
                <BarChart3 className="w-4 h-4" /> Finance Dashboard
              </a>
            </>
          )}

          {currentRole === 'STAFF' && (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Operations</div>
              <a href="#subscriptions" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
                <FileText className="w-4 h-4" /> Subscriptions
              </a>
              <a href="#invoices" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm">
                <Receipt className="w-4 h-4" /> Invoices & Billing
              </a>
              <a href="#payments" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm">
                <CreditCard className="w-4 h-4" /> Payments
              </a>
            </>
          )}

          {currentRole === 'CUSTOMER' && (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Customer Portal</div>
              <a href="#my-subs" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
                <FileText className="w-4 h-4" /> My Subscriptions
              </a>
              <a href="#my-invoices" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm">
                <Receipt className="w-4 h-4" /> My Invoices
              </a>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
          Odoo Hackathon 2026 Edition
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar with Demo Role Switcher */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700">Role View:</span>
            <span className="font-semibold text-sm bg-slate-100 text-slate-800 px-2 py-0.5 rounded border">
              {currentRole}
            </span>
          </div>

          {/* Quick Role Switcher for Hackathon Judges */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 mr-2 font-medium">Switch View:</span>
            <button
              onClick={() => setCurrentRole('ADMIN')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                currentRole === 'ADMIN' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => setCurrentRole('STAFF')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                currentRole === 'STAFF' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Staff
            </button>
            <button
              onClick={() => setCurrentRole('CUSTOMER')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                currentRole === 'CUSTOMER' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Customer
            </button>
          </div>
        </header>

        {/* Workspace Placeholder */}
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center gap-3 text-emerald-600 mb-4">
                <CheckCircle2 className="w-8 h-8" />
                <h2 className="text-2xl font-bold text-slate-900">Foundation Ready for 4-Person Sprint</h2>
              </div>
              <p className="text-slate-600 mb-6">
                The core monorepo, Docker PostgreSQL environment, Prisma database schema, and frontend layout are now set up on the <code className="bg-slate-100 px-2 py-1 rounded text-primary-600 font-mono text-sm">dev</code> branch.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="font-semibold text-slate-800 mb-1">🧑‍💻 Person 1 & 2 (Backend Team)</div>
                  <p className="text-slate-600 text-xs mb-2">Branches: <code className="text-indigo-600">feature/db-auth</code> & <code className="text-indigo-600">feature/billing-engine</code></p>
                  <p className="text-slate-500 text-xs">Run <code className="bg-white px-1 border rounded">docker compose up -d</code> then migrate & seed DB.</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="font-semibold text-slate-800 mb-1">🎨 Person 3 & 4 (Frontend Team)</div>
                  <p className="text-slate-600 text-xs mb-2">Branches: <code className="text-indigo-600">feature/admin-frontend</code> & <code className="text-indigo-600">feature/portal-and-dashboard</code></p>
                  <p className="text-slate-500 text-xs">Build out Admin Catalog/Subscriptions and Customer Portal/Finance Dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
