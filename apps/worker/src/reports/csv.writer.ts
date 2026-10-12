import type { ReportTable } from "./report-data.service";

/**
 * RFC 4180 CSV serialisation.
 *
 * A field is quoted when it contains a delimiter, a quote or a newline; inner
 * quotes are doubled. Without this, a member named `Doe, Jane` or a metric with
 * a newline would silently shift every following column.
 */
export function toCsv(table: ReportTable): string {
    const lines = [
        table.columns.map(escapeField).join(","),
        ...table.rows.map((row) => row.map(escapeField).join(",")),
    ];

    // Trailing newline: many CSV consumers treat a missing final newline as a
    // truncated file.
    return `${lines.join("\r\n")}\r\n`;
}

function escapeField(value: string | number | null): string {
    const text = value === null || value === undefined ? "" : String(value);

    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}
