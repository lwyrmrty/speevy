import Link from 'next/link';

import { AdminNavLink } from '@/components/webflow/admin-nav-links';
import { WebflowMobileNavMenu } from '@/components/webflow/webflow-mobile-nav';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      className="usericon"
    >
      <path
        fill="currentColor"
        d="M12 12c2.206 0 4-1.794 4-4s-1.794-4-4-4-4 1.794-4 4 1.794 4 4 4Zm0 2c-2.67 0-8 1.337-8 4v2h16v-2c0-2.663-5.33-4-8-4Z"
      />
    </svg>
  );
}

export async function AdminNav() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };
  const displayName =
    profile?.full_name?.trim()
    || profile?.email
    || user?.email
    || 'Account';

  return (
    <div className="pagenav speevy-admin-nav">
      <div className="pagecontainer navcontainer">
        <div className="navalign speevy-nav-brand-row">
          <Link href="/admin/opportunities" className="navlogo-link w-inline-block">
            <img
              src="/webflow/images/Harpoon-Logo.png"
              loading="lazy"
              alt="Harpoon"
              sizes="(max-width: 931px) 100vw, 931px"
              srcSet="/webflow/images/Harpoon-Logo-p-500.png 500w, /webflow/images/Harpoon-Logo-p-800.png 800w, /webflow/images/Harpoon-Logo.png 931w"
              className="navlogo"
            />
          </Link>
          <WebflowMobileNavMenu>
            <div className="navalign speevy-nav-link-row">
              <AdminNavLink href="/admin/activity">Activity</AdminNavLink>
              <AdminNavLink href="/admin/messages">Messages</AdminNavLink>
              <AdminNavLink href="/admin/opportunities">Opportunities</AdminNavLink>
              <AdminNavLink href="/admin/investors">Investors</AdminNavLink>
              <AdminNavLink href="/admin/tags">Tags</AdminNavLink>
              <AdminNavLink href="/admin/nda-templates">NDA Templates</AdminNavLink>
              <AdminNavLink href="/admin/company">Company</AdminNavLink>
              <div className="profileblock speevy-nav-profile">
                <a href="#" className="profilelink w-inline-block">
                  <div className="profilesquare">
                    <UserIcon />
                  </div>
                  <div className="text-block">{displayName}</div>
                </a>
              </div>
            </div>
          </WebflowMobileNavMenu>
        </div>
      </div>
    </div>
  );
}
