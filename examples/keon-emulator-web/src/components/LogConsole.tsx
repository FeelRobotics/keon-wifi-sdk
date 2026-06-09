import { useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import type { LogEntry } from '@/types/api';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

function directionIcon(direction: LogEntry['direction']): string {
  switch (direction) {
    case 'in':
      return '▼';
    case 'out':
      return '▲';
    case 'error':
      return '✖';
    case 'system':
      return '◆';
  }
}

function directionClass(direction: LogEntry['direction']): string {
  switch (direction) {
    case 'in':
      return 'log-in';
    case 'out':
      return 'log-out';
    case 'error':
      return 'log-error';
    case 'system':
      return 'log-system';
  }
}

/**
 * Scrollable log console for provisioning errors and every Socket.IO frame.
 * Auto-scrolls to bottom when new entries arrive.
 */
export function LogConsole() {
  const logs = useAppStore((s) => s.logs);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const handleCopy = () => {
    const text = logs
      .map(
        (e) =>
          `[${formatTimestamp(e.timestamp)}] ${directionIcon(e.direction)} ${e.event}: ${JSON.stringify(e.data)}`,
      )
      .join('\n');
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className="log-console">
      <div className="log-header">
        <span className="log-title">Log Console ({logs.length} entries)</span>
        <div className="log-actions">
          <button className="btn btn-xs btn-ghost" onClick={handleCopy} disabled={logs.length === 0}>
            Copy
          </button>
          <button className="btn btn-xs btn-ghost" onClick={clearLogs} disabled={logs.length === 0}>
            Clear
          </button>
        </div>
      </div>

      <div className="log-body" role="log" aria-live="polite" aria-label="Event log">
        {logs.length === 0 && (
          <span className="log-empty">No events yet — provision to start.</span>
        )}
        {logs.map((entry) => (
          <div key={entry.id} className={`log-entry ${directionClass(entry.direction)}`}>
            <span className="log-ts">{formatTimestamp(entry.timestamp)}</span>
            <span className="log-dir" title={entry.direction}>
              {directionIcon(entry.direction)}
            </span>
            <span className="log-event">{entry.event}</span>
            <span className="log-data">
              {typeof entry.data === 'string'
                ? entry.data
                : JSON.stringify(entry.data)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
