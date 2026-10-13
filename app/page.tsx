import Approach from "@/components/Approach";
import Hero from "@/components/Hero";
import Navigation from "@/components/Navigation";
import Promises from "@/components/Promises";
import ProjectShowcase from "@/components/ProjectShowcase";
import StudioWall from "@/components/StudioWall";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <StudioWall />
        <ProjectShowcase />
        <Promises />
        <Approach />
      </main>
    </>
  );
}
