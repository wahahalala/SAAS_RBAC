import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tenantStorage, TenantContextData } from "./tenant.context";

/**
 * Wraps the ENTIRE request handler (controller + services) inside the tenant
 * AsyncLocalStorage context. TenantGuard has already validated the tenant and
 * stored `request.tenantId`; this interceptor makes that value visible to the
 * Prisma client extension for the full duration of the request.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest();
        const tenantId = (request as { tenantId?: string }).tenantId;

        if (!tenantId) {
            // Public / tenant-provisioning routes have no tenant scope.
            return next.handle();
        }

        const data: TenantContextData = {
            tenantId,
            userId: (request as { user?: { id?: string } }).user?.id,
        };

        return new Observable((subscriber) => {
            tenantStorage.run(data, () => {
                next.handle().subscribe({
                    next: (value) => subscriber.next(value),
                    error: (err) => subscriber.error(err),
                    complete: () => subscriber.complete(),
                });
            });
        });
    }
}
