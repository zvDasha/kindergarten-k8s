import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./App.css";
import { BACKEND_URL } from "./config";

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("parent");
  const [childCard, setChildCard] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.includes(" ")) {
      toast.warn("Please do not include spaces in your password.");
      return;
    }

    if (password.length < 6) {
      toast.warn("Password is too short! Minimum 6 characters.");
      return;
    }

    if (!/\d/.test(password)) {
      toast.warn("Password must contain at least one digit (0-9)!");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      toast.warn(
        "Password must contain at least one special character (!@#$%)!",
      );
      return;
    }

    const endpoint = isRegister ? "/api/register" : "/api/login";

    const payload = {
      username,
      password,
      role: isRegister ? role : undefined,
      childCard: isRegister && role === "parent" ? childCard : undefined,
    };

    try {
      const res = await axios.post(`${BACKEND_URL}${endpoint}`, payload);

      if (isRegister) {
        toast.success("Account created! Please log in now.");
        setIsRegister(false);
      } else {
        toast.success(`Hello, ${res.data.name}!`);
        localStorage.setItem("token", res.data.token);
        onLogin({ name: res.data.name, role: res.data.role, id: res.data.id });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Server error");
    }
  };

  return (
    <div
      className="login-wrapper"
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
        <h2>{isRegister ? "Registration" : "Login"}</h2>

        <form
          onSubmit={handleSubmit}
          style={{ flexDirection: "column", gap: "15px" }}
        >
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {isRegister && (
            <>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="parent">I am parents</option>
                <option value="admin">I am administrator</option>
              </select>

              {role === "parent" && (
                <input
                  placeholder="Child's RFID Card (e.g. CARD_1)"
                  value={childCard}
                  onChange={(e) => setChildCard(e.target.value)}
                  style={{ borderColor: "var(--primary-color)" }}
                  required
                />
              )}
            </>
          )}

          <button type="submit">{isRegister ? "Register" : "Login"}</button>
        </form>

        <p style={{ marginTop: "20px", fontSize: "0.9rem", color: "#666" }}>
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <br />
          <span
            onClick={() => setIsRegister(!isRegister)}
            style={{
              color: "var(--primary-color)",
              cursor: "pointer",
              fontWeight: "bold",
              textDecoration: "underline",
            }}
          >
            {isRegister ? "Login here" : "Create an account"}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;
