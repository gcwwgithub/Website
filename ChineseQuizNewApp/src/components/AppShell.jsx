import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { useAuth } from "../state/AuthContext.jsx";

const navItems = [
  ["Menu", "/"],
  ["Quiz", "/quiz"],
  ["Words", "/words"],
  ["Progress", "/progress"],
  ["Settings", "/settings"],
];

export default function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">ChineseQuizNew</p>
          <h1>Vocabulary Quiz</h1>
        </div>
        <button className="ghost-button" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <nav className="tab-bar" aria-label="Primary">
        {navItems.map(([label, to]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            {label}
          </NavLink>
        ))}
      </nav>

      <p className="user-line">{user?.email}</p>
      <Outlet />
    </div>
  );
}
