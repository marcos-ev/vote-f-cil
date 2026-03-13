import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { clearAuthSession, setAuthSession, type AuthSession } from "@/lib/auth-session";
import { firebaseAuth } from "@/lib/firebase";

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function usernameToEmail(username: string) {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9._-]{3,}$/.test(normalized)) {
    throw new Error("Nome de usuário inválido. Use ao menos 3 caracteres: letras, números, ponto, hífen ou underscore.");
  }
  return `${normalized}@pokerplanning.app`;
}

function usernameFromEmail(email: string | null | undefined) {
  if (!email) return "";
  return String(email.split("@")[0] || "").trim().toLowerCase();
}

async function toSession(user: User, forcedUsername?: string): Promise<AuthSession> {
  const token = await user.getIdToken();
  const username = forcedUsername || usernameFromEmail(user.email) || user.uid;
  const displayName = user.displayName?.trim() || username;
  return {
    token,
    user: {
      id: user.uid,
      username,
      displayName,
    },
  };
}

function mapFirebaseAuthError(error: unknown, fallback: string) {
  const code = String((error as { code?: string })?.code || "");
  if (code.includes("auth/email-already-in-use")) return "Este usuário já existe.";
  if (code.includes("auth/invalid-credential")) return "Usuário ou senha inválidos.";
  if (code.includes("auth/user-disabled")) return "Este usuário foi desativado.";
  if (code.includes("auth/too-many-requests")) return "Muitas tentativas. Aguarde e tente novamente.";
  if (code.includes("auth/network-request-failed")) return "Falha de rede ao falar com Firebase.";
  return fallback;
}

export async function registerWithFirebase(input: { username: string; displayName: string; password: string }) {
  const username = normalizeUsername(input.username);
  const displayName = input.displayName.trim();
  const password = input.password;

  if (!username || !displayName || !password) {
    throw new Error("Preencha usuário, nome e senha.");
  }
  if (displayName.length < 2) {
    throw new Error("Informe um nome com pelo menos 2 caracteres.");
  }
  if (password.length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }

  try {
    const email = usernameToEmail(username);
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await updateProfile(credential.user, { displayName });
    const session = await toSession(credential.user, username);
    setAuthSession(session);
    return session;
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, "Falha no cadastro."));
  }
}

export async function loginWithFirebase(input: { username: string; password: string }) {
  const username = normalizeUsername(input.username);
  if (!username || !input.password) {
    throw new Error("Informe usuário e senha.");
  }
  try {
    const email = usernameToEmail(username);
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, input.password);
    const session = await toSession(credential.user, username);
    setAuthSession(session);
    return session;
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, "Falha no login."));
  }
}

export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(firebaseAuth, provider);
    const user = credential.user;
    const username = usernameFromEmail(user.email) || user.uid;
    if (!user.displayName?.trim()) {
      await updateProfile(user, { displayName: username });
    }
    const session = await toSession(user, username);
    setAuthSession(session);
    return session;
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, "Falha ao entrar com Google."));
  }
}

function waitForFirebaseAuthReady() {
  return new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getCurrentFirebaseSession() {
  const user = firebaseAuth.currentUser || (await waitForFirebaseAuthReady());
  if (!user) return null;
  const session = await toSession(user);
  setAuthSession(session);
  return session;
}

export async function logoutFirebase() {
  await signOut(firebaseAuth).catch(() => {
    // Limpa sessão local mesmo em caso de erro remoto.
  });
  clearAuthSession();
}
