/**
 * English dictionary — the reference shape for every locale.
 *
 * Nested by surface (landing / auth / dashboard / …) rather than flat, so a
 * component reads `dict.dashboard.team.title` and it stays obvious which screen
 * a key belongs to. `zh.ts` is typed as `Dictionary`, so adding a key here
 * without translating it is a compile error.
 *
 * Values are plain strings (or arrays of strings for lists). No ICU/placeholders
 * engine: where a sentence needs a runtime value the caller composes it, which
 * keeps this file readable and the bundle free of a formatting dependency.
 */
const en = {
    common: {
        appName: "SaaS Template",
        loading: "Loading…",
        cancel: "Cancel",
        save: "Save",
        saving: "Saving…",
        create: "Create",
        creating: "Creating…",
        delete: "Delete",
        edit: "Edit",
        close: "Close",
        back: "Back",
        search: "Search…",
        language: "Language",
        active: "Active",
        notAvailableYet: "Not available yet",
        noOrganization: "No organization yet",
    },

    languageSwitcher: {
        label: "Language",
        switchTo: "Switch language",
    },

    landing: {
        nav: {
            features: "Features",
            pricing: "Pricing",
            docs: "Docs",
            signIn: "Sign In",
            getStarted: "Get Started",
        },
        hero: {
            badge: "Now available in beta",
            titleStart: "Build your SaaS",
            titleHighlight: "faster than ever",
            subtitle:
                "A production-ready SaaS template with authentication, multi-tenancy, billing, and a beautiful UI. Start building your product today, not your infrastructure.",
            ctaPrimary: "Start Building Free",
            ctaSecondary: "View Documentation",
            note: "No credit card required • Free forever plan • Setup in 5 minutes",
        },
        features: {
            heading: "Everything you need to build your SaaS",
            subtitle:
                "Skip months of development with our pre-built features and focus on what makes your product unique.",
            items: {
                security: {
                    title: "Enterprise Security",
                    description:
                        "Bank-grade encryption and SOC 2 compliant infrastructure to keep your data safe.",
                },
                fast: {
                    title: "Lightning Fast",
                    description:
                        "Optimized performance with edge computing and global CDN for instant response times.",
                },
                collaboration: {
                    title: "Team Collaboration",
                    description:
                        "Built-in tools for seamless team collaboration with role-based access control.",
                },
                analytics: {
                    title: "Advanced Analytics",
                    description:
                        "Real-time insights and comprehensive dashboards to track your success.",
                },
                sso: {
                    title: "SSO & OAuth",
                    description:
                        "Support for Google, GitHub, and enterprise SSO providers out of the box.",
                },
                multiTenancy: {
                    title: "Multi-Tenancy",
                    description:
                        "Complete organization management with membership and billing per workspace.",
                },
            },
        },
        pricing: {
            heading: "Simple, transparent pricing",
            subtitle:
                "Choose the perfect plan for your needs. Upgrade or downgrade at any time.",
            popular: "Most Popular",
            perMonth: "/month",
            cta: "Get Started",
            plans: {
                free: {
                    name: "Free",
                    features: ["3 team members", "5 GB storage", "Basic analytics"],
                },
                pro: {
                    name: "Pro",
                    features: [
                        "Unlimited members",
                        "100 GB storage",
                        "Advanced analytics",
                        "SSO",
                    ],
                },
                enterprise: {
                    name: "Enterprise",
                    features: [
                        "Everything in Pro",
                        "Unlimited storage",
                        "Dedicated support",
                        "SLA",
                    ],
                },
            },
        },
        cta: {
            heading: "Ready to get started?",
            subtitle:
                "Join thousands of developers who are building their SaaS products faster with our template.",
            button: "Start Building Today",
        },
        footer: {
            privacy: "Privacy",
            terms: "Terms",
            docs: "Docs",
            rights: "All rights reserved.",
        },
    },

    auth: {
        login: {
            title: "Welcome back",
            description: "Enter your credentials to sign in to your account",
            orContinueWith: "Or continue with email",
            email: "Email",
            password: "Password",
            forgotPassword: "Forgot password?",
            submit: "Sign in",
            noAccount: "Don't have an account?",
            signUp: "Sign up",
        },
        register: {
            title: "Create an account",
            description: "Enter your details to get started",
            name: "Name",
            namePlaceholder: "John Doe",
            email: "Email",
            password: "Password",
            passwordHint: "Must be at least 8 characters",
            confirmPassword: "Confirm Password",
            submit: "Create account",
            haveAccount: "Already have an account?",
            signIn: "Sign in",
            termsPrefix: "By creating an account, you agree to our",
            terms: "Terms of Service",
            termsAnd: "and",
            privacy: "Privacy Policy",
        },
    },

    dashboard: {
        nav: {
            navigation: "Navigation",
            organization: "Organization",
            dashboard: "Dashboard",
            team: "Team",
            settings: "Settings",
            billing: "Billing",
            searchPlaceholder: "Search…",
        },
        overview: {
            title: "Welcome back, {name}!",
            subtitle: "Here's what's happening with your account today.",
            organizations: "Organizations",
            organizationsDescription: "Active organizations",
            teamMembers: "Team Members",
            teamMembersDescription: "Across all organizations",
            yourPlan: "Your Plan",
            yourPlanDescription: "Active organization plan",
            yourOrganizations: "Your Organizations",
            memberCount: "{count} member",
            memberCountPlural: "{count} members",
            activeTenant: "Active tenant",
            switchTo: "Switch to this organization",
            emptyTitle: "No organizations yet",
            emptyDescription:
                "Create your first organization to get started with team collaboration.",
        },
        organization: {
            title: "Organization",
            subtitle: "Manage your organization settings and details",
            emptyTitle: "No organization yet",
            emptyDescription: "Create an organization to manage its settings.",
            generalSettings: "General Settings",
            generalSettingsDescription:
                "Update your organization's profile information",
            details: "Organization Details",
            plan: "Plan",
            members: "Members",
            yourRole: "Your Role",
            quickLinks: "Quick Links",
            manageTeam: "Manage team",
            billing: "Billing",
            accountSettings: "Account settings",
        },
        team: {
            title: "Team",
            subtitle: "Manage your team members and their roles",
            inviteMember: "Invite member",
            inviteTitle: "Invite a team member",
            inviteDescription:
                "Send an invitation to join this organization. They will receive an email with a link.",
            inviteEmail: "Email",
            inviteRole: "Role",
            sendInvitation: "Send invitation",
            sending: "Sending…",
            invitationSent: "Invitation sent",
            totalMembers: "Total Members",
            admins: "Admins",
            members: "Members",
            membersTitle: "Team Members",
            membersDescription: "People with access to this organization",
            loadError: "Could not load members: {error}",
            emptyTitle: "No team members yet",
            emptyDescription: "Invite your first team member to get started",
            noOrganizationTitle: "No organization yet",
            noOrganizationDescription: "Create an organization to manage a team.",
            unnamed: "Unnamed",
            roleAdmin: "Admin",
            roleMember: "Member",
            changeRole: "Change role",
            remove: "Remove",
            removeTitle: "Remove member",
            removeConfirm: "Remove {name} from this organization?",
            memberRemoved: "Member removed",
            roleUpdated: "Role updated",
            invitationSentTo: "Invitation sent to {email}",
            inviteEmailLabel: "Email address",
            roleMemberHint: "Can view and edit",
            roleAdminHint: "Full access",
            sendEmail: "Send email",
            changeTo: "Change to {role}",
            changeToMember: "Change to member",
            changeToAdmin: "Change to admin",
            joined: "Joined",
            openMenu: "Open menu",
            removeMemberTitle: "Remove team member?",
            removeMemberWarning:
                "{name} will lose access to this organization immediately.",
            roleChangedTo: "Role changed to {role}",
        },
        member: {
            pendingInvitations: "Pending invitations",
            pendingInvitationsDescription: "Invitations that have not been accepted yet",
            revoke: "Revoke",
            noPendingInvitations: "No pending invitations",
        },
        billing: {
            title: "Billing",
            subtitle: "Manage your subscription and billing details",
            currentPlan: "Current Plan",
            nextBillingDate: "Next billing date",
            manageSubscription: "Manage Subscription",
            monthly: "Monthly",
            yearly: "Yearly",
            savePercent: "Save 20%",
            upgradeTo: "Upgrade to {plan}",
            currentPlanButton: "Current Plan",
            reports: "Reports",
            reportsDescription:
                "Reports are generated in the background. You can leave this page and come back later.",
            faqTitle: "Frequently Asked Questions",
            reportType: "Report type",
            reportFormat: "Format",
            generateReport: "Generate report",
            generating: "Generating…",
            reportTypes: {
                usage: "Usage",
                members: "Members",
                billing: "Billing",
            },
            reportStatus: {
                pending: "Pending",
                processing: "Processing",
                completed: "Completed",
                failed: "Failed",
            },
            download: "Download",
            noReports: "No reports yet. Generate one above.",
            couldNotQueue: "Could not queue the report",
            couldNotRequest: "Could not request the report",
            couldNotLoad: "Could not load reports",
            downloadFailed: "Download failed",
            exportData: "Export data",
            exportDataDescription:
                "Reports are generated in the background. You can leave this page; the list updates automatically.",
            typeLabel: "Type",
            formatLabel: "Format",
            loadingReports: "Loading reports…",
            reportQueued: "{type} report queued",
            reportSuffix: "{type} report",
            rowCount: "{count} row(s)",
            pricing: {
                free: {
                    name: "Free",
                    description: "For individuals and small projects",
                    features: [
                        "Up to 3 team members",
                        "5 GB storage",
                        "Basic analytics",
                        "Community support",
                        "API access",
                    ],
                },
                pro: {
                    name: "Pro",
                    description: "For growing teams and businesses",
                    features: [
                        "Unlimited team members",
                        "100 GB storage",
                        "Advanced analytics",
                        "Priority support",
                        "API access",
                        "Custom branding",
                        "SSO authentication",
                        "Audit logs",
                    ],
                },
                enterprise: {
                    name: "Enterprise",
                    description: "For large organizations",
                    features: [
                        "Everything in Pro",
                        "Unlimited storage",
                        "Dedicated support",
                        "Custom integrations",
                        "SLA guarantee",
                        "On-premise option",
                        "Advanced security",
                        "Custom contracts",
                    ],
                },
                upgradeTo: "Upgrade to {plan}",
                currentPlan: "Current Plan",
                popular: "Most Popular",
                perMonth: "/month",
                billedYearly: "${amount} billed yearly",
            },
            faqs: [
                {
                    q: "Can I change plans at any time?",
                    a: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.",
                },
                {
                    q: "What payment methods do you accept?",
                    a: "We accept all major credit cards (Visa, Mastercard, Amex) and PayPal.",
                },
                {
                    q: "Is there a free trial?",
                    a: "Yes, all paid plans come with a 14-day free trial. No credit card required.",
                },
                {
                    q: "Can I get a refund?",
                    a: "We offer a 30-day money-back guarantee on all paid plans.",
                },
            ],
        },
        settings: {
            title: "Settings",
            subtitle: "Manage your account settings and preferences.",
            tabProfile: "Profile",
            tabAccount: "Account",
            tabNotifications: "Notifications",
            profileInformation: "Profile Information",
            profileInformationDescription: "Update your personal information.",
            avatarNotEnabled: "Avatar upload is not enabled yet.",
            accountSecurity: "Account Security",
            accountSecurityDescription:
                "Manage your account security settings.",
            emailVerified: "Email verified",
            emailVerifiedTrue: "Your email is verified",
            emailVerifiedFalse: "Please verify your email",
            verified: "Verified",
            unverified: "Unverified",
            password: "Password",
            changePassword: "Change your password",
            dangerZone: "Danger Zone",
            dangerZoneDescription: "Irreversible actions for your account.",
            notificationPreferences: "Notification Preferences",
            notificationPreferencesDescription:
                "Choose how you want to be notified.",
            notificationsComingSoon: "Notification settings coming soon.",
            yourName: "Your name",
            yourNamePlaceholder: "Your name",
            displayName: "Display name",
            emailReadonly: "Email cannot be changed",
            emailHint: "Your email is used to sign in and cannot be changed here.",
            uploadLogo: "Upload Logo",
            logoNotEnabled: "Logo upload is not enabled yet.",
            organizationUrl: "Organization URL",
            slugHint:
                "This is your organization's unique URL identifier and cannot be changed here.",
            saveChanges: "Save changes",
            profileUpdated: "Profile updated successfully",
            organizationName: "Organization name",
            organizationNamePlaceholder: "Acme Inc.",
            organizationSlug: "Slug",
            organizationUpdated: "Organization updated successfully",
            deleteAccount: "Delete account",
            deleteAccountDescription:
                "Permanently delete your account and all associated data.",
            deleteAccountConfirm: "Delete my account",
            deleting: "Deleting…",
            sessions: "Active sessions",
            revokeSession: "Revoke",
            signOut: "Sign out",
            signOutDescription: "Sign out from this device",
            deleteAccountTitle: "Delete your account?",
            deleteAccountWarning:
                "This permanently deletes your account and the memberships that link you to organizations. It cannot be undone.",
        },
        commandPalette: {
            trigger: "Search…",
            placeholder: "Type a command or search…",
            empty: "No results found.",
            navigation: "Navigation",
            quickActions: "Quick Actions",
            theme: "Theme",
            account: "Account",
            profile: "Profile",
            profileDescription: "View your profile",
            documentation: "Documentation",
            documentationDescription: "Read the docs",
            help: "Help & Support",
            helpDescription: "Get help",
            light: "Light",
            dark: "Dark",
            system: "System",
            active: "Active",
            logOut: "Log out",
        },
        userMenu: {
            profile: "Profile",
            settings: "Settings",
            logOut: "Log out",
        },
        orgSwitcher: {
            organizations: "Organizations",
            createOrganization: "Create Organization",
            createOrganizationDescription:
                "Create a new organization to collaborate with your team",
            organizationName: "Organization Name",
            organizationNamePlaceholder: "Acme Inc.",
            selectOrganization: "Select organization",
            noOrganizations: "No organizations yet",
        },
    },

    invitation: {
        notFound: {
            title: "Invitation not found",
            description:
                "This invitation link is invalid or has been removed. Ask an administrator to send a new one.",
        },
        expired: {
            title: "Invitation expired",
            description:
                "The invitation to join {organization} expired. Ask an administrator for a new invitation.",
        },
        revoked: {
            title: "Invitation revoked",
            description:
                "An administrator revoked this invitation to {organization}.",
        },
        accepted: {
            title: "Invitation already accepted",
            description: "This invitation to {organization} has already been used.",
        },
        joinTitle: "Join {organization}",
        invitedBy: "{name} invited you to collaborate.",
        invitedGeneric: "You have been invited to collaborate.",
        organization: "Organization",
        invitedEmail: "Invited email",
        role: "Role",
        signInToAccept: "Sign in to accept this invitation.",
        createAccountToAccept: "Create an account to accept this invitation.",
        signInButton: "Sign in to accept",
        createAccountButton: "Create an account",
        acceptButton: "Accept invitation",
        expires: "Invitation expires {date}",
    },
} as const;

export default en;

/**
 * The dictionary contract.
 *
 * Deliberately NOT `typeof en`: that would make every string a literal type, so
 * a translation could not differ from the English text. The mapped type below
 * keeps the exact KEY structure while widening each leaf to `string`.
 */
export type Dictionary = {
    [Section in keyof typeof en]: DeepWiden<(typeof en)[Section]>;
};

type DeepWiden<T> = T extends string
    ? string
    : T extends readonly (infer U)[]
      ? DeepWiden<U>[]
      : { [K in keyof T]: DeepWiden<T[K]> };
