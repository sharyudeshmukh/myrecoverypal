export function Sparkline({ values, width = 96, height = 28 }: { values: (number | null)[]; width?: number; height?: number }) {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length < 2) return <div className="h-7 w-24" aria-hidden />;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values
    .map((v, i) => (v === null || !Number.isFinite(v) ? null : `${(i * stepX).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`))
    .filter((p): p is string => p !== null);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-primary" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (v === null || !Number.isFinite(v) ? null : <circle key={i} cx={i * stepX} cy={height - 3 - ((v - min) / span) * (height - 6)} r={1.8} fill="currentColor" />))}
    </svg>
  );
}
