import AnonSessionGate from "@/components/AnonSessionGate";
import LandingClient from "@/components/landing/LandingClient";

export default function Home() {
  return (
    <>
      <AnonSessionGate />
      <main>
        <LandingClient />
      </main>
    </>
  );
}
