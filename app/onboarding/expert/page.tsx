'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Factory } from 'lucide-react';
import ExpertOnboardingForm from '@/components/onboarding/ExpertOnboardingForm';
import { getStoredUserId, getStoredRole } from '@/lib/identity';

export default function ExpertOnboardingPage() {
  const router = useRouter();

  // Redirect to dashboard if profile already exists
  useEffect(() => {
    const userId = getStoredUserId();
    const role   = getStoredRole();
    if (userId && role === 'expert') {
      fetch(`/api/me?id=${userId}&role=expert`)
        .then((r) => { if (r.ok) router.replace('/dashboard/expert'); })
        .catch(() => {/* allow */});
    }
  }, [router]);

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
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Factory size={28} color="#1D4ED8" />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1D4ED8', margin: 0 }}>
              Expert Profile
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
          Fill in your details so the system can match you with relevant support calls.
        </p>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          }}
        >
          <ExpertOnboardingForm />
        </div>
      </div>
    </div>
  );
}
