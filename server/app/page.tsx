export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '540px',
        padding: '2.5rem',
        borderRadius: '1rem',
        backgroundColor: '#1e293b',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        border: '1px solid #334155'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#059669',
          marginBottom: '1.5rem',
          fontSize: '28px'
        }}>
          ✓
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ffffff' }}>
          Backend API is Running!
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.75rem' }}>
          This port (<code>3000</code>) serves the Next.js API endpoints. The user interface runs on port <code>5173</code>.
        </p>
        <a
          href="http://localhost:5173"
          style={{
            display: 'inline-block',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            padding: '0.75rem 1.75rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            transition: 'background-color 0.2s'
          }}
        >
          Open FinSense App (localhost:5173) →
        </a>
      </div>
    </div>
  );
}
