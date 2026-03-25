import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { MobileShell } from './components/layout/MobileShell'
import { AuthGuard, RoleGuard } from './features/auth/components/AuthGuard'
import { ErrorBoundary, RouteErrorFallback } from './components/feedback/ErrorBoundary'
import { LoginPage } from './features/auth/pages/LoginPage'
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage'
import { NotFoundPage } from './features/auth/pages/NotFoundPage'
import { Role } from './types'

// ---------------------------------------------------------------------------
// Lazy-loaded pages (code splitting per route)
// ---------------------------------------------------------------------------
const DashboardPage = lazy(() => import('./features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const PlanningPage = lazy(() => import('./features/planning/pages/PlanningPage').then(m => ({ default: m.PlanningPage })))
const InterventionListPage = lazy(() => import('./features/planning/pages/InterventionListPage'))
const ClientListPage = lazy(() => import('./features/crm/pages/ClientListPage').then(m => ({ default: m.ClientListPage })))
const ClientDetailPage = lazy(() => import('./features/crm/pages/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })))
const ClientFormPage = lazy(() => import('./features/crm/pages/ClientFormPage'))
const ProspectPipelinePage = lazy(() => import('./features/crm/pages/ProspectPipelinePage').then(m => ({ default: m.ProspectPipelinePage })))
const QuoteListPage = lazy(() => import('./features/crm/pages/QuoteListPage').then(m => ({ default: m.QuoteListPage })))
const QuoteCreatePage = lazy(() => import('./features/crm/pages/QuoteCreatePage').then(m => ({ default: m.QuoteCreatePage })))
const QuoteDetailPage = lazy(() => import('./features/crm/pages/QuoteDetailPage').then(m => ({ default: m.QuoteDetailPage })))
const QuoteEditPage = lazy(() => import('./features/crm/pages/QuoteEditPage').then(m => ({ default: m.QuoteEditPage })))
const SupplierListPage = lazy(() => import('./features/crm/pages/SupplierListPage').then(m => ({ default: m.SupplierListPage })))
const InvoiceListPage = lazy(() => import('./features/billing/pages/InvoiceListPage').then(m => ({ default: m.InvoiceListPage })))
const InvoiceCreatePage = lazy(() => import('./features/billing/pages/InvoiceCreatePage').then(m => ({ default: m.InvoiceCreatePage })))
const InvoiceDetailPage = lazy(() => import('./features/billing/pages/InvoiceDetailPage').then(m => ({ default: m.InvoiceDetailPage })))
const FiscalAttestationPage = lazy(() => import('./features/billing/pages/FiscalAttestationPage').then(m => ({ default: m.FiscalAttestationPage })))
const PersonnelListPage = lazy(() => import('./features/resources/pages/PersonnelListPage').then(m => ({ default: m.PersonnelListPage })))
const VehicleListPage = lazy(() => import('./features/resources/pages/VehicleListPage').then(m => ({ default: m.VehicleListPage })))
const EquipmentListPage = lazy(() => import('./features/resources/pages/EquipmentListPage').then(m => ({ default: m.EquipmentListPage })))
const UserManagementPage = lazy(() => import('./features/admin/pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })))
const SystemSettingsPage = lazy(() => import('./features/admin/pages/SystemSettingsPage').then(m => ({ default: m.SystemSettingsPage })))
const AuditLogPage = lazy(() => import('./features/admin/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const CustomFieldsPage = lazy(() => import('./features/admin/pages/CustomFieldsPage').then(m => ({ default: m.CustomFieldsPage })))
const ReportingPage = lazy(() => import('./features/reporting/pages/ReportingPage').then(m => ({ default: m.ReportingPage })))
const WorkflowRulesPage = lazy(() => import('./features/admin/pages/WorkflowRulesPage').then(m => ({ default: m.WorkflowRulesPage })))
const WorkflowRuleFormPage = lazy(() => import('./features/admin/pages/WorkflowRuleFormPage').then(m => ({ default: m.WorkflowRuleFormPage })))
const QuoteTemplateListPage = lazy(() => import('./features/billing/pages/QuoteTemplateListPage').then(m => ({ default: m.QuoteTemplateListPage })))
const QuoteTemplateFormPage = lazy(() => import('./features/billing/pages/QuoteTemplateFormPage').then(m => ({ default: m.QuoteTemplateFormPage })))
const EventListPage = lazy(() => import('./features/relation/pages/EventListPage'))
const EventDetailPage = lazy(() => import('./features/relation/pages/EventDetailPage'))
const NewsletterListPage = lazy(() => import('./features/relation/pages/NewsletterListPage'))
const NewsletterComposePage = lazy(() => import('./features/relation/pages/NewsletterComposePage'))
const MessagingPage = lazy(() => import('./features/messagerie/pages/MessagingPage'))
const QuoteSignPage = lazy(() => import('./features/crm/pages/QuoteSignPage'))
const DailySchedulePage = lazy(() => import('./features/mobile/pages/DailySchedulePage').then(m => ({ default: m.DailySchedulePage })))
const MobileInterventionPage = lazy(() => import('./features/mobile/pages/MobileInterventionPage').then(m => ({ default: m.MobileInterventionPage })))
const TeamPage = lazy(() => import('./features/mobile/pages/TeamPage').then(m => ({ default: m.TeamPage })))
const ProfilePage = lazy(() => import('./features/mobile/pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const CatalogPage = lazy(() => import('./features/catalog/pages/CatalogPage').then(m => ({ default: m.CatalogPage })))
const ClientAnnualReportPage = lazy(() => import('./features/crm/pages/ClientAnnualReportPage').then(m => ({ default: m.ClientAnnualReportPage })))
const PaymentHistoryPage = lazy(() => import('./features/billing/pages/PaymentHistoryPage').then(m => ({ default: m.PaymentHistoryPage })))
const ContractListPage = lazy(() => import('./features/crm/pages/ContractListPage').then(m => ({ default: m.ContractListPage })))
const CommercialAgendaPage = lazy(() => import('./features/crm/pages/CommercialAgendaPage').then(m => ({ default: m.CommercialAgendaPage })))

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/sign/:token', element: <QuoteSignPage /> },

  // Mobile PWA routes (jardinier)
  {
    path: '/m',
    errorElement: <RouteErrorFallback />,
    element: (
      <AuthGuard roles={[Role.JARDINIER, Role.SUPER_ADMIN]}>
        <ErrorBoundary featureName="Mobile">
          <MobileShell />
        </ErrorBoundary>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/m/schedule" replace /> },
      { path: 'schedule', element: <DailySchedulePage /> },
      { path: 'intervention/:id', element: <MobileInterventionPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },

  // Desktop routes (authenticated)
  {
    path: '/',
    errorElement: <RouteErrorFallback />,
    element: (
      <AuthGuard>
        <ErrorBoundary featureName="Application">
          <AppShell />
        </ErrorBoundary>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // Dashboard
      { path: 'dashboard', element: <DashboardPage /> },

      // Planning
      {
        path: 'planning',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX]}>
            <PlanningPage />
          </RoleGuard>
        ),
      },

      // Reporting
      {
        path: 'reporting',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMPTABILITE]}>
            <ReportingPage />
          </RoleGuard>
        ),
      },

      // Interventions
      {
        path: 'interventions',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.CONDUCTEUR_TRAVAUX]}>
            <InterventionListPage />
          </RoleGuard>
        ),
      },

      // CRM
      {
        path: 'crm/clients',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX, Role.COMPTABILITE]}>
            <ClientListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/clients/new',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX]}>
            <ClientFormPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/clients/:id',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX, Role.COMPTABILITE]}>
            <ClientDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/clients/:id/edit',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX]}>
            <ClientFormPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/clients/:id/bilan',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.COMPTABILITE]}>
            <ClientAnnualReportPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/prospects',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <ProspectPipelinePage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/devis',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.FACTURATION]}>
            <QuoteListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/devis/new',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <QuoteCreatePage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/devis/:id',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.FACTURATION]}>
            <QuoteDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/devis/:id/edit',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <QuoteEditPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/fournisseurs',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX]}>
            <SupplierListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/contrats',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <ContractListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'crm/agenda',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <CommercialAgendaPage />
          </RoleGuard>
        ),
      },

      // Billing
      {
        path: 'billing/invoices',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.COMPTABILITE, Role.FACTURATION]}>
            <InvoiceListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'billing/invoices/new',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.COMPTABILITE, Role.FACTURATION]}>
            <InvoiceCreatePage />
          </RoleGuard>
        ),
      },
      {
        path: 'billing/invoices/:id',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.COMPTABILITE, Role.FACTURATION]}>
            <InvoiceDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'billing/paiements',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.COMPTABILITE, Role.FACTURATION]}>
            <PaymentHistoryPage />
          </RoleGuard>
        ),
      },
      {
        path: 'billing/attestations',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.COMPTABILITE]}>
            <FiscalAttestationPage />
          </RoleGuard>
        ),
      },
      {
        path: 'billing/templates',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <QuoteTemplateListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'billing/templates/new',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <QuoteTemplateFormPage />
          </RoleGuard>
        ),
      },
      {
        path: 'billing/templates/:id/edit',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <QuoteTemplateFormPage />
          </RoleGuard>
        ),
      },

      // Relation Client
      {
        path: 'relation/events',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <EventListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'relation/events/:id',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <EventDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'relation/newsletters',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <NewsletterListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'relation/newsletters/new',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <NewsletterComposePage />
          </RoleGuard>
        ),
      },
      {
        path: 'relation/newsletters/:id',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <NewsletterComposePage />
          </RoleGuard>
        ),
      },

      // Messagerie
      {
        path: 'messagerie',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX, Role.COMPTABILITE, Role.FACTURATION]}>
            <MessagingPage />
          </RoleGuard>
        ),
      },

      // Resources
      {
        path: 'resources/personnel',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.CONDUCTEUR_TRAVAUX]}>
            <PersonnelListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'resources/vehicles',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.CONDUCTEUR_TRAVAUX]}>
            <VehicleListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'resources/equipment',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.CONDUCTEUR_TRAVAUX]}>
            <EquipmentListPage />
          </RoleGuard>
        ),
      },

      // Catalogue prestations
      {
        path: 'catalog',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]}>
            <CatalogPage />
          </RoleGuard>
        ),
      },

      // Admin
      {
        path: 'admin/users',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN]}>
            <UserManagementPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/settings',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN]}>
            <SystemSettingsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/audit',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN]}>
            <AuditLogPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/custom-fields',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN]}>
            <CustomFieldsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/workflows',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN]}>
            <WorkflowRulesPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/workflows/new',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN]}>
            <WorkflowRuleFormPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/workflows/:id/edit',
        element: (
          <RoleGuard roles={[Role.SUPER_ADMIN, Role.ADMIN]}>
            <WorkflowRuleFormPage />
          </RoleGuard>
        ),
      },
    ],
  },

  // Catch-all 404
  { path: '*', element: <NotFoundPage /> },
])
