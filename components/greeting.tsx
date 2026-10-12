"use client";

import { useId } from "react";
import { InlineScript } from "./inline-script";

// Shared by the React render and the inline script so both always agree.
const GREETING_FN = `function(h){return h>=5&&h<12?"Good morning":h>=12&&h<17?"Good afternoon":"Good evening"}`;

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Uses the visitor's own clock. The inline script corrects the
 * server-rendered text before paint on hard loads; on client-side
 * navigation the component renders with the browser's time directly.
 */
export function Greeting({ className }: { className?: string }) {
  const id = useId();
  return (
    <>
      <span id={id} className={className} suppressHydrationWarning>
        {greetingFor(new Date().getHours())}
      </span>
      <InlineScript
        html={`{var n=document.getElementById(${JSON.stringify(id)});if(n)n.textContent=(${GREETING_FN})(new Date().getHours())}`}
      />
    </>
  );
}
