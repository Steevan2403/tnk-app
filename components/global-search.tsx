"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { isSearchable, normalizeSearchQuery, type SearchHit, type SearchResults } from "@/lib/search";

const DEBOUNCE_MS = 200;

export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const [popupBox, setPopupBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [request, setRequest] = useState("");
  const [groups, setGroups] = useState<SearchResults["groups"]>([]);
  const [active, setActive] = useState(-1);

  const normalized = normalizeSearchQuery(query);
  const searchable = isSearchable(normalized);
  const current = request === normalized && (status === "ready" || status === "error");
  const shown = current && status === "ready" ? groups : [];
  const hits = shown.flatMap((group) => group.hits);
  const optionCount = hits.length > 0 ? hits.length + 1 : 0;
  const popupOpen = open && searchable;

  useEffect(() => {
    if (!searchable) return;
    const id = ++requestId.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as SearchResults;
        if (controller.signal.aborted || requestId.current !== id || data.query !== normalized) return;
        setGroups(data.groups);
        setRequest(normalized);
        setStatus("ready");
        setActive(-1);
      } catch (error) {
        if (controller.signal.aborted || requestId.current !== id) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGroups([]);
        setRequest(normalized);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalized, searchable]);

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  useEffect(() => {
    if (!popupOpen) return;
    function place() {
      const rect = boxRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const width = Math.min(576, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
      setPopupBox({ top: rect.bottom + 4, left, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [popupOpen]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (active >= 0 && active < hits.length) {
      event.preventDefault();
      go(hits[active].href);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (popupOpen) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      }
      return;
    }
    if (!popupOpen) {
      if (event.key === "ArrowDown" && searchable) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (optionCount === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((currentIndex) => (currentIndex + 1) % optionCount);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((currentIndex) => (currentIndex <= 0 ? optionCount - 1 : currentIndex - 1));
    } else if (event.key === "Enter" && active >= 0 && active < hits.length) {
      event.preventDefault();
      go(hits[active].href);
    }
  }

  let optionIndex = 0;

  return (
    <form ref={rootRef} action="/search" method="get" role="search" className="relative min-w-0 flex-1" onSubmit={onSubmit}>
      <div ref={boxRef} className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          name="q"
          value={query}
          role="combobox"
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={popupOpen}
          aria-controls={popupOpen ? listId : undefined}
          aria-activedescendant={active >= 0 ? `${listId}-option-${active}` : undefined}
          placeholder="Search"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={80}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => {
            if (searchable) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-line bg-page py-2 pr-3 pl-9 text-sm outline-none focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/30"
        />
        {popupOpen && popupBox ? (
          <div
            id={listId}
            className="fixed z-30 max-h-[70dvh] overflow-y-auto rounded-xl border border-line bg-card shadow-lg"
            style={{ top: popupBox.top, left: popupBox.left, width: popupBox.width }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {shown.length > 0 ? (
              <div role="listbox" aria-label="Search results">
                {shown.map((group) => (
                  <div key={group.kind} role="group" aria-label={group.label}>
                    <div className="px-3 pt-3 pb-1 text-[0.72rem] font-semibold tracking-[0.06em] text-muted uppercase">{group.label}</div>
                    {group.hits.map((hit) => {
                      const index = optionIndex++;
                      return <ResultOption key={hit.id} hit={hit} index={index} active={active === index} listId={listId} onHighlight={setActive} />;
                    })}
                  </div>
                ))}
                <Link
                  id={`${listId}-option-${hits.length}`}
                  role="option"
                  aria-selected={active === hits.length}
                  href={`/search?q=${encodeURIComponent(normalized)}`}
                  className={`block border-t border-line px-3 py-2.5 text-sm font-medium text-brand-blue ${active === hits.length ? "bg-[#f3f6fd]" : "hover:bg-[#f3f6fd]"}`}
                  onMouseEnter={() => setActive(hits.length)}
                >
                  See all results
                </Link>
              </div>
            ) : (
              <p role="status" className="px-3 py-3 text-sm text-muted">
                {status === "error" && current
                  ? "Search is unavailable."
                  : status === "ready" && current
                    ? `No matches for “${normalized}”.`
                    : "Searching…"}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}

function ResultOption({
  hit,
  index,
  active,
  listId,
  onHighlight,
}: {
  hit: SearchHit;
  index: number;
  active: boolean;
  listId: string;
  onHighlight: (index: number) => void;
}) {
  return (
    <Link
      id={`${listId}-option-${index}`}
      role="option"
      aria-selected={active}
      href={hit.href}
      className={`block px-3 py-2 ${active ? "bg-[#f3f6fd]" : "hover:bg-[#f3f6fd]"}`}
      onMouseEnter={() => onHighlight(index)}
    >
      <span className="block truncate text-sm font-medium text-ink">{hit.title}</span>
      {hit.detail ? <span className="block truncate text-xs text-muted">{hit.detail}</span> : null}
    </Link>
  );
}
