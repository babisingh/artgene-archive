"use client";

import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { Fragment, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApiKey } from "../../lib/providers";
import type { CertificateSummary } from "../../lib/api";
import { StatusBadge, TierBadge } from "../../components/CertBadges";

// ---------------------------------------------------------------------------
// Register form schema
// ---------------------------------------------------------------------------

const RegisterSchema = z.object({
  fasta: z.string().min(10, "Paste a valid FASTA sequence (≥ 10 chars)"),
  owner_id: z.string().min(1, "Owner ID is required"),
  // org_id removed — server derives it from the authenticated API key.
  ethics_code: z.string().min(1, "Ethics code is required"),
  host_organism: z.enum(["ECOLI", "YEAST", "CHO", "INSECT", "PLANT", "HUMAN"]),
});

type RegisterForm = z.infer<typeof RegisterSchema>;

// ---------------------------------------------------------------------------
// Register modal
// ---------------------------------------------------------------------------

function RegisterModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { client } = useApiKey();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      host_organism: "ECOLI",
      owner_id: "researcher@example.com",
      ethics_code: "ETHICS-001",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: RegisterForm) =>
      client.register({
        fasta: data.fasta,
        owner_id: data.owner_id,
        ethics_code: data.ethics_code,
        host_organism: data.host_organism,
        // org_id omitted — server derives from API key.
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      reset();
      onClose();
    },
  });

  function onSubmit(data: RegisterForm) {
    mutation.mutate(data);
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="card w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
              <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Register New Sequence
              </DialogTitle>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* FASTA */}
                <div>
                  <label className="label">FASTA Sequence</label>
                  <textarea
                    {...register("fasta")}
                    rows={5}
                    className="input font-mono text-xs"
                    placeholder={">NB-GLP1-047\nMATHKFLRVHNGLELAKRQPKDQVFQFLRCQ"}
                  />
                  {errors.fasta && (
                    <p className="mt-1 text-xs text-red-500">{errors.fasta.message}</p>
                  )}
                </div>

                {/* Owner ID */}
                <div>
                  <label className="label">Owner ID</label>
                  <input {...register("owner_id")} className="input" />
                  {errors.owner_id && (
                    <p className="mt-1 text-xs text-red-500">{errors.owner_id.message}</p>
                  )}
                </div>

                {/* Org — derived from API key */}
                <div className="flex flex-col justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-3 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  <div className="font-semibold mb-0.5">Organisation</div>
                  Derived automatically from your API key.
                </div>

                {/* Ethics code */}
                <div>
                  <label className="label">Ethics Code</label>
                  <input {...register("ethics_code")} className="input" />
                  {errors.ethics_code && (
                    <p className="mt-1 text-xs text-red-500">{errors.ethics_code.message}</p>
                  )}
                </div>

                {/* Host organism */}
                <div>
                  <label className="label">Host Organism</label>
                  <select {...register("host_organism")} className="input">
                    <option value="ECOLI">E. coli</option>
                    <option value="YEAST">Yeast (S. cerevisiae)</option>
                    <option value="CHO">CHO / Mammalian</option>
                    <option value="INSECT">Insect (Sf9)</option>
                    <option value="PLANT">Plant</option>
                    <option value="HUMAN">Human</option>
                  </select>
                </div>

                {/* Mutation error */}
                {mutation.isError && (
                  <p className="text-sm text-red-500">
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : "Registration failed"}
                  </p>
                )}

                {/* Result preview */}
                {mutation.isSuccess && mutation.data.status === "FAILED" && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Gates failed: {mutation.data.message}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={onClose} className="btn-secondary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="btn-primary"
                  >
                    {mutation.isPending ? "Registering…" : "Register"}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

// ---------------------------------------------------------------------------
// Column helper
// ---------------------------------------------------------------------------

const colHelper = createColumnHelper<CertificateSummary>();

const columns = [
  colHelper.accessor("registry_id", {
    header: "Registry ID",
    cell: (info) => (
      <Link
        href={`/sequences/${info.getValue()}`}
        className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  colHelper.accessor("status", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  colHelper.accessor("tier", {
    header: "Tier",
    cell: (info) => <TierBadge tier={info.getValue()} />,
  }),
  colHelper.accessor("owner_id", {
    header: "Owner",
    cell: (info) => (
      <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[12rem] block">
        {info.getValue()}
      </span>
    ),
  }),
  colHelper.accessor("host_organism", {
    header: "Host",
    cell: (info) => (
      <span className="text-sm capitalize">{info.getValue()}</span>
    ),
  }),
  colHelper.accessor("timestamp", {
    header: "Registered",
    cell: (info) => (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {new Date(info.getValue()).toLocaleDateString()}
      </span>
    ),
  }),
  colHelper.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <Link
        href={`/sequences/${info.row.original.registry_id}`}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        View →
      </Link>
    ),
  }),
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SequencesPage() {
  const { client, apiKey } = useApiKey();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showRegister, setShowRegister] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => client.listCertificates(100, 0),
    enabled: Boolean(apiKey),
  });

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="route wrap sequences-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Sequence Registry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Certified gene sequences
          </p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          className="btn-primary"
          data-testid="register-btn"
        >
          + Register Sequence
        </button>
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">
        {isLoading && (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Loading certificates…
          </div>
        )}

        {!apiKey && (
          <div className="p-8 text-center space-y-2">
            <div className="text-2xl">🔑</div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              No API key set
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Click <strong>Set API Key</strong> in the navigation bar and enter your
              organisation key to view the registry.
            </p>
          </div>
        )}

        {isError && (
          <div className="p-8 text-center space-y-3">
            <div className="text-2xl">⚠️</div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              Could not load the registry
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              If your key looks correct, check that the API server is running at{" "}
              <code className="font-mono">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}</code>.
            </p>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr
                      key={hg.id}
                      className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                    >
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap ${
                            header.column.getCanSort() ? "cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" : ""
                          }`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: " ↑",
                            desc: " ↓",
                          }[header.column.getIsSorted() as string] ?? ""}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-12 text-center text-slate-400 dark:text-slate-500"
                      >
                        No certificates found. Register your first sequence above.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {data && (
              <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700">
                {data.count} certificate{data.count !== 1 ? "s" : ""}
              </div>
            )}
          </>
        )}
      </div>

      <RegisterModal open={showRegister} onClose={() => setShowRegister(false)} />
    </div>
  );
}
