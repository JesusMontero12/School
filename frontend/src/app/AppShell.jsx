import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FiLogOut, FiLock, FiMenu, FiEdit3 } from "react-icons/fi";
import { FaGraduationCap } from "react-icons/fa";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../modules/auth/store/authStore";
import { fullName, initials } from "../utils/format";
import { groupNav, NAV_ITEMS } from "./navigation";

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { can } = usePermission();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  const groups = groupNav(NAV_ITEMS.filter((i) => can(i.permission)));
  const exit = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="shell">
      <a href="#contenido" className="visually-hidden-focusable">
        Saltar al contenido
      </a>
      <div
        className={`scrim ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="brand">
          <span className="brand-mark">
            <FaGraduationCap size={28} />
          </span>
          <div className="brand-header">
            U · E · C<span>"José Antonio Anzoátegui"</span>
          </div>
        </div>
        <nav>
          {groups.map(([group, items]) => (
            <div className="nav-group" key={group}>
              <span>{group}</span>
              {items.map(({ path, label, icon: Icon, end }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={end}
                  className={({ isActive }) =>
                    `nav-link-x ${isActive ? "active" : ""}`
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="me-card">
            <span className="avatar">
              {initials(user.firstName, user.lastName)}
            </span>
            <div style={{ minWidth: 0 }}>
              <strong>{fullName(user)}</strong>
              <small>{user.roles[0]?.replace("_", " ").toLowerCase()}</small>
            </div>
          </div>
          <NavLink to="/change-password" className="nav-link-x mt-2">
            <FiLock size={18} />
            Cambiar contraseña
          </NavLink>
          <button
            className="nav-link-x w-100 border-0 bg-transparent"
            onClick={exit}
          >
            <FiLogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <strong
            style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}
          >
            Aula
          </strong>
          <button
            className="icon-btn"
            style={{ color: "#fff" }}
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <FiMenu size={22} />
          </button>
        </header>
        <main id="contenido" className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
