"use client";

import * as React from "react";

/**
 * Tells you a render finished while you were not looking.
 *
 * The tab title changes only when the page is actually hidden, and it is put
 * back the moment you return — a title that stays rewritten after you have
 * already seen the result is just noise.
 */
export function useTabTitleAlert() {
  const originalRef = React.useRef<string | null>(null);
  const [pending, setPending] = React.useState(0);

  React.useEffect(() => {
    if (originalRef.current === null) originalRef.current = document.title;

    const restore = () => {
      setPending(0);
      if (originalRef.current) document.title = originalRef.current;
    };

    const onVisibility = () => {
      if (!document.hidden) restore();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", restore);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", restore);
      if (originalRef.current) document.title = originalRef.current;
    };
  }, []);

  React.useEffect(() => {
    if (!originalRef.current) return;
    document.title = pending > 0 ? `(${pending}) Ready · Kinora` : originalRef.current;
  }, [pending]);

  return React.useCallback(() => {
    if (document.hidden) setPending((count) => count + 1);
  }, []);
}
