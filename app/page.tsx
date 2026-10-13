import Hero from "@/components/Hero";
import Navigation from "@/components/Navigation";
import StudioWall from "@/components/StudioWall";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <StudioWall />
      </main>
    </>
  );
}
