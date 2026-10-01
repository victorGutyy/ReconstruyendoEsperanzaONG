// Public client API of the media module: components and Server Actions that
// other modules may use (see index.ts for the server side).
export { updateMediaDescription, updateMediaPeople } from "./actions";
export { MediaUploader } from "./components/media-uploader";
export { LibraryPicker } from "./components/library-picker";
export { describeIssues } from "./library";
