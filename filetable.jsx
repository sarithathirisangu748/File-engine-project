import { Eye, Pencil, Copy, Trash2, File, FileCode, Folder } from "lucide-react";

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

function FileTable({ files, onPreview, onRename, onDuplicate, onDelete }) {
  if (!files.length) {
    return (
      <div className="empty-state">
        <File size={38} />
        <h3>No files found</h3>
        <p>Upload a file, create a folder, or change your search and filters.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="file-table">
        <thead>
          <tr>
            <th>File / Folder name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Last modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <td>
                <div className="file-name">
                  {file.isFolder ? (
                    <Folder size={19} className="folder-table-icon" style={{ color: "#d99b24" }} />
                  ) : (
                    <FileCode size={19} />
                  )}
                  <span>{file.name}</span>
                </div>
              </td>
              <td>
                <span className={`type-badge ${file.isFolder ? "folder-badge" : ""}`}>
                  {file.isFolder ? "Folder" : (file.extension || "Unknown")}
                </span>
              </td>
              <td>{file.isFolder ? "—" : formatSize(file.size)}</td>
              <td>
                {file.modifiedAt
                  ? new Date(file.modifiedAt).toLocaleString()
                  : "—"}
              </td>
              <td>
                <div className="actions">
                  {!file.isFolder && (
                    <button title="View" onClick={() => onPreview(file)}>
                      <Eye size={17} />
                    </button>
                  )}
                  <button title="Rename" onClick={() => onRename(file)}>
                    <Pencil size={17} />
                  </button>
                  {!file.isFolder && (
                    <button title="Duplicate" onClick={() => onDuplicate(file)}>
                      <Copy size={17} />
                    </button>
                  )}
                  <button
                    className="danger-icon"
                    title="Delete"
                    onClick={() => onDelete(file)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FileTable;
