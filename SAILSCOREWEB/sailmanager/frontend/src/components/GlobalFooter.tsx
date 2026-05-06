'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';

type FooterDesign = {
  footer_site_name: string | null;
  footer_tagline: string | null;
  footer_contact_email: string | null;
  footer_phone: string | null;
  footer_address: string | null;
  footer_instagram_url: string | null;
  footer_facebook_url: string | null;
  footer_show_privacy_policy: boolean;
  footer_show_terms_of_service: boolean;
  footer_show_cookie_policy: boolean;
  footer_privacy_policy_text: string | null;
  footer_terms_of_service_text: string | null;
  footer_cookie_policy_text: string | null;
};

type LegalModalType = 'privacy' | 'terms' | 'cookie' | null;

export default function GlobalFooter({
  orgSlug,
  initialFooter,
  /** Slug da org para qual initialFooter foi carregado; só usamos initialFooter se coincidir */
  serverOrgSlug,
}: {
  orgSlug?: string | null;
  initialFooter?: FooterDesign | Record<string, unknown> | null;
  serverOrgSlug?: string | null;
}) {
  /** Em /regattas/:id não há /o/slug no path; o layout define serverOrgSlug. */
  const effectiveOrg = orgSlug ?? serverOrgSlug ?? null;
  const useInitial =
    !!initialFooter && (effectiveOrg ?? null) === (serverOrgSlug ?? null);
  const [footer, setFooter] = useState<FooterDesign | null>(
    useInitial ? (initialFooter as FooterDesign) : null
  );
  const [openModal, setOpenModal] = useState<LegalModalType>(null);

  useEffect(() => {
    if (useInitial) {
      setFooter(initialFooter as FooterDesign);
      return;
    }
    const q = effectiveOrg ? `?org=${encodeURIComponent(effectiveOrg)}` : '';
    apiGet<FooterDesign>(`/design/footer${q}`)
      .then((data) => setFooter(data))
      .catch(() => setFooter(null));
  }, [effectiveOrg, initialFooter, serverOrgSlug, useInitial]);

  const siteName = (footer?.footer_site_name ?? '').trim() || 'SailScore';
  const tagline = (footer?.footer_tagline ?? '').trim();

  const showPrivacy =
    !!footer?.footer_show_privacy_policy && !!(footer?.footer_privacy_policy_text ?? '').trim();
  const showTerms =
    !!footer?.footer_show_terms_of_service && !!(footer?.footer_terms_of_service_text ?? '').trim();
  const showCookie =
    !!footer?.footer_show_cookie_policy && !!(footer?.footer_cookie_policy_text ?? '').trim();
  const adminLoginHref = effectiveOrg ? `/admin/login?org=${encodeURIComponent(effectiveOrg)}` : '/admin/login';
  const publicSiteHref = effectiveOrg ? `/o/${encodeURIComponent(effectiveOrg)}` : '/';

  const getModalTitle = () => {
    if (openModal === 'privacy') return 'Privacy Policy';
    if (openModal === 'terms') return 'Terms of Service';
    if (openModal === 'cookie') return 'Cookie Policy';
    return '';
  };

  const getModalContent = () => {
    if (!footer) return '';
    if (openModal === 'privacy') return footer.footer_privacy_policy_text ?? '';
    if (openModal === 'terms') return footer.footer_terms_of_service_text ?? '';
    if (openModal === 'cookie') return footer.footer_cookie_policy_text ?? '';
    return '';
  };

  return (
    <>
      <footer className="bg-slate-800 text-slate-100 mt-auto">
        <div className="max-w-screen-2xl mx-auto py-10 px-4 sm:px-6 space-y-6">
          <div className="flex flex-col md:flex-row md:justify-between gap-8">
            <div className="space-y-1 max-w-md">
              <p className="text-lg font-semibold">{siteName}</p>
              {tagline && <p className="text-slate-300 text-sm">{tagline}</p>}
            </div>

            <div className="space-y-1 text-sm text-slate-300">
              {footer?.footer_contact_email && (
                <p>
                  <span className="font-medium">Email:</span>{' '}
                  <a
                    href={`mailto:${footer.footer_contact_email}`}
                    className="text-sky-300 hover:text-sky-200 underline underline-offset-2"
                  >
                    {footer.footer_contact_email}
                  </a>
                </p>
              )}
              {footer?.footer_phone && (
                <p>
                  <span className="font-medium">Phone:</span> {footer.footer_phone}
                </p>
              )}
              {footer?.footer_address && (
                <p className="whitespace-pre-line">
                  <span className="font-medium">Address:</span> {footer.footer_address}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                {footer?.footer_instagram_url && (
                  <a
                    href={footer.footer_instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 hover:text-sky-200 text-sm underline underline-offset-2"
                  >
                    Instagram
                  </a>
                )}
                {footer?.footer_facebook_url && (
                  <a
                    href={footer.footer_facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 hover:text-sky-200 text-sm underline underline-offset-2"
                  >
                    Facebook
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 text-slate-300 text-sm font-medium shrink-0 justify-end">
              <div className="flex items-center gap-2">
                <span>Powered by SailScore</span>
                <img
                  src="/sailscore-icon.png"
                  alt=""
                  role="presentation"
                  className="h-5 w-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <Link
                href={publicSiteHref}
                className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
              >
                Site publico
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-700 pt-4 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={adminLoginHref}
                className="text-[11px] text-slate-500 hover:text-slate-300 underline underline-offset-2"
              >
                Admin account
              </Link>
              {showPrivacy && (
                <button
                  type="button"
                  className="hover:text-sky-200 underline underline-offset-2"
                  onClick={() => setOpenModal('privacy')}
                >
                  Privacy Policy
                </button>
              )}
              {showTerms && (
                <button
                  type="button"
                  className="hover:text-sky-200 underline underline-offset-2"
                  onClick={() => setOpenModal('terms')}
                >
                  Terms of Service
                </button>
              )}
              {showCookie && (
                <button
                  type="button"
                  className="hover:text-sky-200 underline underline-offset-2"
                  onClick={() => setOpenModal('cookie')}
                >
                  Cookie Policy
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>

      {openModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white max-w-2xl w-full rounded-xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{getModalTitle()}</h2>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-800"
                onClick={() => setOpenModal(null)}
              >
                Close
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
              {getModalContent()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
