import { ResetPasswordForm } from '@lumilab/engine/ui/PasswordResetForms';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <ResetPasswordForm token={t ?? ''} />;
}
