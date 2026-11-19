"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Accession } from "../Accession";
import {
  CONFIRM_STATUSES,
  CatalogueError,
  FORWARD_STATUS,
  NEXT_STATUSES,
  STATUS_LABELS,
  STATUS_MEANINGS,
  STATUS_VERBS,
  changeStatus,
  fetchQueue,
  type CatalogueListItem,
  type CatalogueStatus,
} from "../../lib/catalogue";

/**
 * The editorial desk: moving a record from draft to published.
 *
 * Genome Watch files records and cannot publish them. Its key carries
 * catalogue:draft, and the scope check in the API refuses every publish
 * attempt it makes. That is the editorial control, and it is a permission
 * rather than a convention. This page is the other half of it: the place a
 * person does the publishing.
 *
 * A record walks draft, staged, reviewed, published. Four states rather than
 * two, so that reading a record and deciding to publish it are separate acts
 * and neither is a single click away from a robot's draft.
 *
 * The key lives in sessionStorage for the life of this tab, never in a cookie
 * and never in localStorage, so closing the tab ends the session. There is no
 * sign-in here: the key is the credential, and the archive checks it.
 */

const KEY_NAME = "artgene_api_key";

/** The queues shown, in the order a record walks them. */
const QUEUES: CatalogueStatus[] = ["draft", "staged", "reviewed", "restricted"];

/**
 * The ones that are actually waiting on a person.
 *
 * Restricted is shown because she needs to see it, but it is a resting state
 * rather than an inbox: a record sits there until there is a reason to move
 * it, and counting it as outstanding work would mean the page never reads
 * clear.
 */
const WAITING: CatalogueStatus[] = ["draft", "staged", "reviewed"];

function readStoredKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(KEY_NAME) ?? "";
  } catch {
    // Private browsing, or storage blocked. The page still works; the key
    // simply will not survive a reload.
    return "";
  }
}

function storeKey(key: string): void {
  try {
    if (key) window.sessionStorage.setItem(KEY_NAME, key);
    else window.sessionStorage.removeItem(KEY_NAME);
  } catch {
    /* nothing to do: the key stays in memory for this page */
  }
}

/**
 * What went wrong, said in words rather than a status code.
 *
 * The API's own messages are good and specific, so they are shown as written.
 * These add the part the message cannot know: what the operator should do.
 */
function say(message: string, advice: string): string {
  // The API's messages do not all end in a full stop, and two sentences run
  // together read as one broken one.
  const stop = /[.!?]$/.test(message.trim()) ? "" : ".";
  return `${message.trim()}${stop} ${advice}`;
}

