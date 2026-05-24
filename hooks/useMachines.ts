'use client';

import { useEffect, useState } from 'react';
import { MACHINES, type MachineOption } from '@/lib/machines';

/**
 * Returns the machine list.
 * Uses the client-side constant directly (no fetch needed —
 * the list is static and always in sync with the seed).
 */
export function useMachines(): MachineOption[] {
  const [machines, setMachines] = useState<MachineOption[]>([]);

  useEffect(() => {
    setMachines(MACHINES);
  }, []);

  return machines;
}
