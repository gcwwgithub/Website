import { useState } from "react";
import { Link } from "react-router-dom";

export default function GameMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="drawer-toggle"
        onClick={() => setIsOpen(true)}
        aria-label="Open game menu"
      >
        Menu
      </button>
      <div
        className={`drawer-backdrop ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(false)}
      />
      <aside className={`quiz-drawer ${isOpen ? "open" : ""}`}>
        <button
          className="drawer-close"
          onClick={() => setIsOpen(false)}
          aria-label="Close game menu"
        >
          x
        </button>
        <div className="drawer-content">
          <p className="eyebrow">Menu</p>
          <Link className="drawer-link" to="/">
            Quiz Home
          </Link>
        </div>
      </aside>
    </>
  );
}
