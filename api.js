const C_API = "http://127.0.0.1:8080/api";
const LOCAL_API = "/api";
let activeBase = null;

async function getBase() {
  if (activeBase) return activeBase;
  try {
    const res = await fetch(`${C_API}/health`, { signal: AbortSignal.timeout(600) });
    if (res.ok) {
      activeBase = C_API;
      return activeBase;
    }
  } catch {}
  activeBase = LOCAL_API;
  return activeBase;
}

async function request(path, options = {}) {
  let base = await getBase();
  try {
    const response = await fetch(`${base}${path}`, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.error || `Request failed: ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  } catch (err) {
    if (base === C_API) {
      activeBase = LOCAL_API;
      const response = await fetch(`${LOCAL_API}${path}`, options);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || error.error || `Request failed: ${response.status}`);
      }
      if (response.status === 204) return null;
      return response.json();
    }
    throw err;
  }
}

export const api = {
  health: () => request("/health"),

  listFiles: () => request("/files"),

  upload: (file, relativePath = "") => {
    const path = relativePath || file.name;

    return request(`/upload?${new URLSearchParams({ path })}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: file,
    });
  },

  create: (name, content = "") =>
    request(
      `/create?${new URLSearchParams({ path: name, type: "file" })}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: content,
      }
    ),

  createFolder: (name, path = "") => {
    const folderPath = path ? `${path}/${name}` : name;

    return request(
      `/create?${new URLSearchParams({
        path: folderPath,
        type: "folder",
      })}`,
      { method: "POST" }
    );
  },

  rename: (path, name) =>
    request(
      `/rename?${new URLSearchParams({ path, name })}`,
      { method: "POST" }
    ),

  duplicate: (path) =>
    request(
      `/duplicate?${new URLSearchParams({ path })}`,
      { method: "POST" }
    ),

  remove: (path) =>
    request(
      `/delete?${new URLSearchParams({ path })}`,
      { method: "DELETE" }
    ),

  getContent: (path) =>
    request(`/content?${new URLSearchParams({ path })}`),

  saveContent: (path, content) =>
    request(`/content?${new URLSearchParams({ path })}`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: content,
    }),
};
