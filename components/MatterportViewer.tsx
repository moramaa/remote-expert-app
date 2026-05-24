'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraState } from '@/types/socket';

export interface MarkerClickPayload {
  world: { x: number; y: number; z: number };
  screen: { x: number; y: number }; // 0-100 percentages
}

interface MatterportViewerProps {
  isReadOnly: boolean;
  captureClicks?: boolean;
  onMarkerClick?: (payload: MarkerClickPayload) => void;
  onCameraMove?: (camera: CameraState) => void;
  onSdkReady?: (sdk: MatterportSdk) => void;
  syncedCamera?: CameraState | null;
  className?: string;
  children?: React.ReactNode;
}

type Status = 'loading' | 'ready' | 'error';

export default function MatterportViewer({
  isReadOnly,
  captureClicks = false,
  onMarkerClick,
  onCameraMove,
  onSdkReady,
  syncedCamera,
  className,
  children,
}: MatterportViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<MatterportSdk | null>(null);
  const lastIntersectionRef = useRef<MatterportIntersection | null>(null);
  const lastCameraEmitRef = useRef<number>(0);

  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const sdkKey = process.env.NEXT_PUBLIC_MATTERPORT_SDK_KEY ?? '';
  const spaceId = 'RXLkh8vriYF';

  // Stable callback refs so we don't re-init the viewer when parent re-renders
  const cbsRef = useRef({ onMarkerClick, onCameraMove, onSdkReady });
  useEffect(() => {
    cbsRef.current = { onMarkerClick, onCameraMove, onSdkReady };
  }, [onMarkerClick, onCameraMove, onSdkReady]);

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
                lastIntersectionRef.current = intersection;
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

  // Mirror View: when syncedCamera changes, try to align camera rotation
  useEffect(() => {
    const mpSdk = sdkRef.current;
    if (!syncedCamera || !mpSdk?.Camera?.setRotation) return;
    mpSdk.Camera.setRotation({
      x: syncedCamera.rotation.x,
      y: syncedCamera.rotation.y,
    }).catch(() => {
      // ignore — some poses aren't applicable
    });
  }, [syncedCamera]);

  const handleClickOverlay = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onMarkerClick) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const screenX = ((event.clientX - rect.left) / rect.width) * 100;
      const screenY = ((event.clientY - rect.top) / rect.height) * 100;
      const world = lastIntersectionRef.current?.position ?? { x: 0, y: 0, z: 0 };
      onMarkerClick({ world, screen: { x: screenX, y: screenY } });
    },
    [onMarkerClick]
  );

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Click capture overlay — sits above viewer when in marker mode */}
      {captureClicks && status === 'ready' && (
        <div
          onClick={handleClickOverlay}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            cursor: 'crosshair',
            background: 'transparent',
          }}
        />
      )}

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

      {/* Children render above viewer (markers, laser dot, zones, etc.) */}
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
            background: '#0a0f1e',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#f97316',
                boxShadow: '0 0 30px #f97316',
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
            background: '#0a0f1e',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <strong style={{ fontSize: '1.125rem', color: '#f97316' }}>Failed to load Matterport viewer</strong>
          <p style={{ maxWidth: '32rem', fontSize: '0.875rem', color: '#cbd5e1' }}>{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              border: '1px solid #f97316',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: '#f97316',
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
