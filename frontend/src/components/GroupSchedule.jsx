import React, { useState } from "react";
import axios from "axios";
import "./groupSchedule.css";
import { API_URL } from "../config";

const GroupSchedule = ({ groupId, userRole, getAccessTokenSilently }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [activeDay, setActiveDay] = useState(null);

  const getAuthHeader = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    });
    return { Authorization: `Bearer ${token}` };
  };

  const fetchSchedule = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/schedule/${groupId}`, {
        headers,
      });
      setSchedule(res.data);
    } catch (err) {
      console.error("Error fetching schedule:", err);
    }
  };

  const toggleSchedule = () => {
    if (!isOpen && !schedule) {
      fetchSchedule();
    }
    setIsOpen(!isOpen);
  };

  const toggleDay = (dayName) => {
    setActiveDay(activeDay === dayName ? null : dayName);
  };

  const updateSchedule = async (newDays) => {
    const updatedSchedule = { ...schedule, days: newDays };
    setSchedule(updatedSchedule);

    try {
      const headers = await getAuthHeader();
      await axios.put(
        `${API_URL}/schedule/${groupId}`,
        { days: newDays },
        { headers },
      );
    } catch (err) {
      console.error("Error saving schedule:", err);
    }
  };

  const addActivity = (dayIndex, time, description) => {
    if (!time || !description) return;
    const newDays = [...schedule.days];
    newDays[dayIndex].activities.push({ time, description });
    newDays[dayIndex].activities.sort((a, b) => a.time.localeCompare(b.time));
    updateSchedule(newDays);
  };

  const deleteActivity = (dayIndex, activityIndex) => {
    const newDays = [...schedule.days];
    newDays[dayIndex].activities.splice(activityIndex, 1);
    updateSchedule(newDays);
  };

  return (
    <div className="schedule-wrapper">
      <button className="schedule-toggle-btn" onClick={toggleSchedule}>
        {isOpen ? "Close Schedule" : "Show Schedule"}
      </button>

      {isOpen && schedule && (
        <div className="schedule-days">
          {schedule.days.map((day, dIndex) => (
            <div
              key={day.name}
              className={`day-item ${activeDay === day.name ? "open" : ""}`}
            >
              <div className="day-header" onClick={() => toggleDay(day.name)}>
                <span>{day.name}</span>
                <span className="arrow">
                  {activeDay === day.name ? "▲" : "▼"}
                </span>
              </div>

              {activeDay === day.name && (
                <div className="day-content">
                  {day.activities.length === 0 ? (
                    <p className="no-activities">No activities.</p>
                  ) : (
                    <ul className="activity-list">
                      {day.activities.map((act, aIndex) => (
                        <li key={aIndex}>
                          <span className="time">{act.time}</span>
                          <span className="desc">{act.description}</span>
                          {userRole === "admin" && (
                            <button
                              className="delete-activity-btn"
                              onClick={() => deleteActivity(dIndex, aIndex)}
                            >
                              x
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {userRole === "admin" && (
                    <AddActivityForm
                      onAdd={(t, d) => addActivity(dIndex, t, d)}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AddActivityForm = ({ onAdd }) => {
  const [time, setTime] = useState("");
  const [desc, setDesc] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(time, desc);
    setTime("");
    setDesc("");
  };

  return (
    <form className="add-activity-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="time-input"
      />
      <input
        type="text"
        placeholder="Activity"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        className="desc-input"
      />
      <button type="submit" className="add-btn">
        +
      </button>
    </form>
  );
};

export default GroupSchedule;
