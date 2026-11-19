import type { Metadata } from "next";

import { ReviewClient } from "../../components/review/ReviewClient";

/**
 * The editorial desk. Not in the nav, and not in anyone's index.
 *
 * There is no server-side gate here, because there is nothing behind the page
 * to gate: it renders a key form and some buttons. Every read and every move
 * it makes carries the operator's own key, and the archive checks the scope on
 * each one. Hiding the page would protect nothing; the permission does the
 * work. noindex keeps it out of search results all the same, because an
 * editorial page in a search result invites people to try the door.
 */
export const metadata: Metadata = {
  title: "Review and publish",
  description: "Move a catalogue record from draft to published.",
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return <ReviewClient />;
}
