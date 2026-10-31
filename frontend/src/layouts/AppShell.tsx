import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BadgePercent, Boxes, CalendarRange, ChevronDown, ChevronRight, CreditCard, FileStack, FileText, LayoutDashboard, LogOut, Menu, Receipt, Repeat, Scale, ShieldCheck, User, Users, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cn, StatusBadge } from '../components/ui';
import type { Role } from '../api/types';

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };
type NavGroup = { title?: string; items: NavItem[] };
const icon = (Icon: typeof LayoutDashboard) => <Icon className="h-[18px] w-[18px]" aria-hidden />;

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
  title: 'My account',
  items: [
    { to: '/portal', label: 'Overview', icon: icon(LayoutDashboard), end: true },
    { to: '/portal/invoices', label: 'My invoices', icon: icon(Receipt) },
    { to: '/portal/profile', label: 'Profile', icon: icon(User) },
  ],
};

const navFor = (role: Role): NavGroup[] => (role === 'CUSTOMER' ? [portal] : role === 'ADMIN' ? [operations, catalog, admin] : [operations, { ...catalog, items: catalog.items.filter((i) => i.to !== '/catalog/taxes') }]);

/** Breadcrumb labels for static path segments. Dynamic ids are rendered by the page itself. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', subscriptions: 'Subscriptions', invoices: 'Invoices', payments: 'Payments', customers: 'Customers',
  catalog: 'Catalog', products: 'Products', plans: 'Plans', templates: 'Quote templates', discounts: 'Discounts', taxes: 'Taxes',
  users: 'Users & staff', portal: 'My account', profile: 'Profile', new: 'New',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', dark ? 'bg-primary-500 text-white' : 'bg-primary-600 text-white')}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
          <path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9" strokeLinecap="round" />
          <path d="M17 4v3.5h-3.5M7 20v-3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cn('text-[15px] font-semibold tracking-tight', dark ? 'text-white' : 'text-slate-900')}>Brightloop</span>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="flex h-full flex-col bg-navy-900 text-slate-300">
      <div className="flex h-14 items-center border-b border-white/10 px-5">
        <Logo dark />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main">
        {navFor(user.role).map((group, index) => (
          <div key={group.title ?? index}>
            {group.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition',
                        isActive ? 'bg-white/10 text-white shadow-[inset_2px_0_0_0_theme(colors.primary.400)]' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                      )
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
      <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-slate-500">
        <p className="font-medium text-slate-400">{user.customer?.companyName ?? 'Brightloop Software'}</p>
        <p>Local-first billing · PostgreSQL</p>
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = parts.map((part, i) => ({ label: UUID.test(part) ? 'Detail' : SEGMENT_LABELS[part] ?? part, to: '/' + parts.slice(0, i + 1).join('/'), last: i === parts.length - 1 }));
  // "catalog" has no index page; never link it.
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center text-sm sm:flex">
      <ol className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((c, i) => (
          <li key={c.to} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />}
            {c.last || parts[i] === 'catalog' ? (
              <span className={cn('truncate', c.last ? 'font-medium text-slate-900' : 'text-slate-500')} aria-current={c.last ? 'page' : undefined}>{c.label}</span>
            ) : (
              <Link to={c.to} className="truncate text-slate-500 hover:text-slate-900">{c.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  if (!user) return null;
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 text-left hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">{initials}</span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight text-slate-900">{user.name}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{user.role === 'ADMIN' ? 'Administrator' : user.role === 'STAFF' ? 'Staff' : 'Customer'}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg bg-white shadow-menu">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <div className="mt-2"><StatusBadge status={user.role} /></div>
          </div>
          {user.role === 'CUSTOMER' && (
            <Link to="/portal/profile" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <User className="h-4 w-4 text-slate-400" aria-hidden /> Profile
            </Link>
          )}
          <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <LogOut className="h-4 w-4 text-slate-400" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-pop">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 z-10 rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <button onClick={() => setOpen(true)} className="-ml-2 rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Logo className="lg:hidden" />
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
