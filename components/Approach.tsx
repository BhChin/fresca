"use client";

import Image from "next/image";
import { useRef } from "react";
import { approach } from "@/content/site";
import { gsap, useGSAP } from "@/lib/gsap";
import { DESKTOP_MOTION } from "@/lib/motion";

// Pinned horizontal layout only on desktop with motion (`md:motion-safe:`);
// otherwise the panels stack vertically.
export default function Approach() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(DESKTOP_MOTION, () => {
        const track = root.current!.querySelector<HTMLElement>(".ap-track")!;
        const dist = () => track.scrollWidth - window.innerWidth;
        gsap.set(track, { y: 0, yPercent: -50 });

        // The headline halves split apart while the track scales in, then the track scrolls sideways.
        gsap
          .timeline({
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: () => `+=${dist() + window.innerHeight * 1.4}`,
              pin: true,
              scrub: 1,
              invalidateOnRefresh: true,
            },
          })
          .to(".ap-l", { xPercent: -40, yPercent: -160, ease: "none", duration: 1 }, 0)
          .to(".ap-r", { xPercent: 30, yPercent: 160, ease: "none", duration: 1 }, 0)
          .to(".ap-l, .ap-r", { opacity: 0, ease: "power1.in", duration: 0.45 }, 0)
          .fromTo(track, { scale: 0.5, opacity: 0, x: () => window.innerWidth * 0.3 }, { scale: 1, opacity: 1, x: 0, ease: "power2.out", duration: 1.1 }, 0.35)
          .to(track, { x: () => -dist(), ease: "none", duration: 3 }, 1.35);
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="approach"
      aria-label="Our approach"
      className="relative bg-accent py-24 text-ground md:motion-safe:h-svh md:motion-safe:overflow-hidden md:motion-safe:py-0"
    >
      <div className="pointer-events-none relative flex flex-col justify-center px-pad pb-14 md:motion-safe:absolute md:motion-safe:inset-0 md:motion-safe:pb-0">
        <p className="cap ap-l mb-7 block text-on-dark">{approach.eyebrow}</p>
        <h2 className="font-serif text-[clamp(48px,7vw,120px)] font-normal leading-[.95]">
          <span className="ap-l block">{approach.heading[0]}</span>
          <span className="ap-r block text-right italic">{approach.heading[1]}</span>
        </h2>
      </div>

      <div className="ap-track relative flex flex-col gap-[72px] px-pad md:motion-safe:absolute md:motion-safe:left-0 md:motion-safe:top-1/2 md:motion-safe:origin-[0_50%] md:motion-safe:-translate-y-1/2 md:motion-safe:flex-row md:motion-safe:gap-[4vw] md:motion-safe:pl-[6vw] md:motion-safe:pr-[8vw]">
        {approach.panels.map((panel, i) => (
          <div
            key={panel.title}
            className="grid grid-cols-1 items-end gap-7 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] md:motion-safe:flex-[0_0_min(78vw,980px)]"
          >
            <div>
              <span className="font-serif text-[30px] italic text-gold">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mb-3.5 mt-2 font-serif text-[clamp(48px,5vw,84px)] font-normal leading-[.95]">{panel.title}</h3>
              <p className="max-w-[340px] text-on-dark">{panel.text}</p>
            </div>
            <div className="relative h-[72vw] md:h-[min(62vh,560px)]">
              <div className="absolute right-0 top-0 h-[82%] w-[72%] overflow-hidden rounded">
                <Image src={panel.photo.src} alt={panel.photo.alt} fill quality={85} sizes="(min-width: 861px) 32vw, 72vw" className="object-cover" />
              </div>
              <div className="absolute bottom-0 left-0 aspect-[16/10] w-[56%] rounded bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,.25)]">
                <div className="relative h-full w-full">
                  <Image src={panel.board.src} alt={panel.board.alt} fill quality={85} sizes="(min-width: 861px) 25vw, 56vw" className="object-contain" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
