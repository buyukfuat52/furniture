export default function HealthPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

  return (
    <main className="content">
      <p className="topline">P2 saglik sayfasi</p>
      <h1 className="title">Servis baglanti bilgileri</h1>
      <table className="table">
        <tbody>
          <tr>
            <th>Core API</th>
            <td>{apiBaseUrl}/api/v1/health</td>
          </tr>
          <tr>
            <th>Compute API</th>
            <td>server-side gateway only</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
