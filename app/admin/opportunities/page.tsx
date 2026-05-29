import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manage Opportunities | Speevy',
};

const opportunities = [
  { status: 'Active', statusClass: 'cellstatus', interest: '35%' },
  { status: 'Potential', statusClass: 'cellstatus potential', interest: '35%' },
  { status: 'Draft', statusClass: 'cellstatus draft', interest: '-' },
  { status: 'Past', statusClass: 'cellstatus past', interest: '35%' },
];

export default function AdminOpportunitiesPage() {
  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">Manage Opportunities</div>
              <Link
                href="/admin/opportunities/frontier-security/edit"
                className="button short w-inline-block"
              >
                <div>Create New</div>
              </Link>
            </div>
            <div className="contenttable">
              <div className="tablerow headerrow">
                <div className="tablecell first">
                  <div className="interestchecks-row spacing">
                    <div className="checkboxtoggle sm" />
                  </div>
                  <div>Opportunity</div>
                </div>
                <div className="tablecell">
                  <div>Interest Value</div>
                </div>
                <div className="tablecell">
                  <div>Interested</div>
                </div>
                <div className="tablecell">
                  <div>Viewed</div>
                </div>
                <div className="tablecell actions">
                  <div>Actions</div>
                </div>
              </div>
              {opportunities.map((opportunity) => (
                <div className="tablerow" key={opportunity.status}>
                  <div className="tablecell first">
                    <div className="interestchecks-row spacing">
                      <div className="checkboxtoggle sm" />
                    </div>
                    <div className="rowicon-block">
                      <img
                        src="/webflow/images/photograph.svg"
                        loading="lazy"
                        alt=""
                        className="fullimage"
                      />
                    </div>
                    <div>
                      <div className="cellname">Frontier Security</div>
                      <div className={opportunity.statusClass}>{opportunity.status}</div>
                    </div>
                  </div>
                  <div className="tablecell">
                    {opportunity.interest === '-' ? (
                      <div>-</div>
                    ) : (
                      <div className="interestrow">
                        <div className="interestbar">
                          <div className="interestprogress">
                            <div className="percentinterest">{opportunity.interest}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="tablecell">
                    <div>
                      {opportunity.interest === '-' ? '-' : '15 '}
                      <span className="dimish">
                        {opportunity.interest === '-' ? '' : 'investors'}
                      </span>
                    </div>
                  </div>
                  <div className="tablecell">
                    <div>
                      {opportunity.interest === '-' ? '-' : '15 '}
                      <span className="dimish">
                        {opportunity.interest === '-' ? '' : 'times'}
                      </span>
                    </div>
                  </div>
                  <div className="tablecell actions">
                    <Link
                      href="/admin/opportunities/frontier-security/edit"
                      className="actionlinks w-inline-block"
                    >
                      <div>View / Edit</div>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
