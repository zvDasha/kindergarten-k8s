import React from "react";
import GroupSchedule from "./GroupSchedule";

function DataList({
  items,
  activeTab,
  onDelete,
  onEdit,
  userRole,
  getAccessTokenSilently,
}) {
  return (
    <div className="grid">
      {items.map((item) => (
        <div key={item._id} className="card">
          {activeTab === "children" && (
            <>
              <h3>{item.name}</h3>
              <p>Group: {item.group?.name || "None"}</p>
              <div className={`status ${item.isPresent ? "in" : "out"}`}>
                {item.isPresent ? "At kindergarten" : "At home"}
              </div>
            </>
          )}

          {activeTab === "groups" && (
            <>
              <h3>{item.name}</h3>
              <p>Room: {item.room}</p>
              <GroupSchedule
                groupId={item._id}
                userRole={userRole}
                getAccessTokenSilently={getAccessTokenSilently}
              />
            </>
          )}

          {activeTab === "announcement" && (
            <>
              <h3> {item.title}</h3>
              <p>{item.content}</p>
              <small>{new Date(item.date).toLocaleDateString()}</small>
            </>
          )}

          {activeTab === "users" && (
            <>
              <h3> {item.username}</h3>
              <p>
                Role: <strong>{item.role}</strong>
              </p>
              <small>ID: {item._id}</small>
            </>
          )}
          <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
            {activeTab !== "users" && userRole === "admin" && (
              <button
                onClick={() => onEdit(item)}
                style={{
                  flex: 1,
                  background: "#f1c40f",
                  color: "black",
                  border: "none",
                  padding: "5px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
            )}

            {userRole === "admin" && (
              <button
                className="delete-btn"
                onClick={() => onDelete(item._id)}
                style={{ flex: 1 }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DataList;
