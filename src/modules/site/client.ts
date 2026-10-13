// Pieces of the public site frame that Client Components may import (no
// server code, unlike index.ts, which also carries the frame and its data).
export { Photo, type PhotoData } from "./components/photo";
// Client Components the pages render (step 9.6): exported here, not from
// index.ts, so pages that do not use them do not download them
export { PhotoViewer, type ViewerPhoto } from "./components/photo-viewer";
export { ShareButtons } from "./components/share-buttons";
