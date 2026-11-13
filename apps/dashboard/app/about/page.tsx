import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "What ArtGene Archive catalogues, how a record gets in, what biosafety screening does and does not guarantee, and how to ask for a correction.",
};

const CONTACT = "b@genethropic.com";

export default function AboutPage() {
  return (
    <div className="wrap-narrow page prose">
      <h1 className="h1" style={{ fontSize: "clamp(28px, 5vw, 44px)" }}>
        About the archive
      </h1>

      <p className="lede">
        ArtGene Archive is a public catalogue of biological sequences designed
        with AI models and made in the laboratory. It covers work published in
        papers and preprints, and work its authors deposit here directly.
      </p>

      <section className="section">
        <h2 className="h2">Why it exists</h2>
        <p>
          Generative models now design proteins, genes and regulatory elements
          faster than the literature can keep track of them. A sequence may
          appear in a figure, a supplementary table or a repository with no
          record of which model made it, whether anyone tested it, or under what
          terms it can be reused. There is no single place to look.
        </p>
        <p>
          This archive is that place. It records where each sequence came from,
          which model designed it, what was measured, and what the archive is
          able to hold. It credits the people who did the work, and it links back
          to the publication wherever there is one.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">How it works</h2>
        <p>A record reaches the catalogue in four steps.</p>
        <ol>
          <li>
            <strong>Found or submitted.</strong> The archive reads papers and
            preprints for AI-designed sequences that were built and tested.
            Authors can also{" "}
            <Link href="/submit">submit a sequence directly</Link>, published or
            not.
          </li>
          <li>
            <strong>Screened.</strong> Every sequence is screened for biosafety
            before anything is stored or published.
          </li>
          <li>
            <strong>Licence checked.</strong> What the archive may hold depends on
            the licence the sequence carries.
          </li>
          <li>
            <strong>Reviewed, then listed.</strong> A person reviews the record
            before it is published. Nothing is public until then.
          </li>
        </ol>
      </section>

      <section className="section" id="biosafety">
        <h2 className="h2">Biosafety policy</h2>
        <p>
          <strong>What screening does.</strong> Every sequence that enters the
          archive is screened before anything is stored or published, whether it
          was catalogued from a paper or submitted by its authors. A sequence
          that does not pass is not stored. Its length and a checksum are kept,
          so the record stays identifiable and a resubmission is recognised.
        </p>
        <p>
          <strong>What screening does not guarantee.</strong> Screening is a
          filter, not an assurance of safety. It can miss things, and a record
          appearing here is not an endorsement of the work, a safety
          certification, or permission to make anything. Anyone working with a
          sequence remains responsible for their own review and for the rules
          that apply where they work.
        </p>
        <p>
          <strong>Why withheld records are still listed.</strong> When screening
          withholds a sequence, the record is still listed, without the sequence
          data. An archive that quietly dropped the results most relevant to
          biosecurity would make absent coverage look like absent risk. A listing
          says that screening withheld a sequence. It does not say why: the
          archive does not publish the detail of a screening decision, because
          that detail would help someone design around the checks. Parts of such
          a record, including what the sequence was designed to do, are left out
          for the same reason.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">Two kinds of record</h2>
        <p>
          The accession prefix tells you which kind of record you are reading,
          and it matters when you cite one.
        </p>
        <ul>
          <li>
            <strong className="mono">AGC-</strong> cites work published
            elsewhere. The paper or preprint is the primary record, and the
            archive entry describes what it read there and links to it. Cite the
            publication.
          </li>
          <li>
            <strong className="mono">AG-</strong> is a sequence deposited
            directly with the archive by its authors. The archive holds the
            primary copy, and the record here is the one to cite.
          </li>
        </ul>
      </section>

      <section className="section">
        <h2 className="h2">Licences</h2>
        <p>
          The archive makes no blanket licence claim over what it catalogues.
          Each record carries the licence its sequence came under, and that
          licence decides what the archive can hold.
        </p>
        <ul>
          <li>
            Under CC0, a public domain dedication, CC BY, CC BY-SA, MIT or Apache
            2.0, the archive can hold the sequence itself.
          </li>
          <li>
            Under CC BY-NC, CC BY-ND, CC BY-NC-ND, a proprietary licence, or no
            stated licence at all, the archive keeps the citation, the length and
            a checksum, and does not store the sequence. An unstated licence is
            not a permissive one.
          </li>
        </ul>
        <p>
          Where no licence is stated, the archive drafts a letter to the authors
          asking what the terms are. Those letters are queued for a person to
          read and send. The archive has no way to send anything by itself.
        </p>
      </section>

      <section className="section" id="corrections">
        <h2 className="h2">Corrections and removal</h2>
        <p>
          If a record about your work is wrong, write and it will be corrected.
          If you would rather your sequence were not in the archive, say so and
          it will be taken out, or reduced to a citation if the work is published
          elsewhere. Every record page carries a link for this, and the address
          is below.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">Governance</h2>
        <p>
          The archive is run by its founder. A governing consortium is planned,
          and none exists yet: no organisation has joined, and the archive names
          no partners or funders until one has. The code is public, so what the
          archive does to a record can be read rather than taken on trust.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">Contact</h2>
        <p>
          Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> about a record, a
          correction, a submission, or anything else. Problems with the software
          can go to{" "}
          <a
            href="https://github.com/babisingh/artgene-archive/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            the issue tracker
          </a>
          .
        </p>
      </section>
    </div>
  );
}
