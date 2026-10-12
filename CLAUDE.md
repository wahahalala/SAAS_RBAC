项目开发规则：

1. 本项目基于 navjotdhanawat/saas-template 二次开发。

2. 数据库：
PostgreSQL 16

运行方式：
Docker Compose


3. Redis：
Redis 7

运行方式：
Docker Compose


4. 禁止引入：
- Supabase
- Firebase
- MongoDB
- Upstash


5. ORM:
只能使用 Prisma。


6. Backend:
必须使用 NestJS Module 架构。


7. Frontend:
必须使用 Next.js App Router。


8. 数据安全：
所有 SaaS 数据必须 tenantId 隔离。


9. Redis 用于：
- Cache
- BullMQ Queue
- Rate Limit


10. 所有重大功能必须：
- 添加测试
- 更新 README
- Git Commit