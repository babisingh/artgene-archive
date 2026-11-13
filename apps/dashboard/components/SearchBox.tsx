"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Search on the home page. It carries the query to Browse, where the filters
 * and the results live, rather than rendering results of its own.
 */
export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      className="search-row"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        router.push(trimmed ? `/sequences?q=${encodeURIComponent(trimmed)}` : "/sequences");
      }}
    >
      <input
        id="home-search"
        className="input"
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        aria-label="Search the catalogue"
        placeholder="Search titles, venues and models"
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className="btn btn-primary">
        Search
      </button>
    </form>
  );
}
