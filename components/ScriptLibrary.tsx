'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';

export function ScriptLibrary() {
  const scripts = useScriptStore((s) => s.scripts);
  const activeScriptId = useScriptStore((s) => s.activeScriptId);
  const setActive = useScriptStore((s) => s.setActive);
  const deleteScript = useScriptStore((s) => s.deleteScript);
  const hydrated = useScriptStore((s) => s.hydrated);
  const hydrate = useScriptStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const sorted = [...scripts].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1
  );

  return (
    <section className="panel" aria-label="Library">
      <div className="panel-head">
        <div className="title">
          <span className="marker" />
          Library
        </div>
        <div className="meta">
          {hydrated
            ? `${sorted.length} script${sorted.length === 1 ? '' : 's'}`
            : 'Loading…'}
        </div>
      </div>

      <div className="panel-body">
        {hydrated && sorted.length === 0 ? (
          <div className="lib-empty">
            <span className="em">No scripts yet</span>
            Paste one on the right and hit Save.
          </div>
        ) : (
          <ul className="lib-list">
            {sorted.map((s) => (
              <li
                key={s.id}
                className={`script-card ${activeScriptId === s.id ? 'active' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setActive(s.id)}
                  className="sc-title"
                >
                  {s.title}
                </button>
                <div className="sc-meta">
                  <span>{s.language.toUpperCase()}</span>
                  <span className="sep" />
                  <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                  <span className="sep" />
                  <span>
                    {Math.max(1, Math.round((s.content || '').length / 800))} min
                  </span>
                </div>
                <div className="sc-actions">
                  <Link
                    href={`/run?id=${s.id}`}
                    className="btn btn-primary btn-sm"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12">
                      <path d="M2 1 L10 6 L2 11 Z" fill="currentColor" />
                    </svg>
                    Run
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${s.title}"?`)) deleteScript(s.id);
                    }}
                    className="btn btn-ghost btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
