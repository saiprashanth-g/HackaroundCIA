import AnonSessionGate from "@/components/AnonSessionGate";
import { FunnelTopBar } from "@/components/ui/FunnelTopBar";
import { StepHeader } from "@/components/ui/StepHeader";
import UploadClient from "@/components/upload/UploadClient";

export const metadata = { title: "Upload · HackaroundCIA" };

export default function UploadPage() {
  return (
    <>
      <AnonSessionGate />
      <FunnelTopBar />
      <main className="mx-auto max-w-canvas px-8 pb-28 pt-16">
        <StepHeader
          step={1}
          total={3}
          label="Upload"
          title="Drop in your course plans"
          sub="Up to five course or CIA plans — one per subject. Clean PDFs or clear phone photos both work. We'll read and reconcile them next."
        />
        <div className="mt-12 max-w-3xl">
          <UploadClient />
        </div>
      </main>
    </>
  );
}
