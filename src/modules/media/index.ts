// Public server API of the media module (docs/04 §3: other modules import only
// what is exported here or in client.ts, never internal files).
export { countPendingPhotos, getMediaCards, getPublishIssues, type MediaCard } from "./queries";
export { describeIssues, ISSUES, type IssueCode, PEOPLE_LABELS, PEOPLE_OPTIONS } from "./library";
export type { PeopleInPhoto } from "./library";
export {
  publicKeyFor,
  removeMediaFiles,
  type SyncReport,
  syncPublicMedia,
  syncPublicMediaAfter,
} from "./publishing";
