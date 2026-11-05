import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.join(__dirname, "storage");
const storageFile = path.join(storageDir, "files.json");

const INITIAL_FILES = [
  {
    id: "algorithms",
    name: "algorithms",
    path: "algorithms",
    extension: "folder",
    isFolder: true,
    size: 0,
    modifiedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    content: "",
  },
  {
    id: "data_structures",
    name: "data_structures",
    path: "data_structures",
    extension: "folder",
    isFolder: true,
    size: 0,
    modifiedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    content: "",
  },
  {
    id: "notes",
    name: "notes",
    path: "notes",
    extension: "folder",
    isFolder: true,
    size: 0,
    modifiedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    content: "",
  },
  {
    id: "algorithms/BinarySearchTree.cpp",
    name: "BinarySearchTree.cpp",
    path: "algorithms/BinarySearchTree.cpp",
    extension: ".cpp",
    isFolder: false,
    size: 1340,
    modifiedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    content: `#include <iostream>

struct Node {
    int key;
    Node* left;
    Node* right;
    Node(int val) : key(val), left(nullptr), right(nullptr) {}
};

class BinarySearchTree {
public:
    Node* root = nullptr;

    Node* insert(Node* node, int key) {
        if (!node) return new Node(key);
        if (key < node->key) node->left = insert(node->left, key);
        else if (key > node->key) node->right = insert(node->right, key);
        return node;
    }

    bool search(Node* node, int key) {
        if (!node) return false;
        if (node->key == key) return true;
        if (key < node->key) return search(node->left, key);
        return search(node->right, key);
    }
};

int main() {
    BinarySearchTree bst;
    bst.root = bst.insert(bst.root, 50);
    bst.insert(bst.root, 30);
    bst.insert(bst.root, 70);
    std::cout << "BST Initialized successfully." << std::endl;
    return 0;
}`,
  },
  {
    id: "algorithms/QuickSort.py",
    name: "QuickSort.py",
    path: "algorithms/QuickSort.py",
    extension: ".py",
    isFolder: false,
    size: 685,
    modifiedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    content: `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

if __name__ == "__main__":
    test_data = [64, 34, 25, 12, 22, 11, 90]
    sorted_data = quick_sort(test_data)
    print("Sorted array:", sorted_data)
`,
  },
  {
    id: "data_structures/LinkedList.c",
    name: "LinkedList.c",
    path: "data_structures/LinkedList.c",
    extension: ".c",
    isFolder: false,
    size: 890,
    modifiedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    content: `#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node* next;
};

void push(struct Node** head_ref, int new_data) {
    struct Node* new_node = (struct Node*)malloc(sizeof(struct Node));
    new_node->data = new_data;
    new_node->next = (*head_ref);
    (*head_ref) = new_node;
}

void printList(struct Node* node) {
    while (node != NULL) {
        printf("%d -> ", node->data);
        node = node->next;
    }
    printf("NULL\\n");
}

int main() {
    struct Node* head = NULL;
    push(&head, 7);
    push(&head, 1);
    printList(head);
    return 0;
}`,
  },
  {
    id: "notes/DSA_Complexity_CheatSheet.md",
    name: "DSA_Complexity_CheatSheet.md",
    path: "notes/DSA_Complexity_CheatSheet.md",
    extension: ".md",
    isFolder: false,
    size: 512,
    modifiedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    content: `# DSA Complexity Cheat Sheet

| Data Structure / Algorithm | Average Time | Worst Time | Space |
| -------------------------- | ------------ | ---------- | ----- |
| Array Access               | O(1)         | O(1)       | O(n)  |
| Hash Table Search          | O(1)         | O(n)       | O(n)  |
| Binary Search Tree         | O(log n)     | O(n)       | O(n)  |
| QuickSort                  | O(n log n)   | O(n^2)     | O(log n) |
| MergeSort                  | O(n log n)   | O(n log n) | O(n)  |
| Dijkstra Algorithm         | O(E + V log V)| O(V^2)    | O(V)  |
`,
  },
];

function loadFiles() {
  try {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    if (!fs.existsSync(storageFile)) {
      saveFiles(INITIAL_FILES);
      return INITIAL_FILES;
    }
    const data = fs.readFileSync(storageFile, "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveFiles(INITIAL_FILES);
      return INITIAL_FILES;
    }
    return parsed;
  } catch (err) {
    console.error("Error loading files store:", err);
    return INITIAL_FILES;
  }
}

