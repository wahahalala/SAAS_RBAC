/**
 * Audit action vocabulary.
 *
 * These are the recorded action names in `AuditLog.action`. They are shared
 * constants (not per-call-site string literals) because:
 *
 *  - the audit query API filters BY action, so a typo in a writer silently
 *    creates an action no filter can find;
 *  - an operator investigating an incident needs a closed set to enumerate,
 *    rather than discovering a new variant per release.
 *
 * Naming: SCREAMING_SNAKE, describing the business action performed. The values
 * are the strings stored in the database, so renaming one is a data migration.
 */

export const AUDIT_ACTIONS = {
    /** An account was created. */
    CREATE_USER: "CREATE_USER",
    /** An account was deleted. */
    DELETE_USER: "DELETE_USER",
    /** A member's role inside a tenant changed. */
    CHANGE_ROLE: "CHANGE_ROLE",
    /** A session was established. */
    LOGIN: "LOGIN",
    /** A session was ended (this device or all devices). */
    LOGOUT: "LOGOUT",
    /** A report artifact was downloaded (data left the system). */
    EXPORT_DATA: "EXPORT_DATA",
    /**
     * A tenant was provisioned.
     *
     * Not in the original six, but the fact is already emitted and dropping the
     * audit trail for tenant creation would be a regression.
     */
    CREATE_TENANT: "CREATE_TENANT",
    /**
     * A report finished generating.
     *
     * Kept because "who exported what" is incomplete without knowing which
     * exports were produced at all.
     */
    REPORT_COMPLETED: "REPORT_COMPLETED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Every action, for validation and for the query API's filter enum. */
export const AUDIT_ACTION_VALUES: AuditAction[] = Object.values(AUDIT_ACTIONS);

export function isAuditAction(value: string): value is AuditAction {
    return (AUDIT_ACTION_VALUES as string[]).includes(value);
}
