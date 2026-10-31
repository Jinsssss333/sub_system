import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { forgotPasswordBody, loginBody, PASSWORD_MESSAGE, passwordSchema, signupBody } from '@brightloop/shared';
import { api, One } from '../../api/client';
import { Button, Field, FormError, Input } from '../../components/ui';
import { homeFor, useAuth } from '../../lib/auth';
import { applyServerErrors } from '../../lib/forms';
import { typedResolver } from '../../lib/forms';

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary-700 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18),transparent_55%)]" aria-hidden />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full border-[48px] border-white/10" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                <circle cx="12" cy="12" r="6.5" />
              </svg>
            </span>
            <span className="text-lg font-semibold tracking-tight">Brightloop</span>
          </div>
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">Recurring billing that adds up, every cycle.</h2>
            <ul className="mt-8 space-y-4 text-sm text-primary-50">
              {[
                'Quotes to active subscriptions with a strict lifecycle',
                'Invoices generated once per period, priced to the paisa',
                'Payments reconciled safely, with live receivables',
              ].map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-200" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-primary-200">Runs fully offline on your laptop: PostgreSQL, local mail, no cloud services.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                <circle cx="12" cy="12" r="6.5" />
              </svg>
            </span>
            <span className="font-semibold">Brightloop</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

const DEMO = [
  { role: 'Admin', email: 'admin@brightloop.test', password: 'Admin@1234' },
  { role: 'Staff', email: 'staff@brightloop.test', password: 'Staff@1234' },
  { role: 'Customer', email: 'customer@brightloop.test', password: 'Customer@1234' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [error, setError] = useState<unknown>(null);
  const form = useForm<z.infer<typeof loginBody>>({ resolver: typedResolver(loginBody), defaultValues: { email: '', password: '' } });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      navigate(location.state?.from ?? homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err);
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to manage subscriptions and billing."
      footer={
        <>
          New customer?{' '}
          <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-700">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError error={error} />
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!form.formState.errors.email} {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" invalid={!!form.formState.errors.password} {...form.register('password')} />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO.map((demo) => (
            <Button
              key={demo.role}
              variant="secondary"
              size="sm"
              onClick={() => {
                form.setValue('email', demo.email);
                form.setValue('password', demo.password);
                void submit();
              }}
            >
              {demo.role}
            </Button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}

const signupForm = signupBody.extend({ confirm: z.string() }).refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export function SignupPage() {
  const { acceptSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const form = useForm<z.input<typeof signupForm>>({ resolver: typedResolver(signupForm), defaultValues: { name: '', email: '', password: '', confirm: '', companyName: '', phone: '' } });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ confirm: _confirm, ...values }) => {
    setError(null);
    try {
      const res = await api.post<One<{ token: string }>>('/auth/signup', values);
      await acceptSession(res.data.token);
      navigate('/portal', { replace: true });
    } catch (err) {
      if (!applyServerErrors(err, form.setError)) setError(err);
    }
  });

  return (
    <AuthLayout title="Create your account" subtitle="Customers can view subscriptions, invoices and payments." footer={<>Already have an account? <Link to="/login" className="font-medium text-primary-600">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError error={error} />
        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Company (optional)" htmlFor="companyName" error={errors.companyName?.message}>
          <Input id="companyName" autoComplete="organization" {...form.register('companyName')} />
        </Field>
        <Field label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint={PASSWORD_MESSAGE}>
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...form.register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...form.register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<z.infer<typeof forgotPasswordBody>>({ resolver: typedResolver(forgotPasswordBody), defaultValues: { email: '' } });
  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post('/auth/forgot-password', values);
      setSent(true);
    } catch (err) {
      setError(err);
    }
  });
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link that works once and expires in 30 minutes." footer={<Link to="/login" className="font-medium text-primary-600">Back to sign in</Link>}>
      {sent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <MailCheck className="mb-2 h-5 w-5" aria-hidden />
          If that email is registered, a reset link is on its way. In local development, open Mailpit at{' '}
          <a href="http://localhost:8025" className="font-medium underline" target="_blank" rel="noreferrer">
            localhost:8025
          </a>
          .
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormError error={error} />
          <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" invalid={!!form.formState.errors.email} {...form.register('email')} />
          </Field>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

const resetForm = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<z.infer<typeof resetForm>>({ resolver: typedResolver(resetForm), defaultValues: { password: '', confirm: '' } });
  const submit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err);
    }
  });
  return (
    <AuthLayout title="Choose a new password" subtitle={PASSWORD_MESSAGE} footer={<Link to="/login" className="font-medium text-primary-600">Back to sign in</Link>}>
      {done ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Your password was updated.</div>
          <Link to="/login" className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700">
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {!token && <FormError error={new Error('This reset link is missing its token. Request a new one.')} />}
          <FormError error={error} />
          <Field label="New password" htmlFor="password" error={form.formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" invalid={!!form.formState.errors.password} {...form.register('password')} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={form.formState.errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" invalid={!!form.formState.errors.confirm} {...form.register('confirm')} />
          </Field>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting} disabled={!token}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
