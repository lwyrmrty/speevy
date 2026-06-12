import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'lp';
  created_at: string;
};

function initialsFor(member: TeamMember) {
  const source = member.full_name || member.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export default async function AdminCompanyPage() {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .eq('role', 'admin')
    .order('full_name', { ascending: true });

  const teamMembers = (data ?? []) as TeamMember[];

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div>
                <div className="pagetitle">Company Settings</div>
                <div className="pagesubtitle">View the team members with admin access.</div>
              </div>
              <div className="pillstat">
                <div>{teamMembers.length} admins</div>
              </div>
            </div>

            <div className="pagecard full">
              <div className="cardblock">
                <div className="sideheading large">Team Members</div>
                <div className="sidesubheading">
                  These people can sign in to the admin area and manage Speevy.
                </div>
              </div>

              <div className="speevy-responsive-rows">
                <div className="tablerow headerrow">
                  <div className="tablecell first">Name</div>
                  <div className="tablecell wide">Email</div>
                  <div className="tablecell short">Role</div>
                  <div className="tablecell short">Added</div>
                </div>

                {teamMembers.map((member) => (
                  <div key={member.id} className="tablerow">
                    <div className="tablecell first">
                      <div className="profilesquare">
                        <div>{initialsFor(member)}</div>
                      </div>
                      <div>{member.full_name || member.email}</div>
                    </div>
                    <div className="tablecell wide">{member.email}</div>
                    <div className="tablecell short">
                      <div className="pillstat green">
                        <div>Admin</div>
                      </div>
                    </div>
                    <div className="tablecell short">{formatDate(member.created_at)}</div>
                  </div>
                ))}

                {teamMembers.length === 0 ? (
                  <div className="tablerow">
                    <div className="tablecell">No team members found.</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
