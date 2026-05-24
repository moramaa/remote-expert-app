import Link from 'next/link';
import { Factory, HardHat } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0a0f1e] p-8 text-zinc-100">
      <div className="text-center">
        <h1 className="font-mono text-4xl font-bold tracking-tight text-orange-500">FieldSync</h1>
        <p className="mt-2 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Remote Expert Platform
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/expert"
          className="group flex flex-col items-center gap-3 border border-zinc-800 bg-[#0d1b2a] p-8 transition-all hover:border-orange-500 hover:shadow-[0_0_24px_rgba(249,115,22,0.3)]"
        >
          <Factory size={48} className="text-orange-500" />
          <div className="text-lg font-semibold">Expert Console</div>
          <div className="text-center text-xs text-zinc-400">
            Place markers, send instructions, point at things, and guide the field worker.
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 group-hover:text-orange-500">
            /expert →
          </div>
        </Link>

        <Link
          href="/worker"
          className="group flex flex-col items-center gap-3 border border-zinc-800 bg-[#0d1b2a] p-8 transition-all hover:border-orange-500 hover:shadow-[0_0_24px_rgba(249,115,22,0.3)]"
        >
          <HardHat size={48} className="text-orange-500" />
          <div className="text-lg font-semibold">Worker View</div>
          <div className="text-center text-xs text-zinc-400">
            On-site mobile screen — receives live expert guidance in real time.
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 group-hover:text-orange-500">
            /worker →
          </div>
        </Link>
      </div>

      <div className="text-center font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        Open both URLs in separate windows to see live sync
      </div>
    </div>
  );
}
