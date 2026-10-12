"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { usePermission } from "@/hooks";
import type { ReportResponse, ReportStateName } from "@saas/shared-types";

/** Report types and the duration a poll keeps watching after requesting one. */
const REPORT_TYPES = [
    { value: "usage", label: "Usage" },
    { value: "members", label: "Members" },
    { value: "billing", label: "Billing" },
] as const;

const FORMATS = [
    { value: "csv", label: "CSV" },
    { value: "pdf", label: "PDF" },
] as const;

/**
 * Async report generation panel.
 *
 * Generation happens in the worker, so the list is polled while anything is
 * still pending/processing; polling stops on its own once nothing is running
 * (React Query's `refetchInterval` returning false), which keeps an idle
 * dashboard quiet.
 */
export function ReportsPanel() {
    const queryClient = useQueryClient();
    const { can } = usePermission();

    const [type, setType] = useState<(typeof REPORT_TYPES)[number]["value"]>("usage");
    const [format, setFormat] = useState<(typeof FORMATS)[number]["value"]>("csv");
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const canManage = can("billing.manage");

    const reports = useQuery({
        queryKey: ["reports"],
        queryFn: () => apiClient.listReports(),
        enabled: canManage,
        // Poll only while something is in flight.
        refetchInterval: (query) => {
            const data = query.state.data as ReportResponse[] | undefined;
            const active = (data ?? []).some(
                (report) =>
                    report.status === "pending" || report.status === "processing",
            );
            return active ? 2000 : false;
        },
    });

    const createReport = useMutation({
        mutationFn: () => apiClient.createReport({ type, format }),
        onSuccess: (report) => {
            if (report.status === "failed") {
                toast.error(report.error ?? "Could not queue the report");
            } else {
                toast.success(`${type} report queued`);
            }
            queryClient.invalidateQueries({ queryKey: ["reports"] });
        },
        onError: (error: Error) => {
            // A 409 means an identical report is already running - the message
            // from the API explains that, so surface it verbatim.
            toast.error(error.message || "Could not request the report");
        },
    });

    const handleDownload = async (report: ReportResponse) => {
        setDownloadingId(report.id);
        try {
            const { blob, fileName } = await apiClient.downloadReport(report.id);
            triggerDownload(blob, fileName);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Download failed",
            );
        } finally {
            setDownloadingId(null);
        }
    };

    if (!canManage) {
        return null;
    }

    const items = reports.data ?? [];

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Reports</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Export data</CardTitle>
                    <CardDescription>
                        Reports are generated in the background. You can leave
                        this page; the list updates automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium" htmlFor="report-type">
                                Type
                            </label>
                            <select
                                id="report-type"
                                value={type}
                                onChange={(event) =>
                                    setType(
                                        event.target
                                            .value as (typeof REPORT_TYPES)[number]["value"],
                                    )
                                }
                                className="flex h-9 w-[160px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {REPORT_TYPES.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium" htmlFor="report-format">
                                Format
                            </label>
                            <select
                                id="report-format"
                                value={format}
                                onChange={(event) =>
                                    setFormat(
                                        event.target
                                            .value as (typeof FORMATS)[number]["value"],
                                    )
                                }
                                className="flex h-9 w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {FORMATS.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Button
                            onClick={() => createReport.mutate()}
                            disabled={createReport.isPending}
                        >
                            {createReport.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Generate report
                        </Button>
                    </div>

                    {reports.isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading reports...
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No reports yet. Generate one above.
                        </p>
                    ) : (
                        <ul className="divide-y rounded-lg border">
                            {items.map((report) => (
                                <ReportRow
                                    key={report.id}
                                    report={report}
                                    downloading={downloadingId === report.id}
                                    onDownload={() => handleDownload(report)}
                                />
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ReportRow({
    report,
    downloading,
    onDownload,
}: {
    report: ReportResponse;
    downloading: boolean;
    onDownload: () => void;
}) {
    return (
        <li className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-3">
                {report.format === "csv" ? (
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                    <p className="text-sm font-medium capitalize">
                        {report.type} report
                        <span className="ml-2 text-xs uppercase text-muted-foreground">
                            {report.format}
                        </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {new Date(report.createdAt).toLocaleString()}
                        {report.status === "completed" && report.rowCount !== null
                            ? ` — ${report.rowCount} row(s)`
                            : ""}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <StatusBadge status={report.status} />

                {report.status === "completed" && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onDownload}
                        disabled={downloading}
                    >
                        {downloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        <span className="ml-2">Download</span>
                    </Button>
                )}
            </div>

            {report.status === "failed" && report.error && (
                <p className="w-full text-xs text-destructive">{report.error}</p>
            )}
        </li>
    );
}

function StatusBadge({ status }: { status: ReportStateName }) {
    switch (status) {
        case "completed":
            return (
                <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                </Badge>
            );
        case "failed":
            return (
                <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Failed
                </Badge>
            );
        case "processing":
            return (
                <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing
                </Badge>
            );
        default:
            return (
                <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Pending
                </Badge>
            );
    }
}

/** Hand a fetched blob to the browser as a download. */
function triggerDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Release the object URL once the download has started.
    URL.revokeObjectURL(url);
}
