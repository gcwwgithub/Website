import { useState } from "react";
import { Link } from "react-router-dom";

export default function GameMenu({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="drawer-toggle"
        onClick={() => setIsOpen(true)}
        aria-label="Open game menu"
      >
        <img src="data/menu.svg" alt="" aria-hidden="true" />
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
          <Link className="drawer-link icon-drawer-link" to="/" aria-label="Quiz home">
            <img src="data/home.svg" alt="" aria-hidden="true" />
          </Link>
          {children}
        </div>
      </aside>
    </>
  );
}
