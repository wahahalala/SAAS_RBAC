import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

/**
 * Report request body.
 *
 * Values are validated against fixed sets rather than passed through: they select
 * both the query the worker runs and the writer it uses, so an unexpected value
 * must never reach the job payload.
 */
export class CreateReportDto {
    @ApiProperty({ enum: ["usage", "members", "billing"], example: "usage" })
    @IsString()
    @IsNotEmpty()
    @IsIn(["usage", "members", "billing"])
    type!: "usage" | "members" | "billing";

    @ApiProperty({ enum: ["csv", "pdf"], example: "csv" })
    @IsString()
    @IsNotEmpty()
    @IsIn(["csv", "pdf"])
    format!: "csv" | "pdf";
}
