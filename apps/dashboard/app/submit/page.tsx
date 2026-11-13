import type { Metadata } from "next";
import { SubmitForm } from "../../components/submit/SubmitForm";

export const metadata: Metadata = {
  title: "Submit a sequence",
  description:
    "Deposit an AI-designed sequence with the archive. Every sequence is screened for biosafety before anything is stored or published.",
};

export default function SubmitPage() {
  return <SubmitForm />;
}
