import '@/engine.server';
import { requireUser } from '@/lib/require-user';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await requireUser();
  return <ChangePasswordForm email={user.email ?? ''} />;
}
