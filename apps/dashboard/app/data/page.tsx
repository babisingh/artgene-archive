import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API and data",
  description:
    "Read the ArtGene Archive catalogue and submit sequences through the API: endpoints, an example request, access and rate limits.",
};

const CONTACT = "b@genethropic.com";

const SUBMIT_EXAMPLE = `curl -X POST "$ARTGENE_API/submissions" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Thermostable variant of a carbonic anhydrase",
    "summary": "A designed variant that retained activity after heating.",
    "molecule_type": "protein",
    "fasta": ">design-01\\nMKVLATGSW...",
    "host_organism": "ECOLI",
    "authors": [
      {
        "full_name": "Your Name",
        "orcid": "0000-0000-0000-0000",
        "affiliation": "Your institution",
        "is_corresponding": true
      }
    ],
    "design": {
      "generating_model": "the model you used",
      "model_version": "1.0",
      "model_availability": "open weights",
      "design_method": "how the designs were generated",
      "design_target": "what it was designed to do",
      "n_designed": 96,
      "n_tested": 12,
      "n_functional": 3,
      "assays": ["thermal shift", "activity assay"],
      "expression_host": "ECOLI",
      "wet_lab_validated": true
    },
    "accessions": [],
    "source": {
      "url": null,
      "doi": null,
      "title": null,
      "container": null,
      "published_on": null
    },
    "data_license": "CC-BY-4.0",
    "submitter": {
      "name": "Your Name",
      "email": "you@example.org",
      "affiliation": "Your institution",
      "orcid": "0000-0000-0000-0000"
    },
    "confirms_rights": true,
    "accepts_screening": true
  }'`;

const RECEIPT_EXAMPLE = `HTTP/1.1 202 Accepted

{
  "registry_id": "AG-2026-000001",
  "status": "received",
  "message": "Thank you. Your submission has been received and is awaiting review. We will write to you at the address you gave."
}`;

const LIST_EXAMPLE = `curl "$ARTGENE_API/catalogue?q=carbonic&validated=true&limit=20" \\
  -H "X-API-Key: $ARTGENE_KEY"`;

const RECORD_EXAMPLE = `curl "$ARTGENE_API/catalogue/AGC-2026-000001" \\
  -H "X-API-Key: $ARTGENE_KEY"`;

const ERROR_EXAMPLE = `{ "detail": { "code": "CONFIRMATION_REQUIRED", "message": "..." } }

{ "detail": [ { "loc": ["body", "title"], "msg": "Field required" } ] }`;

export default function DataPage() {
  return (
    <div className="wrap-narrow page prose">
      <h1 className="h1" style={{ fontSize: "clamp(28px, 5vw, 44px)" }}>
        API and data
      </h1>

      <p className="lede">
        The catalogue can be read and written through a JSON API. Reads need a
        key. Submissions do not.
      </p>

      <section className="section">
        <h2 className="h2">Reading the catalogue</h2>
        <p>
          <code>GET /catalogue</code> lists published records, newest first, and
          answers with <code>items</code>, <code>count</code>,{" "}
          <code>offset</code> and <code>limit</code>. <code>count</code> is the
          real total for the query, not the length of the page.
        </p>
        <div className="code">
          <pre>{LIST_EXAMPLE}</pre>
        </div>
        <p>These parameters narrow a list:</p>
        <ul>
          <li>
            <code>q</code> searches titles, source titles, venues and model
            names.
          </li>
          <li>
            <code>molecule_type</code> is one of <code>protein</code>,{" "}
            <code>dna</code>, <code>rna</code>, <code>genome</code>,{" "}
            <code>regulatory_element</code>, <code>grna_scaffold</code>.
          </li>
          <li>
            <code>model</code> matches part of the generating model name.
          </li>
          <li>
            <code>validated=true</code> returns only sequences their authors
            tested at the bench.
          </li>
          <li>
            <code>kind</code> is <code>catalogue</code> for records of work
            published elsewhere, or <code>submission</code> for sequences
            deposited here.
          </li>
          <li>
            <code>limit</code> up to 200, and <code>offset</code> to page
            through.
          </li>
        </ul>
        <p>
          <code>GET /catalogue/{"{accession}"}</code> returns one record in full:
          its source and authors, the design and what was measured, the
          screening lines, the licence and hosting decision, any accessions in
          other databases, and the sequence length and checksum. A record that
          is not published answers 404, whether or not it exists.
        </p>
        <div className="code">
          <pre>{RECORD_EXAMPLE}</pre>
        </div>
        <p>
          The sequence data itself is not in that response, and there is no
          download endpoint yet. To ask for a sequence the archive holds, write
          to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> quoting the accession.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">Submitting through the API</h2>
        <p>
          <code>POST /submissions</code> takes the same details as the{" "}
          <Link href="/submit">submission form</Link> and needs no key. Both
          confirmations must be true: that you may share the sequence, and that
          you accept it will be screened.
        </p>
        <div className="code">
          <pre>{SUBMIT_EXAMPLE}</pre>
        </div>
        <p>
          A successful call answers 202 with the accession. The message is the
          same for every accepted submission, whatever screening concluded, and
          the outcome reaches you in a letter a person has read and sent.
        </p>
        <div className="code">
          <pre>{RECEIPT_EXAMPLE}</pre>
        </div>
        <p>Refusals arrive in one of two shapes:</p>
        <div className="code">
          <pre>{ERROR_EXAMPLE}</pre>
        </div>
        <p>
          The first is the archive refusing the submission and saying why, with
          a stable <code>code</code>. The second is a field that is missing or
          malformed, one entry per field.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">Access</h2>
        <ul>
          <li>
            <strong>Reads need a key</strong>, sent as an{" "}
            <code>X-API-Key</code> header. Write to{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a> for a read key and for
            the API base URL. A read key sees published records and nothing
            else.
          </li>
          <li>
            <strong>Submissions need no key.</strong> Anyone may submit, through
            the form or the API.
          </li>
          <li>
            Keys are stored only as hashes, so a lost key cannot be recovered.
            Ask for a new one.
          </li>
        </ul>
      </section>

      <section className="section">
        <h2 className="h2">Rate limits</h2>
        <p>
          Submissions are limited to 20 requests per minute, and reads to 100
          per minute. The limit counts per key, or per address where a request
          carries no key. Over the limit, the API answers 429.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">Licences and reuse</h2>
        <p>
          Each record carries its own licence, which is in the record and on its
          page. The archive makes no blanket licence claim over what it
          catalogues, so check the record before reusing a sequence or its
          metadata. Where a licence does not permit redistribution, the record
          holds the citation, the length and a checksum, and the archive does
          not store the sequence.
        </p>
        <p>
          <Link href="/about#biosafety">
            What biosafety screening does and does not guarantee
          </Link>{" "}
          applies to anything you take from here.
        </p>
      </section>
    </div>
  );
}
