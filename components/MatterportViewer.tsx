'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraState } from '@/types/socket';

interface MatterportViewerProps {
  isReadOnly: boolean;
  /**
   * Fires whenever Pointer.intersection changes.
   * The caller can store the latest intersection and use it to place
   * native SDK Tags (Tag.add) at the exact 3D surface position.
   */
  onIntersectionChange?: (intersection: MatterportIntersection | null) => void;
  onCameraMove?: (camera: CameraState) => void;
  onSdkReady?: (sdk: MatterportSdk) => void;
  syncedCamera?: CameraState | null;
  className?: string;
  children?: React.ReactNode;
}

type Status = 'loading' | 'ready' | 'error';

export default function MatterportViewer({
  isReadOnly,
  onIntersectionChange,
  onCameraMove,
  onSdkReady,
  syncedCamera,
  className,
  children,
}: MatterportViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<MatterportSdk | null>(null);
  const lastCameraEmitRef = useRef<number>(0);

  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const sdkKey = process.env.NEXT_PUBLIC_MATTERPORT_SDK_KEY ?? '';
  const spaceId = 'RXLkh8vriYF';

  // Stable callback refs so we don't re-init the viewer when parent re-renders
  const cbsRef = useRef({ onIntersectionChange, onCameraMove, onSdkReady });
  useEffect(() => {
    cbsRef.current = { onIntersectionChange, onCameraMove, onSdkReady };
  }, [onIntersectionChange, onCameraMove, onSdkReady]);

  // Mount viewer once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;

    import('@matterport/webcomponent')
      .then(() => {
        if (cancelled) return;

        const viewer = document.createElement('matterport-viewer') as MatterportViewerElement;
        viewer.setAttribute('m', spaceId);
        viewer.setAttribute('application-key', sdkKey);
        viewer.style.cssText = 'width:100%;height:100%;display:block;';
        mount.appendChild(viewer);

        viewer.playingPromise
          .then((mpSdk: MatterportSdk) => {
            if (cancelled) return;
            sdkRef.current = mpSdk;
            setStatus('ready');
            cbsRef.current.onSdkReady?.(mpSdk);

            try {
              mpSdk.Pointer.intersection.subscribe((intersection) => {
                cbsRef.current.onIntersectionChange?.(intersection);
              });
            } catch {
              // Pointer API not available in this SDK version
            }

            try {
              mpSdk.Camera.pose.subscribe((pose) => {
                const now = Date.now();
                if (now - lastCameraEmitRef.current < 100) return;
                lastCameraEmitRef.current = now;
                cbsRef.current.onCameraMove?.({
                  position: pose.position ?? { x: 0, y: 0, z: 0 },
                  rotation: {
                    x: pose.rotation?.x ?? 0,
                    y: pose.rotation?.y ?? 0,
                    z: 0,
                  },
                  sweep: pose.sweep ?? '',
                });
              });
            } catch {
              // Camera API not available
            }
          })
          .catch((err: Error) => {
            if (cancelled) return;
            setStatus('error');
            setErrorMsg(err?.message ?? 'Viewer failed to enter playing state');
          });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(err?.message ?? 'Failed to load Matterport SDK');
      });

    // Note: intentionally not removing the viewer element on unmount —
    // the SDK manages its own teardown and an aggressive cleanup can leave
    // the underlying WebGL context in a broken state.
    return () => {
      cancelled = true;
    };
  }, [sdkKey, spaceId]);

  // Mirror View: teleport to the expert's sweep + rotation in one atomic call
  useEffect(() => {
    const mpSdk = sdkRef.current;
    if (!syncedCamera || !mpSdk) return;

    const { sweep, rotation } = syncedCamera;

    // Sweep.moveTo handles both position (which node) and rotation together.
    // INSTANT transition avoids lag that would make the views drift apart.
    // Skip if sweep is empty — expert may be in dollhouse / floorplan mode.
    if (sweep) {
      mpSdk.Sweep.moveTo(sweep, {
        rotation: { x: rotation.x, y: rotation.y },
        transition: 'transition.instant',
      }).catch(() => {
        // Sweep may not exist in the worker's current floor — ignore
      });
    } else if (mpSdk.Camera.setRotation) {
      // Fallback: expert is not at a sweep (e.g. free-flight mode) —
      // at least sync rotation so the view direction matches
      mpSdk.Camera.setRotation({ x: rotation.x, y: rotation.y }).catch(() => { });
    }
  }, [syncedCamera]);

  // Notify caller when viewer is torn down (e.g. route change)
  useEffect(() => {
    return () => {
      cbsRef.current.onIntersectionChange?.(null);
    };
  }, []);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Read-only overlay — blocks all pointer events from reaching the viewer */}
      {isReadOnly && status === 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 4,
            pointerEvents: 'auto',
            background: 'transparent',
            cursor: 'default',
          }}
          onClick={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
        />
      )}

      {/* Children render above viewer (laser dot, zones, etc.) */}
      {children}

      {/* Loading overlay */}
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0F172A',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#1D4ED8',
                boxShadow: '0 0 30px #1D4ED8',
                animation: 'mp-pulse 1.4s ease-in-out infinite',
              }}
            />
            <div style={{ fontSize: '0.875rem', letterSpacing: '0.05em', color: '#cbd5e1' }}>
              Connecting to digital twin...
            </div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            background: '#0F172A',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <strong style={{ fontSize: '1.125rem', color: '#DC2626' }}>Failed to load Matterport viewer</strong>
          <p style={{ maxWidth: '32rem', fontSize: '0.875rem', color: '#CBD5E1' }}>{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              border: '1px solid #1D4ED8',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: '#1D4ED8',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes mp-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
