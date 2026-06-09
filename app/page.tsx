import { redirect } from 'next/navigation';
import { buildSiteUrl } from '@/lib/site-url';

export default function RootPage() {
  redirect(buildSiteUrl('/bg'));
}

