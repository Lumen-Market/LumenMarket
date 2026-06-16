'use client';

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Launch } from '@/lib/types';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

export default function BondingCurveChart({ launch }: { launch: Launch }) {
  const points = 50;
  const step = Number(launch.totalSupply) / points;
  // virtualXlm approximated from current state: currentPrice * (totalSupply - sold)
  const virtualXlm = Number(launch.currentPrice) * Number(launch.totalSupply - launch.sold);

  const labels: string[] = [];
  const prices: number[] = [];

  for (let i = 0; i <= points; i++) {
    const sold = step * i;
    const remaining = Number(launch.totalSupply) - sold;
    const price = remaining > 0 ? virtualXlm / remaining : 0;
    labels.push((sold / 1000).toFixed(0) + 'k');
    prices.push(price / 1e7);
  }

  const currentIndex = Math.round(
    (Number(launch.sold) / Number(launch.totalSupply)) * points
  );

  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: 'Price (XLM)',
            data: prices,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            label: 'Current',
            data: prices.map((p, i) => (i === currentIndex ? p : null)),
            borderColor: '#06b6d4',
            pointBackgroundColor: '#06b6d4',
            pointRadius: 6,
            showLine: false,
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { tooltip: { mode: 'index', intersect: false } },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
          y: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
        },
      }}
    />
  );
}
