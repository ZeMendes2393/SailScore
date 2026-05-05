import SailScoreLanding from './SailScoreLanding';

/** Evita HTML antigo em cache na CDN após deploy (homepage marketing). */
export const dynamic = 'force-dynamic';

export default function Page() {
  return <SailScoreLanding />;
}
