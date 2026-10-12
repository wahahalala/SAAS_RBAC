import { describe, it, expect } from "vitest";
import { toCsv } from "@/reports/csv.writer";
import { toPdf } from "@/reports/pdf.writer";
import type { ReportTable } from "@/reports/report-data.service";

/**
 * The report writers are the part that turns business rows into a file the user
 * downloads, so they are tested directly (no queue, no database).
 */

const table: ReportTable = {
    title: "Members Report",
    columns: ["Name", "Email", "Role"],
    rows: [
        ["Alice", "alice@example.com", "admin"],
        ["Bob, Jr.", 'bob"quoted"@example.com', "member"],
        ["Line\nBreak", "eve@example.com", "member"],
        [null, "", "member"],
    ],
};

describe("CSV writer", () => {
    it("writes a header row followed by the data rows", () => {
        const lines = toCsv({
            title: "T",
            columns: ["A", "B"],
            rows: [["1", "2"], ["3", "4"]],
        }).split("\r\n");

        expect(lines[0]).toBe("A,B");
        expect(lines[1]).toBe("1,2");
        expect(lines[2]).toBe("3,4");
    });

    it("ends with a trailing newline", () => {
        expect(toCsv({ title: "T", columns: ["A"], rows: [["1"]] }).endsWith("\r\n")).toBe(true);
    });

    it("quotes fields containing a comma, quote or newline (RFC 4180)", () => {
        const csv = toCsv(table);

        expect(csv).toContain('"Bob, Jr."');
        // Inner quotes are doubled, not escaped with a backslash.
        expect(csv).toContain('"bob""quoted""@example.com"');
        expect(csv).toContain('"Line\nBreak"');
    });

    it("would corrupt the row if quoting were skipped", () => {
        const csv = toCsv(table);
        const bob = csv.split("\r\n").find((line) => line.startsWith('"Bob, Jr."'));

        // The comma inside the name must not become a column separator.
        const fields = splitCsvLine(bob!);
        expect(fields).toHaveLength(3);
        expect(fields[0]).toBe("Bob, Jr.");
        expect(fields[1]).toBe('bob"quoted"@example.com');
    });

    it("renders null as an empty field", () => {
        const csv = toCsv({ title: "T", columns: ["A", "B"], rows: [[null, "x"]] });
        expect(csv.split("\r\n")[1]).toBe(",x");
    });

    it("produces only a header when there are no rows", () => {
        const csv = toCsv({ title: "T", columns: ["A", "B"], rows: [] });
        expect(csv).toBe("A,B\r\n");
    });
});

describe("PDF writer", () => {
    it("produces a real PDF document", async () => {
        const pdf = await toPdf(table, {
            tenantName: "Acme Inc",
            generatedAt: new Date("2026-01-02T03:04:05Z"),
        });

        expect(pdf.byteLength).toBeGreaterThan(500);
        // %PDF- magic number.
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
        // %%EOF trailer, so the file is not truncated.
        expect(pdf.subarray(-8).toString()).toContain("%%EOF");
    });

    it("handles an empty table without throwing", async () => {
        const pdf = await toPdf(
            { title: "Usage Report", columns: ["Metric"], rows: [] },
            { tenantName: "Acme", generatedAt: new Date() },
        );

        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("paginates a long report and still emits a valid document", async () => {
        const rows = Array.from({ length: 200 }, (_, index) => [
            `member-${index}`,
            `member-${index}@example.com`,
            "member",
        ]);

        const pdf = await toPdf(
            { title: "Members Report", columns: ["Name", "Email", "Role"], rows },
            { tenantName: "Acme", generatedAt: new Date() },
        );

        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
        expect(pdf.subarray(-8).toString()).toContain("%%EOF");
        // A 200-row A4 table cannot fit on one page.
        expect(pdf.byteLength).toBeGreaterThan(2000);
    });
});

/** Minimal RFC 4180 line splitter used to assert the CSV is parseable. */
function splitCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (inQuotes) {
            if (char === '"' && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ",") {
            fields.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    fields.push(current);
    return fields;
}
