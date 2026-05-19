import { TeleprompterView } from '@/components/TeleprompterView';
import { ControlBar } from '@/components/ControlBar';

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <TeleprompterView scriptId={id} />
      <ControlBar />
      {/* Spacer so the last lines aren't hidden behind the fixed control bar */}
      <div className="h-32" />
    </div>
  );
}
