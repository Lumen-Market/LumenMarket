'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BondingCurveChart from '@/components/BondingCurveChart';
import { getLaunch, buyTokens, sellTokens } from '@/lib/contract';
import type { Launch } from '@/lib/types';

export default function LaunchPage() {
  const { id } = useParams<{ id: string }>();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [status, setStatus] = useState('');

  useEffect(() => {
    getLaunch(Number(id)).then((l) => setLaunch(l ?? null));
  }, [id]);

  if (!launch) return <p className="text-gray-400">Loading…</p>;

  const pct = Number((launch.xlmRaised * 100n) / launch.targetXlm);
  const price = (Number(launch.currentPrice) / 1e7).toFixed(6);

  async function submit() {
    if (!launch || !amount) return;
    setStatus('Pending…');
    try {
      if (mode === 'buy') {
        const xlmIn = BigInt(Math.round(parseFloat(amount) * 1e7));
        const slippageFactor = 1 - parseFloat(slippage) / 100;
        const minTokens = BigInt(Math.round(Number(xlmIn) * slippageFactor));
        const res = await buyTokens(launch.id, xlmIn, minTokens);
        setStatus(`Bought ${res.tokensBought.toString()} tokens`);
      } else {
        const tokensIn = BigInt(Math.round(parseFloat(amount)));
        const minXlm = 1n;
        const res = await sellTokens(launch.id, tokensIn, minXlm);
        setStatus(`Received ${res.xlmReceived.toString()} XLM`);
      }
    } catch (e) {
      setStatus('Error: ' + (e as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{launch.name}</h1>
          <p className="text-gray-400 text-sm mt-1 font-mono">{launch.creator}</p>
        </div>
        {launch.migrated && (
          <span className="bg-cyan/20 text-cyan px-3 py-1 rounded-full text-sm">
            Migrated to DEX
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          ['Current Price', `${price} XLM`],
          ['Raised', `${launch.xlmRaised.toString()} / ${launch.targetXlm.toString()} XLM`],
          ['Sold', `${launch.sold.toString()} / ${launch.totalSupply.toString()}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface rounded-xl p-4">
            <p className="text-gray-400 text-xs">{label}</p>
            <p className="text-white font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{pct}% funded</span>
          <span>{launch.targetXlm.toString()} XLM target</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple to-cyan rounded-full"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Bonding Curve</h2>
        <BondingCurveChart launch={launch} />
      </div>

      {/* Trade */}
      {!launch.migrated && (
        <div className="bg-surface rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold">Trade</h2>
          <div className="flex gap-2">
            {(['buy', 'sell'] as const).map((m) => (
              <button
                key={m}
                className={`px-4 py-1.5 rounded-lg text-sm capitalize transition ${
                  mode === m ? 'bg-purple text-white' : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                {mode === 'buy' ? 'XLM to spend' : 'Tokens to sell'}
              </label>
              <input
                className="w-full bg-bg border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Slippage %</label>
              <input
                className="w-32 bg-bg border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple"
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
              />
            </div>
            <button
              className="w-full py-2.5 bg-gradient-to-r from-purple to-cyan rounded-lg text-white font-semibold hover:opacity-90 transition"
              onClick={submit}
            >
              {mode === 'buy' ? 'Buy Tokens' : 'Sell Tokens'}
            </button>
            {status && <p className="text-cyan text-sm text-center">{status}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
