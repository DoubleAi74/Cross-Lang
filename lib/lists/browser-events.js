export const LIST_CREATED_EVENT = "cross-lang:list-created";
export const LIST_UPDATED_EVENT = "cross-lang:list-updated";
export const LIST_DELETED_EVENT = "cross-lang:list-deleted";

function dispatchListEvent(type, detail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(type, { detail }));
}

export function dispatchListCreated(list) {
  dispatchListEvent(LIST_CREATED_EVENT, { list });
}

export function dispatchListUpdated(list) {
  dispatchListEvent(LIST_UPDATED_EVENT, { list });
}

export function dispatchListDeleted(id) {
  dispatchListEvent(LIST_DELETED_EVENT, { id });
}
