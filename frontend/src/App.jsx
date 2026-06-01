import { useEffect, useState } from "react";
import axios from "axios";
import io from "socket.io-client";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

import Login from "./Login";
import DataForm from "./components/newChildForm";
import DataList from "./components/cardList";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
const socket = io(BACKEND_URL);
const API_URL = `${BACKEND_URL}/api`;

axios.interceptors.request.use(function (config) {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("children");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    group: "",
    title: "",
    content: "",
    room: "",
    rfid: "",
  });
  const [groupsList, setGroupsList] = useState([]);

  const [newPassword, setNewPassword] = useState("");

  const fetchData = async () => {
    if (!user) return;
    if (activeTab === "profile") return;

    try {
      const params = {
        search: activeTab === "children" ? search : undefined,
        parentId: user.id,
        role: user.role,
      };

      const res = await axios.get(`${API_URL}/${activeTab}`, { params });
      setItems(res.data);

      if (activeTab === "children") {
        const groupsRes = await axios.get(`${API_URL}/groups`);
        setGroupsList(groupsRes.data);
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, search, user]);

  useEffect(() => {
    socket.on("update", (data) => {
      toast.info(`${data.msg}`);
      if (activeTab !== "profile") fetchData();
    });
    return () => socket.off("update");
  }, [activeTab, user]);

  const handleEditClick = (item) => {
    setFormData({
      name: item.name || "",
      group: item.group?._id || item.group || "",
      title: item.title || "",
      content: item.content || "",
      room: item.room || "",
      rfid: item.rfid || "",
    });
    setEditId(item._id);
    setIsEditing(true);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      group: "",
      title: "",
      content: "",
      room: "",
      rfid: "",
    });
    setIsEditing(false);
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = { ...formData, parentId: user.id };

      if (isEditing) {
        await axios.put(`${API_URL}/${activeTab}/${editId}`, dataToSend);
        toast.success("Successfully updated!");
      } else {
        await axios.post(`${API_URL}/${activeTab}`, dataToSend);
        toast.success("Successfully added!");
      }
      resetForm();
      fetchData();
    } catch (err) {
      toast.error("Error saving data");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete record?")) return;
    try {
      await axios.delete(`${API_URL}/${activeTab}/${id}`);
      toast.warn("Deleted!");
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/users/${user.id}/password`, { newPassword });
      toast.success("Password changed!");
      setNewPassword("");
    } catch (err) {
      toast.error("Error: Password too short or server error");
    }
  };

  if (!user) {
    return (
      <>
        <ToastContainer position="top-right" />
        <Login onLogin={(userData) => setUser(userData)} />
      </>
    );
  }

  return (
    <div className="container">
      <ToastContainer position="top-right" />

      <header>
        <h1>Kindergarten: {user.name}</h1>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span className="badge">
            {user.role === "admin" ? "Admin" : "Parent"}
          </span>
          <button
            onClick={() => {
              setUser(null);
              localStorage.removeItem("token");
            }}
            style={{
              background: "#ff7675",
              padding: "8px 15px",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        <nav>
          <button
            onClick={() => {
              setActiveTab("children");
              resetForm();
            }}
            className={activeTab === "children" ? "active" : ""}
          >
            Children
          </button>
          <button
            onClick={() => {
              setActiveTab("groups");
              resetForm();
            }}
            className={activeTab === "groups" ? "active" : ""}
          >
            Groups
          </button>
          <button
            onClick={() => {
              setActiveTab("announcement");
              resetForm();
            }}
            className={activeTab === "announcement" ? "active" : ""}
          >
            Announcements
          </button>
          {user.role === "admin" && (
            <button
              onClick={() => {
                setActiveTab("users");
                resetForm();
              }}
              className={activeTab === "users" ? "active" : ""}
            >
              Users
            </button>
          )}

          <button
            onClick={() => {
              setActiveTab("profile");
              resetForm();
            }}
            className={activeTab === "profile" ? "active" : ""}
          >
            Profile
          </button>
        </nav>
      </header>

      <main>
        {activeTab === "profile" ? (
          <div className="form-card">
            <h3>My Profile</h3>
            <p>
              <strong>Username:</strong> {user.name}
            </p>
            <p>
              <strong>Role:</strong> {user.role}
            </p>
            <hr />
            <h4>Change Password</h4>
            <form onSubmit={handleChangePassword}>
              <input
                type="password"
                placeholder="New Password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                style={{ background: "var(--primary-color)", color: "white" }}
              >
                Update Password
              </button>
            </form>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              {activeTab === "children" ? (
                <div
                  className="search-bar"
                  style={{ marginBottom: 0, flex: 1, marginRight: "10px" }}
                >
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                </div>
              ) : (
                <div></div>
              )}

              {activeTab !== "users" &&
                activeTab !== "profile" &&
                user.role === "admin" && (
                  <button
                    onClick={() => {
                      if (showForm) resetForm();
                      else setShowForm(true);
                    }}
                    style={{
                      background: showForm ? "#ccc" : "var(--primary-color)",
                      color: "white",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "30px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {showForm ? "Cancel" : "Add record"}
                  </button>
                )}
            </div>

            {showForm && (
              <DataForm
                activeTab={activeTab}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                groupsList={groupsList}
                isEditing={isEditing}
                onCancel={resetForm}
              />
            )}

            <DataList
              items={items}
              activeTab={activeTab}
              onDelete={handleDelete}
              onEdit={handleEditClick}
              userRole={user.role}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
