export default function AppLoading() {
  return (
    <div className="mx-auto max-w-[1480px] animate-pulse px-4 py-6 sm:px-6 xl:px-8">
      <div className="h-3 w-28 rounded bg-rule/80" />
      <div className="mt-2 h-8 w-64 rounded bg-rule/70" />
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-[10px] border border-rule bg-paper" />
        ))}
      </div>
      <div className="mt-4 h-64 rounded-[10px] border border-rule bg-paper" />
    </div>
  );
}
