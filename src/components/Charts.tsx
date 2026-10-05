import { Suspense, lazy, type ComponentProps } from 'react';

// The chart library is ~180 kB; load it only when a chart is first shown.
const LazySignalChart = lazy(() =>
  import('./PredictionCharts').then((m) => ({ default: m.SignalChart }))
);
const LazyOutlookChart = lazy(() =>
  import('./PredictionCharts').then((m) => ({ default: m.OutlookChart }))
);

function Placeholder({ height = 340 }: { height?: number }) {
  return (
    <div style={{ padding: 18 }}>
      <div className="skeleton" style={{ height: height + 44 }} />
    </div>
  );
}

export function SignalChart(
  props: ComponentProps<typeof import('./PredictionCharts').SignalChart>
) {
  return (
    <Suspense fallback={<Placeholder height={props.height} />}>
      <LazySignalChart {...props} />
    </Suspense>
  );
}

export function OutlookChart(
  props: ComponentProps<typeof import('./PredictionCharts').OutlookChart>
) {
  return (
    <Suspense fallback={<Placeholder height={props.height} />}>
      <LazyOutlookChart {...props} />
    </Suspense>
  );
}
