// Central registry for help documentation in PT and EN.
// Views use <HelpButton docKey="properties" /> instead of importing markdown files directly.

import overviewPt from '@/docs/overview.pt.md?raw'
import overviewEn from '@/docs/overview.en.md?raw'

import propertiesPt from '@/docs/properties.pt.md?raw'
import propertiesEn from '@/docs/properties.en.md?raw'

import contractsPt from '@/docs/contracts.pt.md?raw'
import contractsEn from '@/docs/contracts.en.md?raw'

import guestsPt from '@/docs/guests.pt.md?raw'
import guestsEn from '@/docs/guests.en.md?raw'

import ownersPt from '@/docs/owners.pt.md?raw'
import ownersEn from '@/docs/owners.en.md?raw'

import financesPt from '@/docs/finances.pt.md?raw'
import financesEn from '@/docs/finances.en.md?raw'

import tasksPt from '@/docs/tasks.pt.md?raw'
import tasksEn from '@/docs/tasks.en.md?raw'

import appointmentsPt from '@/docs/appointments.pt.md?raw'
import appointmentsEn from '@/docs/appointments.en.md?raw'

import documentsPt from '@/docs/documents.pt.md?raw'
import documentsEn from '@/docs/documents.en.md?raw'

import serviceProvidersPt from '@/docs/service-providers.pt.md?raw'
import serviceProvidersEn from '@/docs/service-providers.en.md?raw'

import reportsPt from '@/docs/reports.pt.md?raw'
import reportsEn from '@/docs/reports.en.md?raw'

import calendarPt from '@/docs/calendar.pt.md?raw'
import calendarEn from '@/docs/calendar.en.md?raw'

import inspectionsPt from '@/docs/inspections.pt.md?raw'
import inspectionsEn from '@/docs/inspections.en.md?raw'

import auditLogsPt from '@/docs/audit-logs.pt.md?raw'
import auditLogsEn from '@/docs/audit-logs.en.md?raw'

import contractTemplatesPt from '@/docs/contract-templates.pt.md?raw'
import contractTemplatesEn from '@/docs/contract-templates.en.md?raw'

import aiAssistantPt from '@/docs/ai-assistant.pt.md?raw'
import aiAssistantEn from '@/docs/ai-assistant.en.md?raw'

import usersPermissionsPt from '@/docs/users-permissions.pt.md?raw'
import usersPermissionsEn from '@/docs/users-permissions.en.md?raw'

import formPropertyPt from '@/docs/form-property.pt.md?raw'
import formPropertyEn from '@/docs/form-property.en.md?raw'

import formContractPt from '@/docs/form-contract.pt.md?raw'
import formContractEn from '@/docs/form-contract.en.md?raw'

import formGuestPt from '@/docs/form-guest.pt.md?raw'
import formGuestEn from '@/docs/form-guest.en.md?raw'

import formOwnerPt from '@/docs/form-owner.pt.md?raw'
import formOwnerEn from '@/docs/form-owner.en.md?raw'

import formTransactionPt from '@/docs/form-transaction.pt.md?raw'
import formTransactionEn from '@/docs/form-transaction.en.md?raw'

import formAppointmentPt from '@/docs/form-appointment.pt.md?raw'
import formAppointmentEn from '@/docs/form-appointment.en.md?raw'

import formDocumentPt from '@/docs/form-document.pt.md?raw'
import formDocumentEn from '@/docs/form-document.en.md?raw'

import formServiceProviderPt from '@/docs/form-service-provider.pt.md?raw'
import formServiceProviderEn from '@/docs/form-service-provider.en.md?raw'

import formInspectionPt from '@/docs/form-inspection.pt.md?raw'
import formInspectionEn from '@/docs/form-inspection.en.md?raw'

import formTaskPt from '@/docs/form-task.pt.md?raw'
import formTaskEn from '@/docs/form-task.en.md?raw'

import formTemplatePt from '@/docs/form-template.pt.md?raw'
import formTemplateEn from '@/docs/form-template.en.md?raw'

export type HelpDocKey =
  | 'overview'
  | 'properties' | 'form-property'
  | 'contracts' | 'form-contract'
  | 'guests' | 'form-guest'
  | 'owners' | 'form-owner'
  | 'finances' | 'form-transaction'
  | 'tasks' | 'form-task'
  | 'appointments' | 'form-appointment'
  | 'documents' | 'form-document'
  | 'service-providers' | 'form-service-provider'
  | 'reports'
  | 'calendar'
  | 'inspections' | 'form-inspection'
  | 'audit-logs'
  | 'contract-templates' | 'form-template'
  | 'ai-assistant'
  | 'users-permissions'

export const HELP_DOCS: Record<HelpDocKey, { pt: string; en: string }> = {
  'overview':               { pt: overviewPt,              en: overviewEn },
  'properties':             { pt: propertiesPt,            en: propertiesEn },
  'form-property':          { pt: formPropertyPt,          en: formPropertyEn },
  'contracts':              { pt: contractsPt,             en: contractsEn },
  'form-contract':          { pt: formContractPt,          en: formContractEn },
  'guests':                 { pt: guestsPt,                en: guestsEn },
  'form-guest':             { pt: formGuestPt,             en: formGuestEn },
  'owners':                 { pt: ownersPt,                en: ownersEn },
  'form-owner':             { pt: formOwnerPt,             en: formOwnerEn },
  'finances':               { pt: financesPt,              en: financesEn },
  'form-transaction':       { pt: formTransactionPt,       en: formTransactionEn },
  'tasks':                  { pt: tasksPt,                 en: tasksEn },
  'form-task':              { pt: formTaskPt,              en: formTaskEn },
  'appointments':           { pt: appointmentsPt,          en: appointmentsEn },
  'form-appointment':       { pt: formAppointmentPt,       en: formAppointmentEn },
  'documents':              { pt: documentsPt,             en: documentsEn },
  'form-document':          { pt: formDocumentPt,          en: formDocumentEn },
  'service-providers':      { pt: serviceProvidersPt,      en: serviceProvidersEn },
  'form-service-provider':  { pt: formServiceProviderPt,   en: formServiceProviderEn },
  'reports':                { pt: reportsPt,               en: reportsEn },
  'calendar':               { pt: calendarPt,              en: calendarEn },
  'inspections':            { pt: inspectionsPt,           en: inspectionsEn },
  'form-inspection':        { pt: formInspectionPt,        en: formInspectionEn },
  'audit-logs':             { pt: auditLogsPt,             en: auditLogsEn },
  'contract-templates':     { pt: contractTemplatesPt,     en: contractTemplatesEn },
  'form-template':          { pt: formTemplatePt,          en: formTemplateEn },
  'ai-assistant':           { pt: aiAssistantPt,           en: aiAssistantEn },
  'users-permissions':      { pt: usersPermissionsPt,      en: usersPermissionsEn },
}
