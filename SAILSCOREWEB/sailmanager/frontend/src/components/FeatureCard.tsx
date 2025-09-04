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
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>

      {enabled ? (
        <Link
          href={href}
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          {cta}
        </Link>
      ) : (
        <button
          disabled
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed"
          title="Indisponível neste momento"
        >
          {cta}
        </button>
      )}
    </div>
  );
}
