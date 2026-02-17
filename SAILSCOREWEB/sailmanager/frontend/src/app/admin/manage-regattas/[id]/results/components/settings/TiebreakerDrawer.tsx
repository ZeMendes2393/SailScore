'use client';

type Props = {
  onClose: () => void;
};

const APPENDIX_8 = `We follow the tie-breaking rules outlined in Appendix 8 of the World Sailing Racing Rules.`;

const MEDAL_RACE_TIEBREAKER = `In the Medal Race, the tie-breaker system is applied as follows:

• If two boats are tied, the boat with the better result in the Medal Race will be ranked higher.

• If both boats have the same position in the Medal Race, the tie is broken by the total points from previous races.`;

export default function TiebreakerDrawer({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-xl p-5 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Tiebreaker</h3>
          <button onClick={onClose} className="px-3 py-1 rounded border hover:bg-gray-50">
            Fechar
          </button>
        </div>

        <div className="space-y-6 text-sm text-gray-800">
          <section>
            <h4 className="font-semibold text-gray-900 mb-2">Appendix 8 Explanation</h4>
            <p className="leading-relaxed">{APPENDIX_8}</p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-2">Medal Race Tie-Breaker</h4>
            <p className="leading-relaxed whitespace-pre-line">{MEDAL_RACE_TIEBREAKER}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
