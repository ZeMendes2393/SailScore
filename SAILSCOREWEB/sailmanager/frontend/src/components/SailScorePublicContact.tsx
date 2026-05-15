import {
  SAILSCORE_PUBLIC_CONTACT_EMAIL,
  SAILSCORE_PUBLIC_PHONES,
} from '@/lib/sailscorePublicContact';

type Props = {
  className?: string;
};

/** Email + phone lines for SailScore marketing / default footer (no org). */
export default function SailScorePublicContact({ className = '' }: Props) {
  return (
    <div className={`space-y-2 text-sm ${className}`}>
      <p>
        <span className="font-medium text-slate-200">Email:</span>{' '}
        <a
          href={`mailto:${SAILSCORE_PUBLIC_CONTACT_EMAIL}`}
          className="text-sky-300 hover:text-sky-200 underline underline-offset-2"
        >
          {SAILSCORE_PUBLIC_CONTACT_EMAIL}
        </a>
      </p>
      <div className="space-y-1">
        <p className="font-medium text-slate-200">Phone:</p>
        <ul className="space-y-1 pl-0 list-none">
          {SAILSCORE_PUBLIC_PHONES.map((p) => (
            <li key={p.tel}>
              <a href={`tel:${p.tel}`} className="text-sky-300 hover:text-sky-200 underline underline-offset-2">
                {p.display}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
