"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

export function RouteLink({ href, children, className, loadingLabel }: { href: string; children: ReactNode; className?: string; loadingLabel: string }) {
  const [loading, setLoading] = useState(false);
  const routeHref = process.env.NODE_ENV === "production"
    ? `/Website/ChineseReader/out${href === "/" ? "/" : `${href}/`}`
    : href;

  const beginNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setLoading(true);
  };

  return <>
    <a href={routeHref} className={className} onClick={beginNavigation} aria-busy={loading}>{children}</a>
    {loading && <div className="route-loading" role="status" aria-live="polite"><span className="route-spinner" /><strong>{loadingLabel}</strong><small>Please wait a moment…</small></div>}
  </>;
}
