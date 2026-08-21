export default function Loading() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-4 pt-10 sm:px-6 sm:pt-14">
      <div className="max-w-[55ch]">
        <div className="stencil mb-4 flex items-center gap-2 text-ink-3">
          <span className="inline-block h-1.5 w-1.5 animate-ping bg-jumper opacity-80" />
          Drawing the sheet
        </div>
        <div className="skeleton h-12 w-[80%] border border-rule" />
        <div className="skeleton mt-3 h-3 w-[62%]" style={{ animationDelay: '100ms' }} />
        <div className="skeleton mt-2 h-3 w-[48%]" style={{ animationDelay: '200ms' }} />
      </div>
      <div className="mt-12 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {[0, 1].map((column) => (
          <div key={column} className="border border-rule bg-sheet">
            <div className="border-b border-rule px-4 py-2.5">
              <div className="skeleton h-3 w-24" style={{ animationDelay: '150ms' }} />
            </div>
            <div className="ruled">
              {Array.from({ length: column === 0 ? 8 : 5 }).map((_, row) => (
                <div key={row} className="flex items-center gap-4 px-4 py-4">
                  <div
                    className="skeleton h-3 flex-1"
                    style={{ animationDelay: `${row * 100 + 100}ms` }}
                  />
                  <div
                    className="skeleton h-3 w-16"
                    style={{ animationDelay: `${row * 100 + 150}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading
      </span>
    </main>
  );
}
