'use client';

export default function LoginError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error.message?.trim();

  return (
    <div className="adminpage-wrapper nopadding">
      <div className="admin-wrapper tall">
        <div className="logincontent">
          <div className="loginblock">
            <div className="loginform-wrapper">
              <div className="formblock">
                <div className="loginform">
                  <div className="loginheader">Reload login</div>
                  <div className="loginsubheader">
                    Something interrupted sign-in. Reload and try again.
                  </div>
                  {message ? (
                    <div className="loginsubheader" style={{ color: '#b42318' }}>
                      {message}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="button w-button"
                    onClick={() => {
                      window.location.replace('/login');
                    }}
                  >
                    Reload login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
