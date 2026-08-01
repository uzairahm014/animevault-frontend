// src/api.js
// Every function here talks to your deployed animevault-backend (Render).
// This file replaces supabaseStorage completely.

import { getIdToken } from "./firebaseClient";

// Set this to your deployed backend URL once it's live, e.g.
// "https://animevault-backend.onrender.com"
export const BACKEND_URL = "";

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getIdToken();
    if (!token) throw new Error("Not logged in");
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ---------------------------------------------------------------------- */
/* Users / profiles                                                       */
/* ---------------------------------------------------------------------- */

export const usersApi = {
  // Call this once right after Firebase sign-up succeeds
  create: (username, email) => request("/users/create", { method: "POST", auth: true, body: { username, email } }),
  get: (uid) => request(`/users/${uid}`),
  updateMe: ({ displayName, bio, website, bannerColor }) =>
    request("/users/me", { method: "PATCH", auth: true, body: { displayName, bio, website, bannerColor } }),
};

/* ---------------------------------------------------------------------- */
/* Uploads — Cloudinary direct upload (images AND video, no size hack)    */
/* ---------------------------------------------------------------------- */

// 1. Ask the backend for a signed upload slot (keeps your Cloudinary secret safe)
// 2. Upload the raw file straight to Cloudinary using those signed params
// 3. You get back a permanent URL — pass that into postsApi.create / wallpapersApi.create
export async function uploadFile(file, folder = "uploads", onProgress) {
  const sign = await request("/upload/sign", { method: "POST", auth: true, body: { folder } });

  const isVideo = file.type.startsWith("video/");
  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sign.cloudName}/${isVideo ? "video" : "image"}/upload`;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sign.apiKey);
  fd.append("timestamp", sign.timestamp);
  fd.append("signature", sign.signature);
  fd.append("folder", sign.folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (d.secure_url) resolve({ url: d.secure_url, resourceType: isVideo ? "video" : "image" });
        else reject(new Error(d.error?.message || "Upload failed"));
      } catch (e) {
        reject(e);
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.open("POST", cloudinaryUrl);
    xhr.send(fd);
  });
}

/* ---------------------------------------------------------------------- */
/* Posts (anime edits)                                                    */
/* ---------------------------------------------------------------------- */

export const postsApi = {
  list: () => request("/posts"),
  create: (post) => request("/posts", { method: "POST", auth: true, body: post }),
  like: (id) => request(`/posts/${id}/like`, { method: "POST", auth: true }),
  download: (id) => request(`/posts/${id}/download`, { method: "POST" }),
  view: (id) => request(`/posts/${id}/view`, { method: "POST" }),
  remove: (id) => request(`/posts/${id}`, { method: "DELETE", auth: true }),
};

/* ---------------------------------------------------------------------- */
/* Wallpapers                                                             */
/* ---------------------------------------------------------------------- */

export const wallpapersApi = {
  list: () => request("/wallpapers"),
  create: (wallpaper) => request("/wallpapers", { method: "POST", auth: true, body: wallpaper }),
  like: (id) => request(`/wallpapers/${id}/like`, { method: "POST", auth: true }),
  download: (id) => request(`/wallpapers/${id}/download`, { method: "POST" }),
  remove: (id) => request(`/wallpapers/${id}`, { method: "DELETE", auth: true }),
};

export const albumsApi = {
  list: () => request("/albums"),
  create: (album) => request("/albums", { method: "POST", auth: true, body: album }),
  remove: (id) => request(`/albums/${id}`, { method: "DELETE", auth: true }),
};

/* ---------------------------------------------------------------------- */
/* Anime episodes                                                         */
/* ---------------------------------------------------------------------- */

export const episodesApi = {
  list: () => request("/episodes"),
  create: (episode) => request("/episodes", { method: "POST", auth: true, body: episode }),
  view: (id) => request(`/episodes/${id}/view`, { method: "POST" }),
  remove: (id) => request(`/episodes/${id}`, { method: "DELETE", auth: true }),
};

/* ---------------------------------------------------------------------- */
/* Notifications                                                          */
/* ---------------------------------------------------------------------- */

export const notificationsApi = {
  mine: () => request("/notifications/me", { auth: true }),
  markRead: () => request("/notifications/mark-read", { method: "POST", auth: true }),
};

/* ---------------------------------------------------------------------- */
/* Requests (help / feature requests / bug reports to the admin)          */
/* ---------------------------------------------------------------------- */

export const requestsApi = {
  send: (text, category) => request("/requests", { method: "POST", auth: true, body: { text, category } }),
};

/* ---------------------------------------------------------------------- */
/* Admin                                                                  */
/* ---------------------------------------------------------------------- */

export const adminApi = {
  pending: () => request("/admin/pending", { auth: true }),
  approvePost: (id) => request(`/admin/posts/${id}/approve`, { method: "POST", auth: true }),
  rejectPost: (id) => request(`/admin/posts/${id}/reject`, { method: "POST", auth: true }),
  approveWallpaper: (id) => request(`/admin/wallpapers/${id}/approve`, { method: "POST", auth: true }),
  rejectWallpaper: (id) => request(`/admin/wallpapers/${id}/reject`, { method: "POST", auth: true }),
  banUser: (uid) => request(`/admin/users/${uid}/ban`, { method: "POST", auth: true }),
  makeAdmin: (uid) => request(`/admin/users/${uid}/make-admin`, { method: "POST", auth: true }),
  removeAdmin: (uid) => request(`/admin/users/${uid}/remove-admin`, { method: "POST", auth: true }),
  listUsers: () => request("/admin/users", { auth: true }),
  listRequests: () => request("/admin/requests", { auth: true }),
  updateRequest: (id, status) => request(`/admin/requests/${id}`, { method: "PATCH", auth: true, body: { status } }),
};
