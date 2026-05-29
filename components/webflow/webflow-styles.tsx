export function WebflowStyles() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Figtree:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=Manrope:wght@200;300;400;500;600;700&display=swap"
      />
      <link
        rel="stylesheet"
        href="/webflow/css/normalize.css"
        precedence="webflow-1"
      />
      <link
        rel="stylesheet"
        href="/webflow/css/webflow.css"
        precedence="webflow-2"
      />
      <link
        rel="stylesheet"
        href="/webflow/css/speevy.webflow.css"
        precedence="webflow-3"
      />
    </>
  );
}
