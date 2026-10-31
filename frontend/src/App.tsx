import { useState } from 'react';
import { 
  Building2, 
  Package, 
  FileText, 
  BarChart3, 
  ShieldCheck, 
  Receipt,
  Layers,
  Tag,
  Sparkles
} from 'lucide-react';

import { ProductsPage } from './pages/admin/ProductsPage';
import { PlansPage } from './pages/admin/PlansPage';
import { DiscountsPage } from './pages/admin/DiscountsPage';
import { SubscriptionsPage } from './pages/staff/SubscriptionsPage';
import { InvoicesPage } from './pages/staff/InvoicesPage';
import { CustomerPortal } from './pages/customer/CustomerPortal';
import { FinanceDashboard } from './pages/finance/FinanceDashboard';

export function App() {
  const [currentRole, setCurrentRole] = useState<'ADMIN' | 'STAFF' | 'CUSTOMER'>('ADMIN');
  const [activeTab, setActiveTab] = useState<string>('products');

  // Handle Role Switching and reset to default page of that role
  const handleRoleSwitch = (role: 'ADMIN' | 'STAFF' | 'CUSTOMER') => {
    setCurrentRole(role);
    if (role === 'ADMIN') setActiveTab('products');
    if (role === 'STAFF') setActiveTab('subscriptions');
    if (role === 'CUSTOMER') setActiveTab('portal');
  };

  const roleUserMap = {
    ADMIN: { name: 'System Administrator', email: 'admin@brightloop.test' },
    STAFF: { name: 'Operations Staff', email: 'staff@brightloop.test' },
    CUSTOMER: { name: 'Acme Retail Corp', email: 'customer@brightloop.test' },
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden">
      
      {/* Sidebar */}
      <aside className="no-print w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 z-20 border-r border-slate-800">
        
        {/* Brand Logo & Name */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-indigo-500 p-2.5 rounded-xl shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide text-white">BRIGHTLOOP</h1>
            <p className="text-[11px] text-indigo-400 font-medium">Subscription Platform</p>
          </div>
        </div>

        {/* Dynamic Navigation per Role */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {currentRole === 'ADMIN' && (
            <>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Catalog & Config
              </div>
              <button
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'products'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Package className="w-4 h-4" /> Products & Variants
              </button>
              <button
                onClick={() => setActiveTab('plans')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'plans'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" /> Subscription Plans
              </button>
              <button
                onClick={() => setActiveTab('discounts')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'discounts'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Tag className="w-4 h-4" /> Discounts & Taxes
              </button>

              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mt-5 mb-2">
                Executive
              </div>
              <button
                onClick={() => setActiveTab('finance')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'finance'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Finance Dashboard
              </button>
            </>
          )}

          {currentRole === 'STAFF' && (
            <>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Operations
              </div>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'subscriptions'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" /> Subscriptions Lifecycle
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'invoices'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Receipt className="w-4 h-4" /> Invoices & Billing
              </button>
            </>
          )}

          {currentRole === 'CUSTOMER' && (
            <>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Client Portal
              </div>
              <button
                onClick={() => setActiveTab('portal')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'portal'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" /> My Account & Invoices
              </button>
            </>
          )}
        </nav>

        {/* User Card in Sidebar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-300 border border-slate-700">
              {currentRole[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-200 truncate">{roleUserMap[currentRole].name}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{roleUserMap[currentRole].email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Topbar with Live Role Switcher */}
        <header className="no-print h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Perspective:</span>
              <span className="font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                {currentRole} VIEW
              </span>
            </div>
          </div>

          {/* Quick Role Switcher for Hackathon Judges */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Demo Role Switcher:
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => handleRoleSwitch('ADMIN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentRole === 'ADMIN'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => handleRoleSwitch('STAFF')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentRole === 'STAFF'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Staff
              </button>
              <button
                onClick={() => handleRoleSwitch('CUSTOMER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentRole === 'CUSTOMER'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Customer
              </button>
            </div>
          </div>
        </header>

        {/* View Content Area */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Admin Pages */}
            {currentRole === 'ADMIN' && activeTab === 'products' && <ProductsPage />}
            {currentRole === 'ADMIN' && activeTab === 'plans' && <PlansPage />}
            {currentRole === 'ADMIN' && activeTab === 'discounts' && <DiscountsPage />}
            {currentRole === 'ADMIN' && activeTab === 'finance' && <FinanceDashboard />}

            {/* Staff Pages */}
            {currentRole === 'STAFF' && activeTab === 'subscriptions' && <SubscriptionsPage />}
            {currentRole === 'STAFF' && activeTab === 'invoices' && <InvoicesPage />}

            {/* Customer Portal */}
            {currentRole === 'CUSTOMER' && <CustomerPortal />}
          </div>
        </main>
      </div>

    </div>
  );
}

export default App;
