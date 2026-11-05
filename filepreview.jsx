
import { useEffect, useState } from "react";
import { api } from "../api";
import { X, Save, FileCode } from "lucide-react";

function extractStructure(content, extension) {
  const lines = content.split("\n");
  const ext = extension?.toLowerCase();
  const items = [];

  lines.forEach((line, index) => {
    let kind = "";

    if ([".c", ".cpp", ".h", ".hpp", ".js", ".jsx", ".ts", ".tsx"].includes(ext)) {
      if (/\b(class|struct)\s+\w+/.test(line)) kind = "Class / Struct";
      else if (/\b\w+\s*\([^;]*\)\s*\{/.test(line)) kind = "Function";
      else if (/^\s*#include\b/.test(line) || /^\s*import\b/.test(line))
        kind = "Import";
    } else if (ext === ".py") {
      if (/^\s*class\s+\w+/.test(line)) kind = "Class";
      else if (/^\s*def\s+\w+/.test(line)) kind = "Function";
      else if (/^\s*import\b|^\s*from\b/.test(line)) kind = "Import";
    }

    if (kind) {
      items.push({
        line: index + 1,
        kind,
        text: line.trim(),
      });
    }
  });

  return items;
}

function FilePreview({ file, onClose, onSaved }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    api.getContent(file.id)
      .then((data) => {
        if (active) setContent(data.content ?? "");
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file.id]);

  const structure = extractStructure(content, file.extension);

  async function saveFile() {
    setSaving(true);
    setError("");

    try {
      await api.saveContent(file.id, content);
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="preview-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <FileCode size={20} />
            <strong>{file.name}</strong>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </header>

        {error && <p className="error-message">{error}</p>}

        {loading ? (
          <p>Loading file...</p>
        ) : (
          <>
            <div className="structure-panel">
              <h4>File structure</h4>
              {structure.length ? (
                structure.map((item, index) => (
                  <div className="structure-item" key={index}>
                    <span>Line {item.line}</span>
                    <b>{item.kind}</b>
                    <code>{item.text}</code>
                  </div>
                ))
              ) : (
                <p>No recognizable declarations found.</p>
              )}
            </div>

            <h4>File content</h4>
            <div className="editor">
              <div className="line-numbers">
                {content.split("\n").map((_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                spellCheck={false}
                aria-label="File content editor"
              />
            </div>

            <footer className="modal-footer">
              <button className="btn-secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn-primary" onClick={saveFile} disabled={saving}>
                <Save size={16} />
                {saving ? "Saving..." : "Save changes"}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export default FilePreview;
