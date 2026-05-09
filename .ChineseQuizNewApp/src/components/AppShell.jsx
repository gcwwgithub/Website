import { Outlet } from "react-router-dom";

export default function AppShell() {
  return (
    <>
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="top-bar-left">
            <a className="site-home-link" href="../index.html">
              WebPlayground
            </a>
          </div>
        </div>
      </header>
      <div className="app-shell">
        <Outlet />
      </div>
    </>
  );
}
