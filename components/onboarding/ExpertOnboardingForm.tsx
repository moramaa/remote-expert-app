'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck } from 'lucide-react';
import CertificationMultiSelect from './CertificationMultiSelect';
import { ensureUserId, storeRole } from '@/lib/identity';
import { MACHINES } from '@/lib/machines';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'he', label: 'Hebrew' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
];

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

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

export default function ExpertOnboardingForm() {
  const router = useRouter();

  const [name,            setName]            = useState('');
  const [yearsExp,        setYearsExp]        = useState('');
  const [certifications,  setCertifications]  = useState<string[]>([]);
  const [languages,       setLanguages]       = useState<string[]>([]);
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState('');

  function toggleLanguage(code: string): void {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required.'); return; }
    const exp = parseInt(yearsExp, 10);
    if (isNaN(exp) || exp < 0 || exp > 60) { setError('Enter a valid years of experience (0–60).'); return; }
    if (certifications.length === 0) { setError('Select at least one machine certification.'); return; }
    if (languages.length === 0) { setError('Select at least one language.'); return; }

    setSubmitting(true);

    const userId = ensureUserId();
    storeRole('expert');

    try {
      const res = await fetch('/api/onboarding/expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, name: name.trim(), yearsExperience: exp, certifications, languages }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(String(body.error ?? 'Failed to save profile.'));
        return;
      }

      router.push('/dashboard/expert');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Name */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Full Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sarah Levi"
          style={inputStyle}
          autoFocus
        />
      </div>

      {/* Years of experience */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Years of Experience</label>
        <input
          type="number"
          min={0}
          max={60}
          value={yearsExp}
          onChange={(e) => setYearsExp(e.target.value)}
          placeholder="e.g. 8"
          style={{ ...inputStyle, width: '120px' }}
        />
      </div>

      {/* Certifications */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Machine Certifications</label>
        <CertificationMultiSelect
          machines={MACHINES}
          selected={certifications}
          onChange={setCertifications}
        />
      </div>

      {/* Languages */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Spoken Languages</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {LANGUAGE_OPTIONS.map((l) => {
            const active = languages.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => toggleLanguage(l.code)}
                style={{
                  background: active ? '#1D4ED8' : 'transparent',
                  color: active ? '#FFFFFF' : '#64748B',
                  border: `1px solid ${active ? '#1D4ED8' : '#E2E8F0'}`,
                  borderRadius: '20px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {l.label}
              </button>
            );
          })}
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
        <UserCheck size={16} />
        {submitting ? 'SAVING…' : 'CREATE PROFILE →'}
      </button>
    </form>
  );
}
