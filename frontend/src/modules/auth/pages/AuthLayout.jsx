import { FiEdit3 } from 'react-icons/fi';

export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <div className="brand" style={{ padding: 0 }}><span className="brand-mark"><FiEdit3 size={18} /></span>Aula</div>
        <div>
          <h1>Cada curso, cada nota, <em>en su lugar.</em></h1>
          <p>La gestión de tu institución, ordenada como un cuaderno bien llevado.</p>
        </div>
        <small style={{ color: '#8F98BD' }}>Acceso exclusivo para personal, docentes y representantes.</small>
      </section>
      <main className="auth-form"><div className="auth-card">{children}</div></main>
    </div>
  );
}
