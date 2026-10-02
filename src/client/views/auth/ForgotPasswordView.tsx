'use client';

import { ForgotPasswordForm } from '@client/components/auth/ForgotPasswordForm';

export function ForgotPasswordView() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <ForgotPasswordForm />
    </div>
  );
}

export default ForgotPasswordView;
