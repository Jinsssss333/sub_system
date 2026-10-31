import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileStack, PenLine, Plus, Trash2 } from 'lucide-react';
import { LIMITS } from '@brightloop/shared';
import { api, One, Page } from '../../api/client';
import type { Customer, Discount, Plan, Product, Subscription, Tax, Template } from '../../api/types';
import { Button, Card, cn, Field, FormError, Input, PageHeader, Select } from '../../components/ui';
import { useToast } from '../../components/toast';
import { applyServerErrors, intField } from '../../lib/forms';
import { typedResolver } from '../../lib/forms';
import { bpsToPercent, formatINR, periodLabel, todayIso } from '../../lib/format';

const lineSchema = z.object({ productId: z.string().uuid('Choose a product'), variantId: z.string().optional(), quantity: intField('Quantity'), taxId: z.string().optional() });
const formSchema = z
  .object({
    mode: z.enum(['manual', 'template']),
    customerId: z.string().uuid('Choose a customer'),
    templateId: z.string().optional(),
    planId: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date'),
    expiryDate: z.string().optional(),
    paymentTermDays: intField('Payment terms', 0, 365),
    lines: z.array(lineSchema).max(LIMITS.MAX_LINES, `At most ${LIMITS.MAX_LINES} lines`),
    discountIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'template' && !v.templateId) ctx.addIssue({ code: 'custom', path: ['templateId'], message: 'Choose a template' });
    if (v.mode === 'manual') {
      if (!v.planId) ctx.addIssue({ code: 'custom', path: ['planId'], message: 'Choose a plan' });
      if (v.lines.length === 0) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Add at least one product line' });
    }
    if (v.expiryDate && v.expiryDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Expiry must be after the start date' });
  });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

function CustomerPicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const customers = useQuery({ queryKey: ['/customers', 'picker', debounced], queryFn: () => api.get<Page<Customer>>('/customers', { q: debounced || undefined, pageSize: 20 }) });
  return (
    <Field label="Customer" htmlFor="customer-search" error={error} hint="Search by company, contact name or email.">
      <div className="space-y-2">
        <Input id="customer-search" placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error} aria-label="Customer">
          <option value="">{customers.isLoading ? 'Loading…' : `Select a customer (${customers.data?.meta.total ?? 0} found)`}</option>
          {customers.data?.data.map((c) => (
            <option key={c.id} value={c.id}>
              {(c.companyName ?? c.user.name) + ' · ' + c.user.email}
            </option>
          ))}
        </Select>
      </div>
    </Field>
  );
}

