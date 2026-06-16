import Link from 'next/link';
import type { Launch } from '@/lib/types';

export default function TokenCard({ launch }: { launch: Launch }) {
  const pct = Number((launch.xlmRaised * 100n) / launch.targetXlm);
  const price = (Number(launch.currentPrice) / 1e7).toFixed(4);

  return (
    <Link href={`/launch/${launch.id}`}>
      <div className="bg-surface rounded-xl p-5 hover:ring-1 hover:ring-purple cursor-pointer transition">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-white font-semibold text-lg">{launch.name}</h3>
          {launch.migrated && (
            <span className="text-xs bg-cyan/20 text-cyan px-2 py-0.5 rounded-full">
              Migrated
            </span>
          )}
        </div>

        <p className="text-gray-400 text-xs truncate mb-4">{launch.creator}</p>

        <div className="mb-1 flex justify-between text-xs text-gray-400">
          <span>{pct}% funded</span>
          <span>
            {launch.xlmRaised.toString()} / {launch.targetXlm.toString()} XLM
          </span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple to-cyan rounded-full"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        <p className="mt-4 text-cyan text-sm">
          Price: <span className="font-mono">{price} XLM</span>
        </p>
      </div>
    </Link>
  );
}
