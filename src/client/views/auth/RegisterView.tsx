'use client';

import { RegisterForm } from '@/client/components/auth/RegisterForm';

export function RegisterView() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <RegisterForm />
    </div>
  );
}

export default RegisterView;