export function NewSubscriptionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);

  const plans = useQuery({ queryKey: ['/plans', 'all'], queryFn: () => api.get<Page<Plan>>('/plans', { pageSize: 100 }) });
  const products = useQuery({ queryKey: ['/products', 'active'], queryFn: () => api.get<Page<Product>>('/products', { active: 'true', pageSize: 100 }) });
  const taxes = useQuery({ queryKey: ['/taxes', 'active'], queryFn: () => api.get<Page<Tax>>('/taxes', { active: 'true', pageSize: 100 }) });
  const templates = useQuery({ queryKey: ['/templates', 'all'], queryFn: () => api.get<Page<Template>>('/templates', { pageSize: 100 }) });
  const discounts = useQuery({ queryKey: ['/discounts', 'subscription'], queryFn: () => api.get<Page<Discount>>('/discounts', { scope: 'SUBSCRIPTION', pageSize: 100 }) });

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: typedResolver(formSchema),
    defaultValues: { mode: 'manual', customerId: '', planId: '', templateId: '', startDate: todayIso(), expiryDate: '', paymentTermDays: 15, lines: [{ productId: '', variantId: '', quantity: 1, taxId: '' }], discountIds: [] },
  });
  const { errors } = form.formState;
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const mode = useWatch({ control: form.control, name: 'mode' });
  const watched = useWatch({ control: form.control });

  const productById = useMemo(() => new Map((products.data?.data ?? []).map((p) => [p.id, p])), [products.data]);
  const taxById = useMemo(() => new Map((taxes.data?.data ?? []).map((t) => [t.id, t])), [taxes.data]);
  const template = templates.data?.data.find((t) => t.id === watched.templateId);
  const plan = mode === 'template' ? template?.plan : plans.data?.data.find((p) => p.id === watched.planId);

  // Live estimate (the server re-prices from the catalog and applies discounts at invoicing).
  const estimate = useMemo(() => {
    const rows =
      mode === 'template'
        ? (template?.lines ?? []).map((l) => ({ amount: l.quantity * (l.product.salesPrice + (l.variant?.extraPrice ?? 0)), tax: 0 }))
        : (watched.lines ?? []).map((l) => {
            const product = productById.get(l?.productId ?? '');
            const variant = product?.variants?.find((v) => v.id === l?.variantId);
            const amount = (Number(l?.quantity) || 0) * ((product?.salesPrice ?? 0) + (variant?.extraPrice ?? 0));
            const rate = taxById.get(l?.taxId ?? '')?.rateBps ?? 0;
            return { amount, tax: Math.floor((amount * rate + 5_000) / 10_000) };
          });
    const products = rows.reduce((s, r) => s + r.amount, 0);
    const tax = rows.reduce((s, r) => s + r.tax, 0);
    const base = plan?.price ?? 0;
    return { products, tax, base, total: products + tax + base };
  }, [mode, template, watched.lines, productById, taxById, plan]);

  const create = useMutation({
    mutationFn: (values: FormOutput) =>
      api.post<One<Subscription>>(
        '/subscriptions',
        values.mode === 'template'
          ? { customerId: values.customerId, templateId: values.templateId, startDate: values.startDate, expiryDate: values.expiryDate || null, paymentTermDays: values.paymentTermDays, discountIds: values.discountIds }
          : {
              customerId: values.customerId,
              planId: values.planId,
              startDate: values.startDate,
              expiryDate: values.expiryDate || null,
              paymentTermDays: values.paymentTermDays,
              discountIds: values.discountIds,
              lines: values.lines.map((l) => ({ productId: l.productId, variantId: l.variantId || null, quantity: l.quantity, taxId: l.taxId || null })),
            },
      ),
    onSuccess: ({ data }) => {
      toast.success(`Draft ${data.number} created.`);
      navigate(`/subscriptions/${data.id}`);
    },
    onError: (err) => {
      if (!applyServerErrors(err, form.setError)) setError(err);
    },
  });

  return (
    <>
      <PageHeader
        back={
          <Link to="/subscriptions" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Subscriptions
          </Link>
        }
        title="New subscription"
        description="Creates a draft. Prices come from the catalog; you can submit it as a quotation next."
      />
      <form onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v); })} noValidate className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormError error={error} />
          <Card title="Customer and terms">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CustomerPicker value={watched.customerId ?? ''} onChange={(id) => form.setValue('customerId', id, { shouldValidate: true })} error={errors.customerId?.message} />
              </div>
              <Field label="Start date" htmlFor="startDate" error={errors.startDate?.message}>
                <Input id="startDate" type="date" invalid={!!errors.startDate} {...form.register('startDate')} />
              </Field>
              <Field label="End date (optional)" htmlFor="expiryDate" error={errors.expiryDate?.message}>
                <Input id="expiryDate" type="date" invalid={!!errors.expiryDate} {...form.register('expiryDate')} />
              </Field>
              <Field label="Payment terms (days)" htmlFor="paymentTermDays" error={errors.paymentTermDays?.message}>
                <Input id="paymentTermDays" type="number" min={0} max={365} invalid={!!errors.paymentTermDays} {...form.register('paymentTermDays')} />
              </Field>
            </div>
          </Card>

          <Card title="Products">
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="How to add products">
              {[
                { value: 'manual', label: 'Pick products', icon: <PenLine className="h-4 w-4" /> },
                { value: 'template', label: 'Use template', icon: <FileStack className="h-4 w-4" /> },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === opt.value}
                  onClick={() => form.setValue('mode', opt.value as 'manual' | 'template')}
                  className={cn('flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition', mode === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
                >
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>

            {mode === 'template' ? (
              <div className="space-y-4">
                <Field label="Quote template" htmlFor="templateId" error={errors.templateId?.message}>
                  <Select id="templateId" invalid={!!errors.templateId} {...form.register('templateId')}>
                    <option value="">Select a template</option>
                    {templates.data?.data.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.plan.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {template && (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {template.lines.map((l) => (
                      <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span>
                          {l.product.name}
                          {l.variant && <span className="text-slate-500"> · {l.variant.value}</span>}
                          <span className="text-slate-400"> × {l.quantity}</span>
                        </span>
                        <span className="tabular">{formatINR(l.quantity * (l.product.salesPrice + (l.variant?.extraPrice ?? 0)))}</span>
                      </li>
                    ))}
                    <li className="px-4 py-2.5 text-xs text-slate-500">Quote valid for {template.validityDays} days after creation.</li>
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Plan" htmlFor="planId" error={errors.planId?.message}>
                  <Select id="planId" invalid={!!errors.planId} {...form.register('planId')}>
                    <option value="">Select a plan</option>
                    {plans.data?.data.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatINR(p.price)} {periodLabel[p.billingPeriod].toLowerCase()}
                        {p.minQuantity > 1 ? ` · min qty ${p.minQuantity}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                {lines.fields.map((field, index) => {
                  const product = productById.get(watched.lines?.[index]?.productId ?? '');
                  const lineErrors = errors.lines?.[index];
                  return (
                    <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-12 sm:items-start">
                      <Field label="Product" htmlFor={`p-${index}`} error={lineErrors?.productId?.message} className="sm:col-span-4">
                        <Select id={`p-${index}`} invalid={!!lineErrors?.productId} {...form.register(`lines.${index}.productId`, { onChange: () => form.setValue(`lines.${index}.variantId`, '') })}>
                          <option value="">Select</option>
                          {products.data?.data.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {formatINR(p.salesPrice)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Variant" htmlFor={`v-${index}`} className="sm:col-span-3">
                        <Select id={`v-${index}`} disabled={!product?.variants?.length} {...form.register(`lines.${index}.variantId`)}>
                          <option value="">{product?.variants?.length ? 'Base' : 'None'}</option>
                          {product?.variants?.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.value} {v.extraPrice ? `(+${formatINR(v.extraPrice)})` : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Qty" htmlFor={`q-${index}`} error={lineErrors?.quantity?.message} className="sm:col-span-2">
                        <Input id={`q-${index}`} type="number" min={1} invalid={!!lineErrors?.quantity} {...form.register(`lines.${index}.quantity`)} />
                      </Field>
                      <Field label="Tax" htmlFor={`t-${index}`} className="sm:col-span-2">
                        <Select id={`t-${index}`} {...form.register(`lines.${index}.taxId`)}>
                          <option value="">None</option>
                          {taxes.data?.data.map((t) => (
                            <option key={t.id} value={t.id}>
                              {bpsToPercent(t.rateBps)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <div className="flex sm:col-span-1 sm:justify-end sm:pt-7">
                        <Button variant="ghost" size="sm" aria-label={`Remove line ${index + 1}`} onClick={() => lines.remove(index)} icon={<Trash2 className="h-4 w-4" />} />
                      </div>
                    </div>
                  );
                })}
                {errors.lines?.message && <p className="text-xs font-medium text-rose-600">{errors.lines.message}</p>}
                <Button variant="secondary" size="sm" disabled={lines.fields.length >= LIMITS.MAX_LINES} onClick={() => lines.append({ productId: '', variantId: '', quantity: 1, taxId: '' })} icon={<Plus className="h-4 w-4" />}>
                  Add line
                </Button>
              </div>
            )}
          </Card>

          {discounts.data && discounts.data.data.length > 0 && (
            <Card title="Subscription discounts">
              <div className="grid gap-2 sm:grid-cols-2">
                {discounts.data.data.map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <input type="checkbox" value={d.id} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600" {...form.register('discountIds')} />
                    <span className="text-sm">
                      <span className="block font-medium text-slate-800">{d.name}</span>
                      <span className="text-xs text-slate-500">
                        {d.type === 'PERCENT' ? bpsToPercent(d.value) : formatINR(d.value)} off{d.minPurchase ? ` · min ${formatINR(d.minPurchase)}` : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Product discounts apply automatically when an invoice is generated.</p>
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card title="Estimate per billing cycle">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Products</dt><dd className="tabular">{formatINR(estimate.products)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Plan base fee</dt><dd className="tabular">{formatINR(estimate.base)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="tabular">{formatINR(estimate.tax)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2.5 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatINR(estimate.total)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">Before discounts. The server prices every line from the catalog and applies discounts when it generates the invoice.</p>
            <Button type="submit" className="mt-5 w-full" loading={create.isPending}>
              Create draft
            </Button>
          </Card>
        </aside>
      </form>
    </>
  );
}
