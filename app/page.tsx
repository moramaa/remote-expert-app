'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Factory, HardHat } from 'lucide-react';
import { getStoredRole, getStoredUserId, storeRole } from '@/lib/identity';

export default function Home() {
  const router = useRouter();

  // If identity already set, redirect to the appropriate dashboard
  useEffect(() => {
    const role   = getStoredRole();
    const userId = getStoredUserId();
    if (role && userId) {
      router.replace(`/dashboard/${role}`);
    }
  }, [router]);

  function select(role: 'expert' | 'worker'): void {
    storeRole(role);
    router.push(`/onboarding/${role}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0a0f1e] p-8 text-zinc-100">
      <div className="text-center">
        <h1 className="font-mono text-4xl font-bold tracking-tight text-orange-500">FieldSync</h1>
        <p className="mt-2 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Remote Expert Platform
        </p>
      </div>

      <div className="w-full max-w-xs text-center">
        <p className="mb-6 text-xs uppercase tracking-widest text-zinc-600 font-mono">
          Who are you?
        </p>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => select('expert')}
            className="group flex flex-col items-center gap-3 border border-zinc-800 bg-[#0d1b2a] p-8 transition-all hover:border-orange-500 hover:shadow-[0_0_24px_rgba(249,115,22,0.3)]"
          >
            <Factory size={40} className="text-orange-500" />
            <div className="text-base font-semibold">I&apos;m an Expert</div>
            <div className="text-xs text-zinc-400 text-center">
              Guide field workers remotely in live 3D sessions
            </div>
          </button>

          <button
            type="button"
            onClick={() => select('worker')}
            className="group flex flex-col items-center gap-3 border border-zinc-800 bg-[#0d1b2a] p-8 transition-all hover:border-orange-500 hover:shadow-[0_0_24px_rgba(249,115,22,0.3)]"
          >
            <HardHat size={40} className="text-orange-500" />
            <div className="text-base font-semibold">I&apos;m a Field Worker</div>
            <div className="text-xs text-zinc-400 text-center">
              Request live expert guidance on-site
            </div>
          </button>
        </div>
      </div>

      <div className="text-center font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        FieldSync MVP · Phase 2
      </div>
    </div>
  );
}
