import { useEffect, useState } from 'react';
import { fetchHostStatus, type HostStatus } from '../api/client';
import './HostServerPanel.css';

interface HostServerPanelProps {
  open: boolean;
  onClose: () => void;
}

const POLL_MS = 5000;

export function HostServerPanel({ open, onClose }: HostServerPanelProps) {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    const load = () => {
      fetchHostStatus()
        .then((s) => {
          if (active) {
            setStatus(s);
            setError(null);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err instanceof Error ? err.message : 'Host status unavailable');
          }
        });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="host-server" role="dialog" aria-label="Host Server">
      <div className="host-server__panel">
        <header className="host-server__header">
          <h3>Host Server</h3>
          <button type="button" className="host-server__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {error && <p className="host-server__error">{error}</p>}

        <dl className="host-server__info">
          <div>
            <dt>Status</dt>
            <dd className="host-server__status">{status ? status.status : 'checking…'}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd className="host-server__address">{status?.address ?? '—'}</dd>
          </div>
          <div>
            <dt>Connected players</dt>
            <dd>{status ? status.players : '—'}</dd>
          </div>
        </dl>

        {status?.qrDataUrl && (
          <div className="host-server__qr">
            <img src={status.qrDataUrl} alt={`QR code for ${status.joinAddress}`} />
            <p className="host-server__qr-caption">Scan to join {status.joinAddress}</p>
          </div>
        )}

        <p className="host-server__note">Players on the same Wi-Fi or hotspot can scan to join.</p>
      </div>
    </div>
  );
}
