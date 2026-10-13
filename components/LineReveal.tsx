import type { ReactNode } from "react";

/**
 * A masked line (`.ln`). With `reveal`, the line slides up from its mask when
 * it scrolls into view (wired up by revealLines() in the section's animation).
 */
export default function Line({
  children,
  reveal = true,
  className = "",
}: {
  children: ReactNode;
  reveal?: boolean;
  className?: string;
}) {
  return (
    <span className={`ln ${reveal ? "rv" : ""} ${className}`}>
      <span>{children}</span>
    </span>
  );
}
