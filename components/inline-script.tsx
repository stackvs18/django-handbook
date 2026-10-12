// Runs during HTML parsing on a full page load (before first paint).
// On the client the script is inert (text/plain) so React stays quiet.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
