import { useCallback, useEffect, useRef } from 'react';

const SHAKE_THRESHOLD = 14;
const COOLDOWN_MIN_MS = 1200;
const COOLDOWN_MAX_MS = 1800;

function randomCooldownMs(): number {
  return COOLDOWN_MIN_MS + Math.floor(Math.random() * (COOLDOWN_MAX_MS - COOLDOWN_MIN_MS + 1));
}

function getDeviceMotionCtor():
  | (typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    })
  | null {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') {
    return null;
  }
  return DeviceMotionEvent as typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
}

function needsMotionPermission(): boolean {
  const ctor = getDeviceMotionCtor();
  return typeof ctor?.requestPermission === 'function';
}

export function useShakeDetector(
  enabled: boolean,
  onShake: () => void,
): { requestMotionAccess: () => Promise<boolean> } {
  const onShakeRef = useRef(onShake);
  const lastShakeAt = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastZ = useRef(0);
  const listening = useRef(false);
  const permissionGranted = useRef(!needsMotionPermission());

  onShakeRef.current = onShake;

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) {
      return;
    }
    const dx = Math.abs(acc.x - lastX.current);
    const dy = Math.abs(acc.y - lastY.current);
    const dz = Math.abs(acc.z - lastZ.current);
    lastX.current = acc.x;
    lastY.current = acc.y;
    lastZ.current = acc.z;

    if (dx + dy + dz <= SHAKE_THRESHOLD) {
      return;
    }

    const now = Date.now();
    if (now - lastShakeAt.current < COOLDOWN_MIN_MS) {
      return;
    }
    lastShakeAt.current = now;
    onShakeRef.current();
  }, []);

  const stopListening = useCallback(() => {
    if (!listening.current || typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('devicemotion', handleMotion);
    listening.current = false;
  }, [handleMotion]);

  const startListening = useCallback(() => {
    if (listening.current || typeof window === 'undefined' || !permissionGranted.current) {
      return;
    }
    window.addEventListener('devicemotion', handleMotion);
    listening.current = true;
  }, [handleMotion]);

  const requestMotionAccess = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') {
      return false;
    }
    if (!needsMotionPermission()) {
      permissionGranted.current = true;
      startListening();
      return true;
    }
    try {
      const ctor = getDeviceMotionCtor();
      if (!ctor?.requestPermission) {
        return false;
      }
      const result = await ctor.requestPermission();
      permissionGranted.current = result === 'granted';
      if (permissionGranted.current) {
        startListening();
      }
      return permissionGranted.current;
    } catch {
      permissionGranted.current = false;
      return false;
    }
  }, [startListening]);

  useEffect(() => {
    if (!enabled) {
      stopListening();
      return;
    }
    if (permissionGranted.current) {
      startListening();
    }
    return stopListening;
  }, [enabled, startListening, stopListening]);

  useEffect(() => () => stopListening(), [stopListening]);

  return { requestMotionAccess };
}

export function getShakeCooldownMs(): number {
  return randomCooldownMs();
}