function saveFiles(files) {
  try {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.writeFileSync(storageFile, JSON.stringify(files, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving files store:", err);
  }
}

function getExtension(filename) {
  const ext = path.extname(filename);
  return ext ? ext.toLowerCase() : "unknown";
}

function ensureParentFolders(files, itemPath) {
  const parts = itemPath.split("/").filter(Boolean);
  if (parts.length <= 1) return;

  let currentPath = "";
  for (let i = 0; i < parts.length - 1; i++) {
    currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
    const exists = files.some((f) => f.isFolder && f.path === currentPath);
    if (!exists) {
      files.push({
        id: currentPath,
        name: parts[i],
        path: currentPath,
        extension: "folder",
        isFolder: true,
        size: 0,
        modifiedAt: new Date().toISOString(),
        content: "",
      });
    }
  }
}

export function apiMiddleware(req, res, next) {
  if (!req.url.startsWith("/api")) {
    return next();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Content-Length", "0");
    return res.end();
  }

  const sendJson = (status, data) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };

  // GET /api/health
  if (pathname === "/api/health" && method === "GET") {
    return sendJson(200, { success: true, message: "Vite API server is running" });
  }

  // GET /api/files, /api/tree, /api/dashboard
  if ((pathname === "/api/files" || pathname === "/api/tree" || pathname === "/api/dashboard") && method === "GET") {
    const files = loadFiles();
    return sendJson(200, { success: true, files });
  }

  // POST /api/create (supports ?path=...&type=file|folder)
  if (pathname === "/api/create" && method === "POST") {
    const qPath = parsedUrl.searchParams.get("path") || "";
    const qType = parsedUrl.searchParams.get("type") || "file";

    let bodyStr = "";
    req.on("data", (chunk) => { bodyStr += chunk; });
    req.on("end", () => {
      try {
        let name = qPath;
        let content = bodyStr;
        let isFolder = qType === "folder";

        if (!name && bodyStr.startsWith("{")) {
          const bodyJson = JSON.parse(bodyStr);
          name = bodyJson.name || bodyJson.path || "";
          content = bodyJson.content || "";
          if (bodyJson.type === "folder" || bodyJson.isFolder) isFolder = true;
        }

        if (!name || !name.trim()) {
          return sendJson(400, { success: false, error: "Path/name is required" });
        }

        const cleanPath = name.trim().replace(/^[/\\]+|[/\\]+$/g, "").replace(/\\/g, "/");
        const cleanName = cleanPath.split("/").pop();
        const files = loadFiles();

        ensureParentFolders(files, cleanPath);

        const newRecord = {
          id: cleanPath,
          name: cleanName,
          path: cleanPath,
          extension: isFolder ? "folder" : getExtension(cleanName),
          isFolder: isFolder,
          size: isFolder ? 0 : Buffer.byteLength(content, "utf-8"),
          modifiedAt: new Date().toISOString(),
          content: isFolder ? "" : content,
        };

        const existingIdx = files.findIndex((f) => f.path === cleanPath);
        if (existingIdx !== -1) {
          files[existingIdx] = newRecord;
        } else {
          files.push(newRecord);
        }

        saveFiles(files);
        return sendJson(200, { success: true, file: newRecord });
      } catch (err) {
        return sendJson(500, { success: false, error: err.message });
      }
    });
    return;
  }

  // POST /api/upload (?path=...)
  if (pathname === "/api/upload" && method === "POST") {
    const qPath = parsedUrl.searchParams.get("path") || "";
    const chunks = [];
    req.on("data", (chunk) => { chunks.push(chunk); });
    req.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        const cleanPath = qPath.trim().replace(/^[/\\]+|[/\\]+$/g, "").replace(/\\/g, "/");
        const cleanName = cleanPath.split("/").pop();
        const files = loadFiles();

        ensureParentFolders(files, cleanPath);

        const fileRecord = {
          id: cleanPath,
          name: cleanName,
          path: cleanPath,
          extension: getExtension(cleanName),
          isFolder: false,
          size: buffer.length,
          modifiedAt: new Date().toISOString(),
          content: buffer.toString("utf-8"),
        };

        const existingIdx = files.findIndex((f) => f.path === cleanPath);
        if (existingIdx !== -1) {
          files[existingIdx] = fileRecord;
        } else {
          files.push(fileRecord);
        }

        saveFiles(files);
        return sendJson(200, { success: true, file: fileRecord });
      } catch (err) {
        return sendJson(500, { success: false, error: err.message });
      }
    });
    return;
  }

  // GET /api/content (?path=...)
  if (pathname === "/api/content" && method === "GET") {
    const qPath = parsedUrl.searchParams.get("path") || "";
    const files = loadFiles();
    const item = files.find((f) => f.path === qPath || f.id === qPath);
    if (!item) {
      return sendJson(404, { success: false, error: "File not found" });
    }
    return sendJson(200, { success: true, content: item.content || "" });
  }

  // PUT /api/content (?path=...)
  if (pathname === "/api/content" && method === "PUT") {
    const qPath = parsedUrl.searchParams.get("path") || "";
    let bodyStr = "";
    req.on("data", (chunk) => { bodyStr += chunk; });
    req.on("end", () => {
      try {
        const files = loadFiles();
        const item = files.find((f) => f.path === qPath || f.id === qPath);
        if (!item) {
          return sendJson(404, { success: false, error: "File not found" });
        }
        item.content = bodyStr;
        item.size = Buffer.byteLength(bodyStr, "utf-8");
        item.modifiedAt = new Date().toISOString();
        saveFiles(files);
        return sendJson(200, { success: true });
      } catch (err) {
        return sendJson(500, { success: false, error: err.message });
      }
    });
    return;
  }

  // POST /api/rename (?path=...&name=...)
  if (pathname === "/api/rename" && method === "POST") {
    const qPath = parsedUrl.searchParams.get("path") || "";
    const qName = parsedUrl.searchParams.get("name") || "";
    if (!qName) {
      return sendJson(400, { success: false, error: "New name is required" });
    }

    const files = loadFiles();
    const item = files.find((f) => f.path === qPath || f.id === qPath);
    if (!item) {
      return sendJson(404, { success: false, error: "Item not found" });
    }

    const oldPath = item.path;
    const newName = qName.trim();
    item.name = newName;
    if (!item.isFolder) {
      item.extension = getExtension(newName);
    }

    if (oldPath.includes("/")) {
      const dir = oldPath.substring(0, oldPath.lastIndexOf("/"));
      item.path = `${dir}/${newName}`;
    } else {
      item.path = newName;
    }
    item.id = item.path;
    item.modifiedAt = new Date().toISOString();

    if (item.isFolder) {
      const oldPrefix = `${oldPath}/`;
      const newPrefix = `${item.path}/`;
      files.forEach((f) => {
        if (f !== item && f.path.startsWith(oldPrefix)) {
          f.path = newPrefix + f.path.slice(oldPrefix.length);
          f.id = f.path;
        }
      });
    }

    saveFiles(files);
    return sendJson(200, { success: true, file: item });
  }

  // POST /api/duplicate (?path=...)
  if (pathname === "/api/duplicate" && method === "POST") {
    const qPath = parsedUrl.searchParams.get("path") || "";
    const files = loadFiles();
    const item = files.find((f) => f.path === qPath || f.id === qPath);
    if (!item) {
      return sendJson(404, { success: false, error: "Item not found" });
    }

    const baseName = item.name.includes(".")
      ? item.name.substring(0, item.name.lastIndexOf("."))
      : item.name;
    const suffix = item.name.includes(".")
      ? item.name.substring(item.name.lastIndexOf("."))
      : "";
    const newName = `${baseName}_copy${suffix}`;
    const dir = item.path.includes("/")
      ? item.path.substring(0, item.path.lastIndexOf("/"))
      : "";
    const newPath = dir ? `${dir}/${newName}` : newName;

    const dup = {
      ...item,
      id: newPath,
      name: newName,
      path: newPath,
      modifiedAt: new Date().toISOString(),
    };
    files.push(dup);
    saveFiles(files);
    return sendJson(200, { success: true, file: dup });
  }

  // DELETE /api/delete (?path=...)
  if (pathname === "/api/delete" && method === "DELETE") {
    const qPath = parsedUrl.searchParams.get("path") || "";
    const files = loadFiles();
    const itemIdx = files.findIndex((f) => f.path === qPath || f.id === qPath);
    if (itemIdx === -1) {
      return sendJson(404, { success: false, error: "Path not found" });
    }

    const item = files[itemIdx];
    if (item.isFolder) {
      const prefix = `${item.path}/`;
      const updated = files.filter((f) => f.path !== item.path && !f.path.startsWith(prefix));
      saveFiles(updated);
    } else {
      files.splice(itemIdx, 1);
      saveFiles(files);
    }

    return sendJson(200, { success: true });
  }

  return sendJson(404, { success: false, error: `Route ${method} ${pathname} not found` });
}
