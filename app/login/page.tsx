import { login } from "./actions";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="login">
      <div className="card">
        <h1>Administration</h1>
        <p className="hint">Accès réservé à l'équipe.</p>
        {searchParams.error && (
          <p className="alert" role="alert">
            {searchParams.error === "trop" ? "Trop de tentatives. Réessayez dans 15 minutes." : "E-mail ou mot de passe incorrect."}
          </p>
        )}
        <form action={login} className="stack">
          <label>E-mail <input type="email" name="email" autoComplete="username" required /></label>
          <label>Mot de passe <input type="password" name="password" autoComplete="current-password" required /></label>
          <button type="submit">Se connecter</button>
        </form>
      </div>
    </div>
  );
}
