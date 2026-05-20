'use client';

// /run — static route for the teleprompter runner.
//
// Static-export refactor (v0.4): the runner was previously app/run/[id], a
// dynamic route. `output: 'export'` requires generateStaticParams() for every
// dynamic segment, but the id is a runtime UUID from localStorage — there is
// nothing to pre-generate at build time. So the route is now static (/run) and
// the id arrives via query string: /run?id=<uuid>.
//
// useSearchParams forces client-side rendering of everything up to the nearest
// Suspense boundary, and a prerendered (static-export) page that calls it MUST
// be wrapped in <Suspense> or the production build fails with the
// "Missing Suspense boundary with useSearchParams" error. Hence the split:
// the page is the Suspense host; RunnerInner does the actual reading.

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RunController } from '@/components/RunController';

function RunnerInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  // No ?id= at all → there's no script to run. Mirror the "Script not found"
  // experience but with an explicit way back to the library. (The id-present-
  // but-not-in-localStorage case is handled downstream in TeleprompterView.)
  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-zinc-300">
        <p className="text-red-400">Script not found.</p>
        <Link
          href="/"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-900"
        >
          ← Back to library
        </Link>
      </div>
    );
  }

  return <RunController scriptId={id} />;
}

export default function RunPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">
          Loading…
        </div>
      }
    >
      <RunnerInner />
    </Suspense>
  );
}
