//replaced axios interceptor + localStorage with Auth0 hooks
import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import io from "socket.io-client";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

//removed Login import — Auth0 handles login page
import DataForm from "./components/newChildForm";
import DataList from "./components/cardList";
import { API_URL, BACKEND_URL } from "./config";

const socket = io(BACKEND_URL);

function App() {
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    isLoading,
    getAccessTokenSilently,
  } = useAuth0();

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

  //role is read from Auth0 token claim instead of API response
  const roles = user?.["https://kindergarten/roles"] ?? [];
  const userRole = roles.includes("admin") ? "admin" : "parent";

  const getAuthHeader = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    });
    return { Authorization: `Bearer ${token}` };
  };

  const fetchData = async () => {
    if (!isAuthenticated) return;
    if (activeTab === "profile") return;

    try {
      const headers = await getAuthHeader();
      const params = {
        search: activeTab === "children" ? search : undefined,
      };

      const res = await axios.get(`${API_URL}/${activeTab}`, {
        headers,
        params,
      });
      setItems(res.data);

      if (activeTab === "children") {
        const groupsRes = await axios.get(`${API_URL}/groups`, { headers });
        setGroupsList(groupsRes.data);
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, search, isAuthenticated]);

  useEffect(() => {
    socket.on("update", (data) => {
      toast.info(`${data.msg}`);
      if (activeTab !== "profile") fetchData();
    });
    return () => socket.off("update");
  }, [activeTab, isAuthenticated]);

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
      const headers = await getAuthHeader();
      if (isEditing) {
        await axios.put(`${API_URL}/${activeTab}/${editId}`, formData, {
          headers,
        });
        toast.success("Successfully updated!");
      } else {
        await axios.post(`${API_URL}/${activeTab}`, formData, { headers });
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
      const headers = await getAuthHeader();
      await axios.delete(`${API_URL}/${activeTab}/${id}`, { headers });
      toast.warn("Deleted!");
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      const headers = await getAuthHeader();
      await axios.put(
        `${API_URL}/users/${user.sub}/password`,
        { newPassword },
        { headers },
      );
      toast.success("Password changed!");
      setNewPassword("");
    } catch (err) {
      toast.error("Error: Password too short or server error");
    }
  };

  //replaced <Login> component with Auth0 loginWithRedirect
  if (isLoading) return <div style={{ padding: "2rem" }}>Loading...</div>;

  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div
          className="form-card"
          style={{ width: "320px", textAlign: "center" }}
        >
          <h2>Kindergarten</h2>
          <p style={{ color: "#666", marginBottom: "20px" }}>
            Please log in to continue
          </p>
          <button
            onClick={() => loginWithRedirect()}
            style={{
              background: "var(--primary-color)",
              color: "white",
              border: "none",
              padding: "12px 30px",
              borderRadius: "30px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "1rem",
            }}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <ToastContainer position="top-right" />

      <header>
        <h1>Kindergarten: {user.name || user.email}</h1>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span className="badge">
            {userRole === "admin" ? "Admin" : "Parent"}
          </span>
          <button
            onClick={() =>
              logout({ logoutParams: { returnTo: window.location.origin } })
            }
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
          {userRole === "admin" && (
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
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Role:</strong> {userRole}
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
                userRole === "admin" && (
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
              userRole={userRole}
              getAccessTokenSilently={getAccessTokenSilently}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
