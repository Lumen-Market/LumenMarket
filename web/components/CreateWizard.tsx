'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLaunch } from '@/lib/contract';

interface WizardState {
  name: string;
  totalSupply: string;
  targetXlm: string;
  virtualXlm: string;
}

const STEPS = ['Token Details', 'Curve Parameters', 'Review & Deploy'];

export default function CreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [form, setForm] = useState<WizardState>({
    name: '',
    totalSupply: '',
    targetXlm: '',
    virtualXlm: '',
  });

  const set = (k: keyof WizardState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function deploy() {
    setDeploying(true);
    try {
      const result = await createLaunch({
        name: form.name,
        totalSupply: BigInt(form.totalSupply),
        targetXlm: BigInt(form.targetXlm),
        virtualXlm: BigInt(form.virtualXlm),
      });
      router.push(`/launch/${result.id}`);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className={`h-1 rounded-full ${i <= step ? 'bg-purple' : 'bg-gray-700'}`}
            />
            <p className={`text-xs mt-1 ${i === step ? 'text-purple' : 'text-gray-500'}`}>
              {s}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-xl p-6 space-y-4">
        {step === 0 && (
          <>
            <Field label="Token Name" value={form.name} onChange={set('name')} placeholder="e.g. SolarToken" />
            <Field label="Total Supply" value={form.totalSupply} onChange={set('totalSupply')} placeholder="e.g. 1000000" type="number" />
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Target XLM (migration trigger)" value={form.targetXlm} onChange={set('targetXlm')} placeholder="e.g. 15000" type="number" />
            <Field label="Initial Virtual XLM (bonding curve)" value={form.virtualXlm} onChange={set('virtualXlm')} placeholder="e.g. 1000" type="number" />
          </>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm text-gray-300">
            <Row label="Name" value={form.name} />
            <Row label="Total Supply" value={`${form.totalSupply} tokens`} />
            <Row label="Target XLM" value={`${form.targetXlm} XLM`} />
            <Row label="Virtual XLM" value={`${form.virtualXlm} XLM`} />
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button
          className="px-4 py-2 text-gray-400 hover:text-white transition"
          onClick={() => (step > 0 ? setStep(step - 1) : router.back())}
        >
          Back
        </button>
        {step < 2 ? (
          <button
            className="px-6 py-2 bg-purple rounded-lg text-white font-semibold hover:bg-purple/80 transition"
            onClick={() => setStep(step + 1)}
          >
            Next
          </button>
        ) : (
          <button
            className="px-6 py-2 bg-gradient-to-r from-purple to-cyan rounded-lg text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
            onClick={deploy}
            disabled={deploying}
          >
            {deploying ? 'Deploying…' : 'Deploy'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        className="w-full bg-bg border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-700 pb-2">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}
