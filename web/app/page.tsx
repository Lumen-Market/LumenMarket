import Link from 'next/link';
import { getLaunches } from '@/lib/contract';
import TokenCard from '@/components/TokenCard';

export default async function HomePage() {
  const launches = await getLaunches();

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Token Launches</h1>
          <p className="text-gray-400 mt-1">Discover and trade bonding curve tokens</p>
        </div>
        <Link
          href="/create"
          className="px-5 py-2 bg-gradient-to-r from-purple to-cyan rounded-lg text-white font-semibold hover:opacity-90 transition"
        >
          Create Launch
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {launches.map((launch) => (
          <TokenCard key={launch.id} launch={launch} />
        ))}
      </div>
    </>
  );
}
