'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { ensureUserId, getStoredRole, getStoredUserId } from '@/lib/identity';

export default function AdministratorOnboardingPage() {
  const router = useRouter();
  const [name, setName]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // If already onboarded, skip ahead to the dashboard
  useEffect(() => {
    const userId = getStoredUserId();
    const role   = getStoredRole();
    if (userId && role === 'administrator') {
      fetch(`/api/me?id=${userId}&role=administrator`)
        .then((r) => { if (r.ok) router.replace('/dashboard/administrator'); })
        .catch(() => {/* allow form to render */});
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }

    setSubmitting(true);
    try {
      const id = ensureUserId();
      const res = await fetch('/api/onboarding/administrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: name.trim() }),
      });
      if (!res.ok) {
        setError('Failed to save profile');
        setSubmitting(false);
        return;
      }
      router.push('/dashboard/administrator');
    } catch {
      setError('Network error — try again');
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        color: '#0F172A',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Shield size={28} color="#1D4ED8" />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1D4ED8', margin: 0 }}>
              Administrator Profile
            </h1>
            <p
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#64748B',
                margin: 0,
              }}
            >
              FieldSync · Remote Expert Platform
            </p>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '24px', marginTop: '8px' }}>
          You will be able to view and manage all recorded sessions across the platform.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>
              Your name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Alex Cohen"
              autoFocus
              maxLength={100}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#0F172A',
                outline: 'none',
                background: '#F8FAFC',
              }}
            />
          </label>

          {error && (
            <p style={{ margin: 0, fontSize: '12px', color: '#DC2626' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '12px',
              background: submitting ? '#94A3B8' : '#1D4ED8',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? 'Saving…' : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
