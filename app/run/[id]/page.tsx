import { RunController } from '@/components/RunController';

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // RunController is the client boundary — it owns voice + mic permission +
  // teleprompter view + control bar lifecycle. This page stays a server
  // component so route param resolution happens before hydration.
  return <RunController scriptId={id} />;
}
