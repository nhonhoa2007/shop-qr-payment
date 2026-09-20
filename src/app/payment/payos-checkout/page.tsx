import { notFound } from 'next/navigation';
import PayOSCheckoutView from '@client/views/PayOSCheckoutView';

export default function PayOSCheckoutPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <PayOSCheckoutView />;
}
