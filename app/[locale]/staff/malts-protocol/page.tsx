import { redirectFromProtocolTarget } from '@/lib/protocol-handler-redirect';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ target?: string | string[] }>;
};

/** Entry for `web+malts-staff:` — paths under /{locale}/staff only. */
export default async function MaltsStaffProtocolPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  redirectFromProtocolTarget(sp.target, locale, 'staff');
}
