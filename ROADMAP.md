# SaaS Template Roadmap

This document outlines the planned features and improvements for the SaaS Template.

## Current Status: v1.0

The template includes core functionality for building a SaaS application with authentication, multi-tenancy, and a polished UI.

---

## 🎯 Version 1.1 - Core Flow Fixes

**Target: Q1 2025**

### High Priority Fixes
- [ ] **OAuth Callback Page** - Create `/auth/callback` route to handle OAuth redirects
- [ ] **Remove Member** - Connect the "Remove" button to the API endpoint
- [ ] **Change Role** - Implement role change functionality in team settings
- [ ] **Password Reset** - Add forgot password flow with email tokens

### Improvements
- [ ] Better error handling in API client
- [ ] Loading skeletons for dashboard pages
- [ ] Form validation feedback improvements

---

## 🎯 Version 1.2 - Email & Invitations

**Target: Q1 2025**

### Email Service
- [ ] Integrate `@nestjs-modules/mailer` with templates
- [ ] Configure SMTP/SendGrid/Resend provider
- [ ] Create email templates (invitation, password reset, welcome)

### Invitation Flow
- [ ] Send invitation emails when inviting members
- [ ] Create `/invitations/:token/accept` API endpoint
- [ ] Build invitation acceptance page
- [ ] Handle expired invitations gracefully

### Email Verification
- [ ] Send verification email on registration
- [ ] Create email verification endpoint
- [ ] Add "Resend verification" button
- [ ] Show verification status in UI

---

## 🎯 Version 1.3 - Notifications & Activity

**Target: Q2 2025**

### Notification System
- [ ] In-app notifications dropdown
- [ ] Real-time notifications with WebSockets
- [ ] Email notification preferences
- [ ] Notification history page

### Activity & Audit Logs
- [ ] Log important user actions
- [ ] Activity feed in dashboard
- [ ] Audit log viewer for admins
- [ ] Export audit logs

---

## 🎯 Version 2.0 - Billing & Subscriptions

**Target: Q2-Q3 2025**

### Stripe Integration
- [ ] Connect Stripe account
- [ ] Define subscription plans (Free, Pro, Enterprise)
- [ ] Implement checkout flow
- [ ] Handle Stripe webhooks

### Subscription Management
- [ ] Upgrade/downgrade plans
- [ ] Cancel subscription
- [ ] Invoice history
- [ ] Customer portal redirect

### Usage Billing (Optional)
- [ ] Track feature usage
- [ ] Usage-based pricing model
- [ ] Usage alerts and limits

---

## 🎯 Version 2.1 - API & Integrations

**Target: Q3 2025**

### API Keys
- [ ] Generate API keys per organization
- [ ] API key permissions/scopes
- [ ] Rate limiting per key
- [ ] API key rotation

### Webhooks
- [ ] Configure webhook endpoints
- [ ] Event subscriptions
- [ ] Webhook delivery logs
- [ ] Retry failed webhooks

---

## 🎯 Version 3.0 - Enterprise Features

**Target: Q4 2025**

### Advanced Security
- [ ] Two-factor authentication (2FA)
- [ ] SSO/SAML integration
- [ ] IP allowlisting
- [ ] Session management

### Compliance
- [ ] GDPR data export
- [ ] Account deletion workflow
- [ ] Data retention policies
- [ ] Terms of Service acceptance tracking

---

## Feature Requests

Have a feature request? Open an issue on GitHub!

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.
