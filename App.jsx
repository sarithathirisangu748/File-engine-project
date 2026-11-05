import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Files,
  Search,
  Upload,
  Plus,
  RefreshCw,
  HardDrive,
  FileText,
  FolderTree as FolderTreeIcon,
  List,
  FolderUp,
  FolderPlus,
  Folder,
} from "lucide-react";
import { api } from "./api";
import FileTable from "./components/filetable";
import FolderTree from "./components/foldertree";
import FilePreview from "./components/filepreview";
import ConfirmDelete from "./components/confirmdelete";
import "./styles.css";

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

function App() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [extension, setExtension] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [sort, setSort] = useState("name-asc");
  const [preview, setPreview] = useState(null);
  const [deleteFile, setDeleteFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState("list");
  const uploadRef = useRef(null);
  const folderUploadRef = useRef(null);

  // webkitdirectory is a non-standard attribute React strips — set it imperatively
  useEffect(() => {
    if (folderUploadRef.current) {
      folderUploadRef.current.setAttribute("webkitdirectory", "");
      folderUploadRef.current.setAttribute("directory", "");
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError("");
      const result = await api.listFiles();
      setFiles(Array.isArray(result) ? result : result.files || []);
    } catch (err) {
      setError(`Cannot load files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const extensions = useMemo(
    () => [
      ...new Set(
        files
          .filter((f) => !f.isFolder)
          .map((f) => f.extension || "unknown")
      ),
    ].sort(),
    [files]
  );

  const filteredFiles = useMemo(() => {
    let result = files.filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(search.toLowerCase());
      const matchesExtension =
        extension === "all" ||
        (file.isFolder ? extension === "folder" : (file.extension || "unknown") === extension);

      let matchesSize = true;
      if (file.isFolder) {
        matchesSize = sizeFilter === "all" || sizeFilter === "small";
      } else {
        if (sizeFilter === "small") matchesSize = file.size < 100 * 1024;
        if (sizeFilter === "medium")
          matchesSize = file.size >= 100 * 1024 && file.size < 1024 * 1024;
        if (sizeFilter === "large") matchesSize = file.size >= 1024 * 1024;
      }

      return matchesSearch && matchesExtension && matchesSize;
    });

    result.sort((a, b) => {
      // Folders first in default view
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "size-desc") return b.size - a.size;
      if (sort === "size-asc") return a.size - b.size;
      if (sort === "modified-desc")
        return new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0);
      if (sort === "modified-asc")
        return new Date(a.modifiedAt || 0) - new Date(b.modifiedAt || 0);
      return 0;
    });

    return result;
  }, [files, search, extension, sizeFilter, sort]);

  const totalFiles = files.filter((f) => !f.isFolder).length;
  const totalFolders = files.filter((f) => f.isFolder).length;
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);


  async function perform(action, successMessage) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
      await refresh();
      setNotice(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;

    await perform(async () => {
      for (const file of selected) {
        await api.upload(file, file.webkitRelativePath || file.relativePath || "");
      }
    }, `${selected.length} file(s) uploaded successfully.`);
  }

  async function createFile() {
    const name = window.prompt("Enter new filename (e.g. notes.txt or main.py):");
    if (!name?.trim()) return;

    const content = window.prompt("Enter initial text (optional):") || "";
    await perform(() => api.create(name.trim(), content), `File "${name.trim()}" created.`);
  }

  async function createFolder(parentPath = "") {
    const promptMessage = parentPath
      ? `Enter new folder name inside "${parentPath}":`
      : "Enter new folder name (e.g. algorithms or projects):";
    const name = window.prompt(promptMessage);
    if (!name?.trim()) return;

    await perform(
      () => api.createFolder(name.trim(), parentPath || ""),
      `Folder "${name.trim()}" created successfully.`
    );
  }

  async function renameFile(file) {
    const name = window.prompt(
      `Enter the new ${file.isFolder ? "folder" : "file"} name:`,
      file.name
    );
    if (!name?.trim() || name.trim() === file.name) return;

    await perform(
      () => api.rename(file.id, name.trim()),
      `${file.isFolder ? "Folder" : "File"} renamed successfully.`
    );
  }

  async function duplicateFile(file) {
    await perform(
      () => api.duplicate(file.id),
      "File duplicated successfully."
    );
  }

  async function confirmDelete() {
    if (!deleteFile) return;
    const target = deleteFile;

    await perform(
      () => api.remove(target.id),
      `${target.isFolder ? "Folder" : "File"} deleted successfully.`
    );

    setDeleteFile(null);
    if (preview?.id === target.id) setPreview(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Files size={23} /></div>
          <div>
            <strong>DSA File Manager</strong>
            <span>Smart file search</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <button
          className={`nav-item nav-button${view === "list" ? " active" : ""}`}
          onClick={() => setView("list")}
        >
          <LayoutDashboard size={19} /> File Dashboard
        </button>
        <button
          className={`nav-item nav-button${view === "structure" ? " active" : ""}`}
          onClick={() => setView("structure")}
        >
          <FolderTreeIcon size={19} /> Folder Structure
        </button>

        <div className="sidebar-bottom">
          <div className="storage-label">
            <HardDrive size={18} />
            <span>Storage overview</span>
          </div>
          <h3>{formatSize(totalSize)}</h3>
          <p>{totalFiles} files in {totalFolders} folders</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / {view === "structure" ? "Folder Structure" : "Dashboard"}</span>
            <h1>{view === "structure" ? "Folder Structure Explorer" : "File Dashboard"}</h1>
            <p>Manage, search, organize and inspect your files and folders.</p>
          </div>

          <div className="top-actions">
            <button className="btn-secondary" onClick={refresh} disabled={busy} title="Refresh file list">
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="btn-secondary" onClick={() => createFolder()} disabled={busy} title="Create a new folder">
              <FolderPlus size={16} /> Create folder
            </button>
            <button className="btn-primary" onClick={createFile} disabled={busy} title="Create a new file">
              <Plus size={17} /> Create file
            </button>
          </div>
        </header>

        {error && <div className="alert error-message">{error}</div>}
        {notice && <div className="alert success-message">{notice}</div>}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><Files size={21} /></div>
            <p>Total files</p>
            <h2>{totalFiles}</h2>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><Folder size={21} /></div>
            <p>Folders</p>
            <h2>{totalFolders}</h2>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><HardDrive size={21} /></div>
            <p>Total storage</p>
            <h2>{formatSize(totalSize)}</h2>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><FileText size={21} /></div>
            <p>File types</p>
            <h2>{extensions.length}</h2>
          </div>
        </section>

        <section className="files-section">
          <div className="section-heading">
            <div>
              <h2>{view === "structure" ? "Folder structure" : "All files & folders"}</h2>
              <p>{filteredFiles.length} items matching your filters</p>
            </div>
            <div className="section-actions">
              <button
                className="btn-secondary view-toggle"
                onClick={() => setView((current) => (current === "list" ? "structure" : "list"))}
              >
                {view === "list" ? (
                  <><FolderTreeIcon size={17} /> Tree view</>
                ) : (
                  <><List size={17} /> Table view</>
                )}
              </button>
              <button
                className="btn-secondary"
                onClick={() => createFolder()}
                disabled={busy}
              >
                <FolderPlus size={17} /> Create folder
              </button>
              <button
                className="btn-secondary"
                onClick={() => folderUploadRef.current?.click()}
                disabled={busy}
              >
                <FolderUp size={17} /> Upload folder
              </button>
              <button
                className="btn-primary"
                onClick={() => uploadRef.current?.click()}
                disabled={busy}
              >
                <Upload size={17} /> Upload files
              </button>
            </div>
          </div>

          {/* Hidden file inputs — kept outside section-heading to avoid layout interference */}
          <input
            ref={uploadRef}
            type="file"
            multiple
            hidden
            onChange={uploadFiles}
          />
          <input
            ref={folderUploadRef}
            type="file"
            multiple
            hidden
            onChange={uploadFiles}
          />

          <div className="filter-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files and folders..."
              />
            </div>

            <select value={extension} onChange={(e) => setExtension(e.target.value)}>
              <option value="all">All types & folders</option>
              <option value="folder">📁 Folders only</option>
              {extensions.map((ext) => (
                <option key={ext} value={ext}>{ext}</option>
              ))}
            </select>

            <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
              <option value="all">All sizes</option>
              <option value="small">Small (&lt; 100 KB)</option>
              <option value="medium">Medium (100 KB–1 MB)</option>
              <option value="large">Large (1 MB+)</option>
            </select>

            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name-asc">Name: A–Z</option>
              <option value="name-desc">Name: Z–A</option>
              <option value="size-asc">Size: smallest</option>
              <option value="size-desc">Size: largest</option>
              <option value="modified-desc">Recently modified</option>
              <option value="modified-asc">Oldest modified</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Loading files...</div>
          ) : view === "structure" ? (
            <FolderTree
              files={filteredFiles}
              onPreview={setPreview}
              onRename={renameFile}
              onDelete={setDeleteFile}
              onCreateFolder={createFolder}
            />
          ) : (
            <FileTable
              files={filteredFiles}
              onPreview={setPreview}
              onRename={renameFile}
              onDuplicate={duplicateFile}
              onDelete={setDeleteFile}
            />
          )}
        </section>
      </main>

      {preview && (
        <FilePreview
          file={preview}
          onClose={() => setPreview(null)}
          onSaved={refresh}
        />
      )}

      <ConfirmDelete
        file={deleteFile}
        onCancel={() => setDeleteFile(null)}
        onConfirm={confirmDelete}
        loading={busy}
      />
    </div>
  );
}

export default App;
