import { AlertTriangle } from "lucide-react";

function ConfirmDelete({ file, onCancel, onConfirm, loading }) {
  if (!file) return null;

  return (
    <div className="modal-backdrop">
      <section className="confirm-modal">
        <div className="warning-icon">
          <AlertTriangle size={28} />
        </div>

        <h2>Delete this {file.isFolder ? "folder" : "file"}?</h2>
        <p>
          You are about to delete <strong>{file.name}</strong>
          {file.isFolder ? " and all files inside it" : ""}.
          This action may be permanent.
        </p>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Yes, delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDelete;
