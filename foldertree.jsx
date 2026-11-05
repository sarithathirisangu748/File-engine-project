import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileCode,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";

function filePath(file) {
  return String(file.path || file.relativePath || file.name || "").replace(/\\/g, "/");
}

function makeTree(files) {
  const root = { folders: new Map(), files: [], folderItem: null };

  files.forEach((file) => {
    if (file.isFolder) {
      const parts = filePath(file).split("/").filter(Boolean);
      let node = root;
      parts.forEach((part) => {
        if (!node.folders.has(part)) {
          node.folders.set(part, { folders: new Map(), files: [], folderItem: null });
        }
        node = node.folders.get(part);
      });
      node.folderItem = file;
      return;
    }

    const parts = filePath(file).split("/").filter(Boolean);
    const filename = parts.pop() || file.name;
    let node = root;

    parts.forEach((part) => {
      if (!node.folders.has(part)) {
        node.folders.set(part, { folders: new Map(), files: [], folderItem: null });
      }
      node = node.folders.get(part);
    });

    node.files.push({ ...file, displayName: filename });
  });

  return root;
}

function TreeNode({
  node,
  name,
  currentPath = "",
  depth,
  onPreview,
  onRename,
  onDelete,
  onCreateFolder,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const folders = [...node.folders.entries()].sort(([a], [b]) => a.localeCompare(b));
  const files = [...node.files].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const hasItems = folders.length + files.length > 0;

  const fullPath = currentPath ? (name ? `${currentPath}/${name}` : currentPath) : name;

  return (
    <div className="tree-node">
      {name && (
        <div
          className="tree-row tree-folder"
          style={{ paddingLeft: `${12 + depth * 22}px` }}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="tree-arrow">
            {hasItems ? (
              open ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <span className="tree-spacer" />
            )}
          </span>
          {open ? <FolderOpen size={18} /> : <Folder size={18} />}
          <span className="tree-folder-name">{name}</span>
          <small className="tree-count">{folders.length + files.length}</small>

          <div
            className="tree-actions"
            onClick={(e) => e.stopPropagation()}
          >
            {onCreateFolder && (
              <button
                className="tree-action-btn"
                title={`New folder in ${name}`}
                onClick={() => onCreateFolder(fullPath)}
              >
                <FolderPlus size={15} />
              </button>
            )}
            {node.folderItem && onRename && (
              <button
                className="tree-action-btn"
                title={`Rename folder ${name}`}
                onClick={() => onRename(node.folderItem)}
              >
                <Pencil size={14} />
              </button>
            )}
            {node.folderItem && onDelete && (
              <button
                className="tree-action-btn danger-icon"
                title={`Delete folder ${name}`}
                onClick={() => onDelete(node.folderItem)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {(open || !name) && (
        <div>
          {folders.map(([folderName, folder]) => (
            <TreeNode
              key={folderName}
              node={folder}
              name={folderName}
              currentPath={fullPath}
              depth={depth + (name ? 1 : 0)}
              onPreview={onPreview}
              onRename={onRename}
              onDelete={onDelete}
              onCreateFolder={onCreateFolder}
              defaultOpen={true}
            />
          ))}
          {files.map((file) => (
            <div
              className="tree-row tree-file"
              style={{ paddingLeft: `${38 + depth * 22}px` }}
              key={file.id}
            >
              <FileCode size={16} />
              <span className="tree-file-name" title={filePath(file)}>
                {file.displayName}
              </span>
              <div className="tree-actions">
                <button
                  className="tree-btn-view"
                  title={`View ${file.displayName}`}
                  onClick={() => onPreview(file)}
                >
                  <Eye size={14} />
                  <span>View</span>
                </button>
                {onRename && (
                  <button
                    className="tree-action-btn"
                    title={`Rename ${file.displayName}`}
                    onClick={() => onRename(file)}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {onDelete && (
                  <button
                    className="tree-action-btn danger-icon"
                    title={`Delete ${file.displayName}`}
                    onClick={() => onDelete(file)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderTree({ files, onPreview, onRename, onDelete, onCreateFolder }) {
  const tree = useMemo(() => makeTree(files), [files]);

  if (!files.length) return <div className="empty-state">No files match your filters.</div>;

  return (
    <div className="folder-tree" role="tree" aria-label="Folder structure">
      <TreeNode
        node={tree}
        depth={0}
        onPreview={onPreview}
        onRename={onRename}
        onDelete={onDelete}
        onCreateFolder={onCreateFolder}
        defaultOpen={true}
      />
    </div>
  );
}

export default FolderTree;
