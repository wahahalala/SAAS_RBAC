import PDFDocument from "pdfkit";
import type { ReportTable } from "./report-data.service";

/**
 * Render a report table to PDF with pdfkit.
 *
 * Layout is hand-rolled because pdfkit has no table primitive: columns are
 * sized proportionally to the page, text is clipped to its cell, and rows are
 * paginated when the next row would cross the bottom margin (the header is
 * repeated on each new page so a printed page stays readable).
 */

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 24;
const FONT_SIZE = 9;

export async function toPdf(
    table: ReportTable,
    meta: { tenantName: string; generatedAt: Date },
): Promise<Buffer> {
    const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        // Collect the whole document in memory; the worker writes it to disk.
        bufferPages: true,
    });

    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });

    const left = PAGE_MARGIN;
    const usableWidth = doc.page.width - PAGE_MARGIN * 2;
    const columnWidth = usableWidth / Math.max(table.columns.length, 1);
    const bottomLimit = doc.page.height - PAGE_MARGIN;

    doc.fontSize(16).text(table.title, left, PAGE_MARGIN);
    doc.fontSize(9)
        .fillColor("#555555")
        .text(
            `${meta.tenantName} — generated ${meta.generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC`,
            left,
            PAGE_MARGIN + 22,
        )
        .fillColor("black");

    let y = PAGE_MARGIN + 48;

    const drawHeader = () => {
        doc.fontSize(FONT_SIZE).fillColor("#000000");
        table.columns.forEach((column, index) => {
            const x = left + index * columnWidth;
            doc.rect(x, y, columnWidth, HEADER_HEIGHT).fill("#f0f0f0");
            doc.fillColor("#000000").text(column, x + 4, y + 7, {
                width: columnWidth - 8,
                height: HEADER_HEIGHT - 8,
                ellipsis: true,
            });
        });
        y += HEADER_HEIGHT;
    };

    drawHeader();

    if (table.rows.length === 0) {
        doc.fontSize(FONT_SIZE).text("No data for this period.", left + 4, y + 6);
    }

    table.rows.forEach((row) => {
        if (y + ROW_HEIGHT > bottomLimit) {
            doc.addPage();
            y = PAGE_MARGIN;
            drawHeader();
        }

        row.forEach((cell, index) => {
            const x = left + index * columnWidth;
            doc.fontSize(FONT_SIZE)
                .fillColor("#000000")
                .text(cell === null || cell === undefined ? "" : String(cell), x + 4, y + 6, {
                    width: columnWidth - 8,
                    height: ROW_HEIGHT - 6,
                    ellipsis: true,
                });
            // Cell separator keeps columns readable without a full grid.
            doc.moveTo(x, y).lineTo(x, y + ROW_HEIGHT).strokeColor("#dddddd").stroke();
        });

        doc.moveTo(left, y + ROW_HEIGHT)
            .lineTo(left + usableWidth, y + ROW_HEIGHT)
            .strokeColor("#eeeeee")
            .stroke();
        y += ROW_HEIGHT;
    });

    doc.fontSize(8)
        .fillColor("#777777")
        .text(`${table.rows.length} row(s)`, left, y + 10);

    doc.end();
    return done;
}
