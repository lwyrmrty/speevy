import { initialsForInvestorLabel } from '@/lib/lp-profile-picture';

export function InvestorProfileSquare({
  fullName,
  email,
  photoUrl,
}: {
  fullName: string | null;
  email: string;
  photoUrl?: string | null;
}) {
  const label = fullName || email;
  const initials = initialsForInvestorLabel(label);

  if (photoUrl) {
    return (
      <div className="profilesquare speevy-profilesquare-photo">
        <img alt="" src={photoUrl} loading="lazy" className="full-image" />
      </div>
    );
  }

  return (
    <div className="profilesquare">
      <div>{initials}</div>
    </div>
  );
}
