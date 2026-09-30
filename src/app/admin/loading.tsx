export default function AdminLoading() {
  return (
    <div className="sl-loading-page" aria-label="Loading page">
      <div className="sl-loading-header">
        <div>
          <div className="sl-skeleton h-3 w-28" />
          <div className="sl-skeleton mt-4 h-10 w-56" />
          <div className="sl-skeleton mt-3 h-4 w-80 max-w-full" />
        </div>

        <div className="sl-skeleton h-10 w-32" />
      </div>

      <div className="sl-loading-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="sl-loading-card" key={index}>
            <div className="sl-skeleton h-3 w-24" />
            <div className="sl-skeleton mt-5 h-9 w-20" />
            <div className="sl-skeleton mt-4 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="sl-loading-panels">
        <div className="sl-loading-panel">
          <div className="sl-skeleton h-5 w-36" />

          {Array.from({ length: 4 }).map((_, index) => (
            <div className="sl-loading-row" key={index}>
              <div>
                <div className="sl-skeleton h-4 w-48 max-w-full" />
                <div className="sl-skeleton mt-2 h-3 w-32" />
              </div>

              <div className="sl-skeleton h-6 w-16" />
            </div>
          ))}
        </div>

        <div className="sl-loading-panel">
          <div className="sl-skeleton h-5 w-36" />

          {Array.from({ length: 4 }).map((_, index) => (
            <div className="sl-loading-row" key={index}>
              <div>
                <div className="sl-skeleton h-4 w-44 max-w-full" />
                <div className="sl-skeleton mt-2 h-3 w-52 max-w-full" />
              </div>

              <div className="sl-skeleton h-6 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}