const baseUrl = (process.env.PRODUCTION_URL ?? 'https://speevy.vc').replace(/\/$/, '');

const checks = [
  { path: '/', status: 200 },
  { path: '/login', status: 200 },
  { path: '/opportunities', status: 200, finalPath: '/login' },
  { path: '/admin/opportunities', status: 200, finalPath: '/login' },
];

let failed = false;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'SpeevyProductionCheck/1.0',
      },
    });
    const finalUrl = new URL(response.url);
    const statusOk = response.status === check.status;
    const finalPathOk = check.finalPath ? finalUrl.pathname === check.finalPath : true;

    if (!statusOk || !finalPathOk) {
      failed = true;
      console.error(
        `FAIL ${url} -> ${response.status} ${response.url}`,
      );
      continue;
    }

    console.log(`OK ${url} -> ${response.status} ${response.url}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${url} -> ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) {
  process.exit(1);
}
