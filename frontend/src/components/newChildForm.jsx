import React from "react";

function DataForm({
  activeTab,
  formData,
  setFormData,
  onSubmit,
  groupsList,
  isEditing,
  onCancel,
}) {
  return (
    <div
      className="form-card"
      style={{ borderColor: isEditing ? "#f1c40f" : "#eee" }}
    >
      <h3>
        {isEditing
          ? `Edit record (${activeTab})`
          : `Add new record (${activeTab})`}
      </h3>
      <form onSubmit={onSubmit}>
        {activeTab === "children" && (
          <>
            <input
              required
              placeholder="Child's Full Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <input
              placeholder="RFID Card (e.g., CARD_1)"
              value={formData.rfid}
              onChange={(e) =>
                setFormData({ ...formData, rfid: e.target.value })
              }
            />
            <select
              value={formData.group}
              onChange={(e) =>
                setFormData({ ...formData, group: e.target.value })
              }
            >
              <option value="">Select Group</option>
              {groupsList.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </>
        )}
        {activeTab === "groups" && (
          <>
            <input
              required
              placeholder="Group Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <input
              required
              type="number"
              placeholder="Room Number"
              value={formData.room}
              onChange={(e) =>
                setFormData({ ...formData, room: e.target.value })
              }
            />
          </>
        )}

        {activeTab === "announcement" && activeTab === "announcement" && (
          <>
            <input
              required
              placeholder="Title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
            <input
              required
              placeholder="Announcement Text"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
            />
          </>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="submit"
            style={{
              flex: 1,
              background: isEditing ? "#f1c40f" : "#2ecc71",
              color: isEditing ? "black" : "white",
            }}
          >
            {isEditing ? "Save Changes" : "Create"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{ flex: 0.3, background: "#ccc" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default DataForm;
