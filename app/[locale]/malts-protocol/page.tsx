import { redirectFromProtocolTarget } from '@/lib/protocol-handler-redirect';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ target?: string | string[] }>;
};

/** Entry for `web+malts:` — public app only (no /admin, /staff). */
export default async function MaltsPublicProtocolPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  redirectFromProtocolTarget(sp.target, locale, 'public');
}
