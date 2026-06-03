import './MagicLinkResultScreen.css';

interface MagicLinkResultScreenProps {
  success: boolean;
  error?: string | null;
}

export function MagicLinkResultScreen({ success, error }: MagicLinkResultScreenProps) {
  function handleClose() {
    if (success) {
      window.history.replaceState({}, '', '/?newTable=1');
      window.location.assign('/?newTable=1');
      return;
    }
    window.history.replaceState({}, '', '/login');
    window.location.assign('/login');
  }

  return (
    <main className="magic-link-result">
      <div className="magic-link-result__card">
        {success ? (
          <>
            <h1 className="magic-link-result__title">Signed in</h1>
            <p className="magic-link-result__msg">You can close this page and return to the app.</p>
          </>
        ) : (
          <>
            <h1 className="magic-link-result__title">Sign-in failed</h1>
            <p className="magic-link-result__msg magic-link-result__msg--error" role="alert">
              {error?.trim() || 'This sign-in link is invalid or has expired.'}
            </p>
          </>
        )}
        <button type="button" className="magic-link-result__close" onClick={handleClose}>
          Close page
        </button>
      </div>
    </main>
  );
}
