'use client';

import { Alert } from 'antd';

/**
 * One place that says "these numbers may not be complete".
 *
 * Shown on the dashboard AND the report, because a missing month is wrong on
 * every screen that reads it, and a warning only on the page you did not open
 * is no warning at all.
 */
export function DataHealthAlert({
  missing, failed, asAt,
}: {
  missing: string[];
  failed: { fileName: string; reason: string }[];
  asAt: { period: string; monthsBehind: number } | null;
}) {
  if (missing.length) {
    return (
      <Alert
        type="error"
        showIcon
        message={
          missing.length === 1
            ? `A statement is missing: ${missing[0]}`
            : `${missing.length} statements are missing: ${missing.join(', ')}`
        }
        description={
          <>
            Every figure spanning {missing.length === 1 ? 'that month' : 'those months'} is
            incomplete until {missing.length === 1 ? 'it is' : 'they are'} uploaded.
            {failed.length > 0 && (
              <> One or more uploads were also refused — see below.</>
            )}
          </>
        }
      />
    );
  }
  if (failed.length) {
    return (
      <Alert
        type="warning"
        showIcon
        message={`${failed.length} statement${failed.length === 1 ? '' : 's'} could not be read`}
        description={failed.map((f) => <div key={f.fileName}>{f.fileName} — {f.reason}</div>)}
      />
    );
  }
  if (asAt && asAt.monthsBehind >= 2) {
    return (
      <Alert
        type="warning"
        showIcon
        message={`Last statement: ${asAt.period} — about ${asAt.monthsBehind} months out of date`}
        description="Upload your newer statements to bring these figures up to date."
      />
    );
  }
  return null;
}
