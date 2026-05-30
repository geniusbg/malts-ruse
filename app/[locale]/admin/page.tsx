import { resolveSiteDisplayName } from '@/lib/site-display-name';
import AdminDashboard from '@/components/AdminDashboard';

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const initialSiteName = await resolveSiteDisplayName();
  return <AdminDashboard locale={locale} initialSiteName={initialSiteName} />;
}
