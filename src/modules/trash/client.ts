// Public client API of the trash (step 7.7): components and Server Actions
// that pages may use (docs/04 §3), plus the pure rules.
export { purgeFromTrash, restoreFromTrash, trashContent, type TrashResult } from "./actions";
export { TrashContentButton } from "./components/trash-content-button";
export { TrashItemActions } from "./components/trash-item-actions";
export {
  isTrashableType,
  KIND_LABELS,
  kindName,
  parseTrashFilter,
  PURGE_WORD,
  TRASH_KINDS,
  TRASH_PATH,
  type TrashableType,
  type TrashedItem,
  type TrashKind,
} from "./schema";
