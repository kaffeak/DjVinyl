import {Client, Databases} from "appwrite";

const client = new Client()
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? "")
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? "");

export const db = new Databases(client);

export const databaseId = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ?? "";