function explain(error: unknown): string {
  if (error instanceof CatalogueError) {
    if (error.code === "INSUFFICIENT_SCOPE") {
      return say(
        error.message,
        "This key cannot do it. Publishing needs an operator key, not the one Genome Watch uses.",
      );
    }
    if (error.code === "ATTRIBUTION_INCOMPLETE") {
      return say(
        error.message,
        "Fix the authors on the record first, then move it again.",
      );
    }
    if (error.status === 401 || error.status === 403) {
      return say(error.message, "Check the key, or unlock again.");
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function ReviewClient() {
  const queryClient = useQueryClient();

  const [key, setKey] = useState("");
  const [typed, setTyped] = useState("");
  const [ready, setReady] = useState(false);

  // The record whose panel is open, the reason being typed into it, and the
  // move waiting for a second press.
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<CatalogueStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // sessionStorage is not available while rendering on the server, so the key
  // is read after mount. `ready` keeps the unlock form from flashing up in
  // front of someone who is already unlocked.
  useEffect(() => {
    setKey(readStoredKey());
    setReady(true);
  }, []);

  // The key is deliberately not part of the query key: a cache key is a place
  // a secret can be read back out of, and there is no need for it there.
  // Forgetting the key drops the cached queue, so a second key never reads a
  // first key's results.
  const queue = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => fetchQueue(key),
    enabled: Boolean(key),
    retry: false,
  });

  function unlock(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = typed.trim();
    if (!trimmed) return;
    storeKey(trimmed);
    setKey(trimmed);
    setTyped("");
  }

  function forget() {
    storeKey("");
    setKey("");
    setOpenId(null);
    setPending(null);
    setDone(null);
    setProblem(null);
    queryClient.removeQueries({ queryKey: ["review-queue"] });
  }

  function openRecord(id: string) {
    setOpenId((current) => (current === id ? null : id));
    setReason("");
    setPending(null);
    setProblem(null);
    setDone(null);
  }

  async function move(item: CatalogueListItem, status: CatalogueStatus) {
    // A move that cannot be undone, or that changes what the public sees, asks
    // twice. The first press arms it; the second does it.
    if (CONFIRM_STATUSES.has(status) && pending !== status) {
      setPending(status);
      setProblem(null);
      return;
    }
    setBusy(true);
    setProblem(null);
    setDone(null);
    try {
      const updated = await changeStatus(key, item.registry_id, status, reason);
      setDone(
        `${item.registry_id} is now ${STATUS_LABELS[updated.status] ?? updated.status}.`,
      );
      setPending(null);
      setReason("");
      setOpenId(null);
      await queue.refetch();
    } catch (error) {
      setProblem(explain(error));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="wrap page">
        <p className="muted small" role="status">
          One moment.
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Locked
  // -------------------------------------------------------------------------

  if (!key) {
    return (
      <div className="wrap-narrow page">
        <p className="kicker">Editorial</p>
        <h1 className="h1">Review and publish</h1>
        <p className="lede">
          Genome Watch files records as drafts and cannot publish them. This is
          where a person does that.
        </p>

        <form onSubmit={unlock} className="card" style={{ marginTop: 32 }}>
          <label className="label" htmlFor="operator-key">
            Operator key
          </label>
          <input
            id="operator-key"
            className="input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="The key with catalogue:publish"
          />
          <p className="xsmall muted" style={{ margin: "10px 0 16px" }}>
            Held in this tab only, for as long as it is open. Closing the tab
            forgets it. It is sent to the archive on each request and nowhere
            else.
          </p>
          <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>
            Unlock
          </button>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Unlocked
  // -------------------------------------------------------------------------

  const items = queue.data?.items ?? [];
  const total = queue.data?.count ?? 0;
  const byStatus = (status: string) => items.filter((i) => i.status === status);
  const publishedCount = byStatus("published").length;
  const withdrawnCount = byStatus("withdrawn").length;
  const waiting = WAITING.reduce((n, s) => n + byStatus(s).length, 0);
  // Counts taken from one page are only true when that page is everything.
  const complete = items.length >= total;

  return (
    <div className="wrap page">
      <p className="kicker">Editorial</p>
      <h1 className="h1">Review and publish</h1>

      {queue.isLoading ? (
        <p className="muted small" role="status">
          Reading the catalogue.
        </p>
      ) : null}

      {queue.isError ? (
        <div className="notice notice-danger" role="alert">
          <p>{explain(queue.error)}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={forget}>
            Use a different key
          </button>
        </div>
      ) : null}

      {queue.data ? (
        <>
          <p className="lede">
            {waiting === 0
              ? "Nothing is waiting. Every record is published, restricted or withdrawn."
              : waiting === 1
                ? "One record is waiting on you."
                : `${waiting} records are waiting on you.`}
          </p>
          <p className="small muted">
            {complete ? (
              <>
                {publishedCount} published
                {withdrawnCount > 0 ? `, ${withdrawnCount} withdrawn` : null}.
              </>
            ) : (
              `Showing the first ${items.length} records of ${total}, so anything below is a partial view.`
            )}
          </p>
        </>
      ) : null}

      {done ? (
        <div className="notice notice-accent" role="status">
          <p>{done}</p>
        </div>
      ) : null}

      {QUEUES.map((status) => {
        const rows = byStatus(status);
        if (rows.length === 0) return null;
        return (
          <section key={status} className="section">
            <h2 className="h2">
              {STATUS_LABELS[status]}{" "}
              <span className="muted" style={{ fontWeight: 400 }}>
                ({rows.length})
              </span>
            </h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              {STATUS_MEANINGS[status]}
            </p>

            <ul className="record-list" style={{ marginTop: 18 }}>
              {rows.map((item) => {
                const isOpen = openId === item.registry_id;
                const forward = FORWARD_STATUS[item.status];
                const others = (NEXT_STATUSES[item.status] ?? []).filter(
                  (s) => s !== forward,
                );
                return (
                  <li key={item.registry_id} className="record-row">
                    <div className="record-head">
                      <Accession id={item.registry_id} kind={item.record_kind} />
                      {item.hosting_decision === "withheld" ? (
                        <span className="badge badge-warn">Sequence withheld</span>
                      ) : null}
                      {item.biosafety_class && item.biosafety_class !== "none" ? (
                        <span className="badge">{item.biosafety_class}</span>
                      ) : null}
                    </div>
                    <p className="record-title">{item.title}</p>
                    {item.subtitle ? (
                      <p className="record-subtitle">{item.subtitle}</p>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                        marginTop: 12,
                      }}
                    >
                      <Link
                        className="link small"
                        href={`/sequences/${item.registry_id}`}
                      >
                        Read the record
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openRecord(item.registry_id)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Close" : "Move it"}
                      </button>
                    </div>

                    {isOpen ? (
                      <div className="card" style={{ marginTop: 14 }}>
                        <label className="label" htmlFor={`why-${item.registry_id}`}>
                          Why, in a line (optional)
                        </label>
                        <input
                          id={`why-${item.registry_id}`}
                          className="input"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Kept with the record, beside who moved it"
                        />

                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            marginTop: 16,
                          }}
                        >
                          {forward ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy}
                              onClick={() => move(item, forward)}
                            >
                              {pending === forward
                                ? `Yes, ${STATUS_VERBS[forward].toLowerCase()}`
                                : STATUS_VERBS[forward]}
                            </button>
                          ) : null}
                          {others.map((status) => (
                            <button
                              key={status}
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => move(item, status)}
                            >
                              {pending === status
                                ? `Yes, ${STATUS_VERBS[status].toLowerCase()}`
                                : STATUS_VERBS[status]}
                            </button>
                          ))}
                        </div>

                        {pending ? (
                          <p
                            className="xsmall"
                            role="status"
                            style={{ marginTop: 12 }}
                          >
                            {pending === "published"
                              ? "This puts the record on the public site. Press again to do it."
                              : pending === "withdrawn"
                                ? "Nothing comes back out of withdrawn. Press again to do it."
                                : "This pulls the sequence data and keeps the citation. Press again to do it."}
                          </p>
                        ) : null}

                        {problem ? (
                          <div
                            className="notice notice-danger"
                            role="alert"
                            style={{ marginTop: 14 }}
                          >
                            <p>{problem}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {queue.isError ? null : (
        <>
          <div className="rule" style={{ marginTop: 48 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={forget}>
            Forget the key
          </button>
        </>
      )}
    </div>
  );
}
