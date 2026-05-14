'use client';
import Link from 'next/link';

type Props = {
  title: string;
  description: string;
  href: string;
  enabled: boolean;
  cta: string;
};

export default function FeatureCard({ title, description, href, enabled, cta }: Props) {
  return (
    <div className="rounded-xl border bg-white p-6 sm:p-8 shadow-sm">
      <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h3>
      <p className="text-base text-gray-600 mt-2 leading-relaxed">{description}</p>

      {enabled ? (
        <Link
          href={href}
          className="inline-block mt-5 px-5 py-2.5 rounded-lg bg-blue-600 text-base font-medium text-white hover:bg-blue-700"
        >
          {cta}
        </Link>
      ) : (
        <button
          disabled
          className="inline-block mt-5 px-5 py-2.5 rounded-lg bg-gray-200 text-base font-medium text-gray-500 cursor-not-allowed"
          title="Unavailable at the moment"
        >
          {cta}
        </button>
      )}
    </div>
  );
}
