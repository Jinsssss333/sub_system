import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BadgePercent, Boxes, CalendarRange, CreditCard, FileStack, FileText, LayoutDashboard, LogOut, Menu, Receipt, Repeat, Scale, ShieldCheck, User, Users, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cn, StatusBadge } from '../components/ui';
import type { Role } from '../api/types';

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };
type NavGroup = { title?: string; items: NavItem[] };
const icon = (Icon: typeof LayoutDashboard) => <Icon className="h-4 w-4" aria-hidden />;

const operations: NavGroup = {
  title: 'Operations',
  items: [
    { to: '/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard) },
    { to: '/subscriptions', label: 'Subscriptions', icon: icon(Repeat) },
    { to: '/invoices', label: 'Invoices', icon: icon(FileText) },
    { to: '/payments', label: 'Payments', icon: icon(CreditCard) },
    { to: '/customers', label: 'Customers', icon: icon(Users) },
  ],
};
const catalog: NavGroup = {
  title: 'Catalog',
  items: [
    { to: '/catalog/products', label: 'Products', icon: icon(Boxes) },
    { to: '/catalog/plans', label: 'Plans', icon: icon(CalendarRange) },
    { to: '/catalog/templates', label: 'Quote templates', icon: icon(FileStack) },
    { to: '/catalog/discounts', label: 'Discounts', icon: icon(BadgePercent) },
    { to: '/catalog/taxes', label: 'Taxes', icon: icon(Scale) },
  ],
};
const admin: NavGroup = { title: 'Administration', items: [{ to: '/users', label: 'Users & staff', icon: icon(ShieldCheck) }] };
const portal: NavGroup = {
  items: [
    { to: '/portal', label: 'Overview', icon: icon(LayoutDashboard), end: true },
    { to: '/portal/invoices', label: 'My invoices', icon: icon(Receipt) },
    { to: '/portal/profile', label: 'Profile', icon: icon(User) },
  ],
};

const navFor = (role: Role): NavGroup[] => (role === 'CUSTOMER' ? [portal] : role === 'ADMIN' ? [operations, catalog, admin] : [operations, { ...catalog, items: catalog.items.filter((i) => i.to !== '/catalog/taxes') }]);

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
          <circle cx="12" cy="12" r="6.5" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">Brightloop</span>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {navFor(user.role).map((group, index) => (
          <div key={group.title ?? index}>
            {group.title && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{user.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-pop">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {user && <StatusBadge status={user.role} />}
            <span className="hidden text-sm text-slate-600 sm:inline">{user?.customer?.companyName ?? user?.name}</span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
