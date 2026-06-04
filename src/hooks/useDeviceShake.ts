import { useEffect, useRef, useState } from 'react';

const SHAKE_THRESHOLD = 14;
const SHAKE_HOLD_MS = 3000;

/** True after the device is shaken continuously for more than 3 seconds. */
export function useDeviceShake(enabled: boolean): boolean {
  const [shookLongEnough, setShookLongEnough] = useState(false);
  const shakingSince = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;

    function onMotion(e: DeviceMotionEvent) {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) {
        return;
      }
      const dx = Math.abs(acc.x - lastX);
      const dy = Math.abs(acc.y - lastY);
      const dz = Math.abs(acc.z - lastZ);
      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;
      const magnitude = dx + dy + dz;
      const now = Date.now();

      if (magnitude > SHAKE_THRESHOLD) {
        if (shakingSince.current === null) {
          shakingSince.current = now;
        } else if (now - shakingSince.current >= SHAKE_HOLD_MS) {
          setShookLongEnough(true);
        }
      } else {
        shakingSince.current = null;
      }
    }

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setShookLongEnough(false);
      shakingSince.current = null;
    }
  }, [enabled]);

  return shookLongEnough;
}
