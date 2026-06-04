import Link from 'next/link';

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
    <div className="pagenav">
      <div className="pagecontainer navcontainer">
        <div className="navalign">
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
          <div className="navalign">
            <Link href="/admin/opportunities" className="navlink w-inline-block">
              <div>Opportunities</div>
            </Link>
            <Link href="/admin/investors" className="navlink w-inline-block">
              <div>Investors</div>
            </Link>
            <Link href="/admin/tags" className="navlink w-inline-block">
              <div>Tags</div>
            </Link>
            <Link href="/admin/nda-templates" className="navlink w-inline-block">
              <div>NDA Templates</div>
            </Link>
          </div>
        </div>
        <div className="navalign">
          <Link href="/admin/company" className="navlink w-inline-block">
            <div>Company</div>
          </Link>
          <div className="profileblock">
            <a href="#" className="profilelink w-inline-block">
              <div className="profilesquare">
                <UserIcon />
              </div>
              <div>{displayName}</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
