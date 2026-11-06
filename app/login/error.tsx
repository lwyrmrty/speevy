'use client';

export default function LoginError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
                  <button type="button" className="button w-button" onClick={reset}>
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
