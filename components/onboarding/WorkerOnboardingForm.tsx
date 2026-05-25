'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HardHat } from 'lucide-react';
import { ensureUserId, storeRole } from '@/lib/identity';

const ROLE_LEVELS = [
  { id: 'junior_operator',  label: 'Junior Operator',   description: 'Recently onboarded, requires guidance' },
  { id: 'maintenance',      label: 'Maintenance Tech',  description: 'Experienced with repairs and upkeep' },
  { id: 'senior_operator',  label: 'Senior Operator',   description: 'Experienced operator, can lead small fixes' },
] as const;

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  color: '#0F172A',
  padding: '8px 12px',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  borderRadius: '6px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--font-mono, monospace)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: '#64748B',
  marginBottom: '6px',
  display: 'block',
};

export default function WorkerOnboardingForm() {
  const router = useRouter();

  const [name,       setName]       = useState('');
  const [factory,    setFactory]    = useState('');
  const [roleLevel,  setRoleLevel]  = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');

    if (!name.trim())    { setError('Name is required.'); return; }
    if (!factory.trim()) { setError('Factory / location is required.'); return; }
    if (!roleLevel)      { setError('Select your role level.'); return; }

    setSubmitting(true);

    const userId = ensureUserId();
    storeRole('worker');

    try {
      const res = await fetch('/api/onboarding/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, name: name.trim(), factory: factory.trim(), roleLevel }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(String(body.error ?? 'Failed to save profile.'));
        return;
      }

      router.push('/dashboard/worker');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Name */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>Full Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. David Cohen"
          style={inputStyle}
          autoFocus
        />
      </div>

      {/* Factory */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>Factory / Location</label>
        <input
          value={factory}
          onChange={(e) => setFactory(e.target.value)}
          placeholder="e.g. Tnuva Plant B, Rehovot"
          style={inputStyle}
        />
      </div>

      {/* Role level */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>Role Level</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {ROLE_LEVELS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoleLevel(r.id)}
              style={{
                background: roleLevel === r.id ? '#DBEAFE' : '#F8FAFC',
                border: `1px solid ${roleLevel === r.id ? '#1D4ED8' : '#E2E8F0'}`,
                color: roleLevel === r.id ? '#1D4ED8' : '#64748B',
                borderRadius: '8px',
                padding: '10px 14px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: roleLevel === r.id ? 600 : 400, color: '#0F172A' }}>
                {r.label}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{r.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            fontSize: '12px',
            color: '#DC2626',
            background: '#FEE2E2',
            border: '1px solid #DC2626',
            borderRadius: '6px',
            padding: '8px 12px',
          }}
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        style={{
          background: submitting ? '#64748B' : '#1D4ED8',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '0.1em',
          cursor: submitting ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <HardHat size={16} />
        {submitting ? 'SAVING…' : 'CREATE PROFILE →'}
      </button>
    </form>
  );
}
