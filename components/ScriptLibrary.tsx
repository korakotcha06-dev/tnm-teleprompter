'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { estimateMinutes } from '@/lib/readingPace';
import {
  exportLibrary,
  exportScript,
  parseImportFile,
} from '@/lib/storage/shareScript';

export function ScriptLibrary() {
  const scripts = useScriptStore((s) => s.scripts);
  const activeScriptId = useScriptStore((s) => s.activeScriptId);
  const setActive = useScriptStore((s) => s.setActive);
  const deleteScript = useScriptStore((s) => s.deleteScript);
  const putScript = useScriptStore((s) => s.putScript);
  const hydrated = useScriptStore((s) => s.hydrated);
  const hydrate = useScriptStore((s) => s.hydrate);

  // Hidden file input drives Import; we click() it from the visible button.
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Transient result/error line under the header after an import.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const handleImportFile = async (file: File) => {
    setNotice(null);
    try {
      const incoming = parseImportFile(await file.text());
      const existing = useScriptStore.getState().scripts;
      let added = 0;
      let overwritten = 0;
      let skipped = 0;
      for (const sc of incoming) {
        const dup = existing.find((x) => x.id === sc.id);
        if (dup) {
          // Duplicate id → ask: OK = overwrite, Cancel = skip.
          if (!confirm(`"${sc.title}" มีอยู่แล้ว — ทับของเดิม?\n(ยกเลิก = ข้าม)`)) {
            skipped++;
            continue;
          }
          putScript({ ...sc, updatedAt: new Date().toISOString() });
          overwritten++;
        } else {
          putScript(sc);
          added++;
        }
      }
      setNotice(`นำเข้าแล้ว — เพิ่ม ${added} · ทับ ${overwritten} · ข้าม ${skipped}`);
    } catch (err) {
      setNotice(
        `นำเข้าไม่สำเร็จ: ${err instanceof Error ? err.message : 'ไฟล์ไม่ถูกต้อง'}`
      );
    }
  };

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
        <div className="lib-actions">
          <span className="meta">
            {hydrated
              ? `${sorted.length} script${sorted.length === 1 ? '' : 's'}`
              : 'Loading…'}
          </span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn btn-ghost btn-sm"
            title="นำเข้าสคริปต์จากไฟล์ .json"
          >
            ↓ Import
          </button>
          {hydrated && sorted.length > 0 ? (
            <button
              type="button"
              onClick={() => exportLibrary(scripts)}
              className="btn btn-ghost btn-sm"
              title="ส่งออกสคริปต์ทั้งหมดเป็นไฟล์เดียว (สำรองข้อมูล)"
            >
              ↑ Export all
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = ''; // allow re-importing the same file
            }}
          />
        </div>
      </div>

      {notice ? (
        <div className="lib-notice" role="status">
          {notice}
        </div>
      ) : null}

      <div className="panel-body">
        {hydrated && sorted.length === 0 ? (
          <div className="lib-empty">
            <span className="em">No scripts yet</span>
            Paste one on the right — it saves automatically.
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
                    {estimateMinutes(s.content || '', s.language)} min
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
                    onClick={() => exportScript(s)}
                    className="btn btn-ghost btn-sm"
                    title="ส่งออกสคริปต์นี้เป็นไฟล์ .json เพื่อแชร์"
                  >
                    Export
                  </button>
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
