'use client';

import { LoginForm } from '@/client/components/auth/LoginForm';

export function LoginView() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <LoginForm />
    </div>
  );
}

export default LoginView;
