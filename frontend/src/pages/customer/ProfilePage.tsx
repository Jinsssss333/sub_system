import { Link } from 'react-router-dom';
import { Card, DescriptionList, PageHeader } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader title="Profile" description="Your account and billing contact details." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <DescriptionList items={[{ label: 'Name', value: user.name }, { label: 'Email', value: user.email }, { label: 'Role', value: 'Customer' }]} />
          <p className="mt-6 text-sm text-slate-500">
            Need a new password? <Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-700">Send a reset link</Link>.
          </p>
        </Card>
        <Card title="Billing details">
          <DescriptionList items={[{ label: 'Company', value: user.customer?.companyName ?? '—' }, { label: 'Phone', value: user.customer?.phone ?? '—' }, { label: 'Address', value: user.customer?.address ?? '—' }]} />
          <p className="mt-6 text-sm text-slate-500">To change billing details, contact your account manager.</p>
        </Card>
      </div>
    </>
  );
}
