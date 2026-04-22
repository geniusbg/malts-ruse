import { redirectFromProtocolTarget } from '@/lib/protocol-handler-redirect';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ target?: string | string[] }>;
};

/** Entry for `web+malts-admin:` — paths under /{locale}/admin only. */
export default async function MaltsAdminProtocolPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  redirectFromProtocolTarget(sp.target, locale, 'admin');
}
