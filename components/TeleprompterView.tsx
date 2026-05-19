'use client';

import { useEffect, useRef } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import { WordSpan } from './WordSpan';

type Props = {
  scriptId: string;
};

export function TeleprompterView({ scriptId }: Props) {
  const hydrated = useScriptStore((s) => s.hydrated);
  const hydrate = useScriptStore((s) => s.hydrate);
  const script = useScriptStore((s) =>
    s.scripts.find((x) => x.id === scriptId)
  );
  const tokens = useScriptStore((s) => s.tokens);
  const cursor = useScriptStore((s) => s.cursor);
  const setTokensFromContent = useScriptStore((s) => s.setTokensFromContent);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const mirrorMode = useSettingsStore((s) => s.mirrorMode);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Hydrate the script store on first mount
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Re-tokenize whenever the script changes
  useEffect(() => {
    if (script) setTokensFromContent(script.content, script.language);
  }, [script, setTokensFromContent]);

  // Manual auto-scroll: keep current word vertically centered.
  // (Real auto-scroll-on-voice arrives in v0.3 — this is the foundation.)
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current.querySelector(
      `[data-word-idx="${cursor}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [cursor]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!script) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-red-400">
        Script not found.
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="min-h-screen w-full overflow-y-auto bg-black px-12 py-32"
      style={{
        fontSize: `${fontSize}px`,
        lineHeight,
        transform: mirrorMode ? 'scaleX(-1)' : 'none',
      }}
    >
      <div className="mx-auto max-w-5xl font-thai font-medium">
        {tokens.length === 0 ? (
          <p className="text-center text-2xl text-zinc-600">
            Start writing your script… <span className="text-zinc-700">(click ✎ Edit)</span>
          </p>
        ) : (
          tokens.map((t) => (
            <WordSpan
              key={t.index}
              index={t.index}
              text={t.text}
              isWhitespace={t.isWhitespace}
            />
          ))
        )}
      </div>
    </div>
  );
}
