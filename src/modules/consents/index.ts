// Public server API of the consents module (docs/04 §3: other modules import
// only what is exported here or in client.ts).
export {
  getPersonConsent,
  type LinkedConsent,
  listConsentsForMedia,
  type PersonConsentStatus,
} from "./queries";
export { STATUS_LABELS as CONSENT_STATUS_LABELS } from "./schema";
