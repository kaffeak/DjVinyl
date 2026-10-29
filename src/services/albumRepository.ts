import {ID, Query} from "appwrite";
import {db, databaseId} from "@/src/services/appwrite";

export type NewAlbumData = {
  title: string;
  artist: string;
  sides: number;
  genres: string[];
};

export type AlbumUpdates = {
  url?: string;
  genres?: string[];
  trackList?: string[];
};

export async function listAlbums(libraryId: string) {
  const response = await db.listDocuments(
    databaseId,
    libraryId,
    [Query.limit(1000)]
  );
  return response.documents;
}

export async function createAlbum(libraryId: string, data: NewAlbumData) {
  return await db.createDocument(
    databaseId,
    libraryId,
    ID.unique(),
    data
  );
}

export async function updateAlbum(libraryId: string, documentId: string, changes: AlbumUpdates): Promise<void> {
  if (Object.keys(changes).length === 0) return;

  await db.updateDocument(
    databaseId,
    libraryId,
    documentId,
    changes
  );
}

export async function deleteAlbum(libraryId: string, documentId: string): Promise<void> {
  await db.deleteDocument(
    databaseId,
    libraryId,
    documentId
  );
}