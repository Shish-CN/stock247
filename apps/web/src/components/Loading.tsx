export function LoadingRows() {
  return (
    <div className="space-y-3" aria-label="正在加载行情">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}
