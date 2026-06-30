import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  User, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, database } from "../firebase/config";
import { googleProvider, githubProvider } from "../firebase/auth";
import { createUserRecord, updateUserLastLogin } from "../services/userService";
import { subscribeToUserPrefs, UserPrefs } from "../services/firestoreService";
import toast from "react-hot-toast";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  googleAccessToken: string | null;
  userPrefs: UserPrefs | null;
  signup: (email: string, password: string, fullName: string) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  googleSignIn: () => Promise<User>;
  githubSignIn: () => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  getValidGoogleAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}

export function handleAuthError(error: any): string {
  const code = error?.code;
  let message = "Something went wrong. Please try again.";
  
  switch (code) {
    case "auth/email-already-in-use":
      message = "This email is already registered.";
      break;
    case "auth/invalid-email":
      message = "Please enter a valid email address.";
      break;
    case "auth/user-not-found":
      message = "No account found with this email.";
      break;
    case "auth/wrong-password":
      message = "Incorrect password.";
      break;
    case "auth/invalid-credential":
      message = "Invalid email or password.";
      break;
    case "auth/too-many-requests":
      message = "Too many attempts. Please wait a moment and try again.";
      break;
    case "auth/popup-closed-by-user":
      message = "Sign-in was cancelled. Please try again.";
      break;
    case "auth/network-request-failed":
      message = "Network error. Please check your internet connection and try again.";
      break;
    case "auth/user-disabled":
      message = "This account has been disabled. Please contact support.";
      break;
    default:
      // Always fallback to generic message instead of raw Firebase error string
      message = "Something went wrong. Please try again.";
      break;
  }
  
  toast.error(message);
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('googleAccessToken');
  });
  const [googleRefreshToken, setGoogleRefreshToken] = useState<string | null>(() => {
    return localStorage.getItem('googleRefreshToken');
  });
  const [googleTokenExpiry, setGoogleTokenExpiry] = useState<number | null>(() => {
    const expiry = localStorage.getItem('googleTokenExpiry');
    return expiry ? parseInt(expiry, 10) : null;
  });
  const [userPrefs, setUserPrefs] = useState<UserPrefs | null>(null);

  // Monitor auth state changes
  useEffect(() => {
    let unsubscribePrefs: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setGoogleAccessToken(null);
        setGoogleRefreshToken(null);
        setGoogleTokenExpiry(null);
        setUserPrefs(null);
        localStorage.removeItem('googleAccessToken');
        localStorage.removeItem('googleRefreshToken');
        localStorage.removeItem('googleTokenExpiry');
        if (unsubscribePrefs) {
          unsubscribePrefs();
          unsubscribePrefs = undefined;
        }
      } else {
        unsubscribePrefs = subscribeToUserPrefs(user.uid, (prefs) => {
          setUserPrefs(prefs);
        });
      }
      setLoading(false);
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribePrefs) unsubscribePrefs();
    };
  }, []);

  const persistGoogleToken = (token: string, refreshToken?: string, expiresIn?: number) => {
    setGoogleAccessToken(token);
    localStorage.setItem('googleAccessToken', token);
    
    if (refreshToken) {
      setGoogleRefreshToken(refreshToken);
      localStorage.setItem('googleRefreshToken', refreshToken);
    }
    
    // Default to 1 hour (3600 seconds) if not provided
    const expiryTime = Date.now() + (expiresIn || 3600) * 1000;
    setGoogleTokenExpiry(expiryTime);
    localStorage.setItem('googleTokenExpiry', expiryTime.toString());
  };


  // Email and Password Sign Up
  const signup = async (email: string, password: string, fullName: string): Promise<User> => {
    setLoading(true);
    try {
      // 1. Create authentication user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Update profile with display name
      await updateProfile(user, {
        displayName: fullName.trim(),
        photoURL: ""
      });

      // 3. Store user details in Realtime Database
      await createUserRecord(user.uid, {
        name: fullName.trim(),
        email: email.trim(),
        provider: "email",
        photoURL: ""
      });

      toast.success("Account created successfully.");
      return user;
    } catch (error) {
      handleAuthError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Email and Password Log In
  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Update user lastLogin timestamp
      await updateUserLastLogin(user.uid);

      toast.success("Logged in successfully.");
      return user;
    } catch (error) {
      handleAuthError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Log Out
  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await signOut(auth);
      toast.success("Logged out successfully.");
    } catch (error) {
      handleAuthError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Google Sign In
  const googleSignIn = async (): Promise<User> => {
    setLoading(true);
    try {
      googleProvider.setCustomParameters({
        prompt: 'consent',
        access_type: 'offline'
      });
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      
      const credential = GoogleAuthProvider.credentialFromResult(userCredential);
      
      // Try to get refresh token from _tokenResponse if available (Firebase internal)
      const tokenResponse = (userCredential as any)._tokenResponse;
      const refreshToken = tokenResponse?.oauthRefreshToken || tokenResponse?.refreshToken;
      const expiresIn = tokenResponse?.oauthExpireIn || 3600;

      if (credential && credential.accessToken) {
        persistGoogleToken(credential.accessToken, refreshToken, expiresIn);
      }

      // Check if user record already exists
      const userRef = doc(database, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (!snapshot.exists()) {
        await createUserRecord(user.uid, {
          name: user.displayName || "Google User",
          email: user.email || "",
          provider: "google",
          photoURL: user.photoURL || ""
        });
      } else {
        await updateUserLastLogin(user.uid);
      }

      toast.success("Signed in with Google.");
      return user;
    } catch (error) {
      handleAuthError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // GitHub Sign In
  const githubSignIn = async (): Promise<User> => {
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, githubProvider);
      const user = userCredential.user;

      // Check if user record already exists
      const userRef = doc(database, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (!snapshot.exists()) {
        await createUserRecord(user.uid, {
          name: user.displayName || user.email?.split("@")[0] || "GitHub User",
          email: user.email || "",
          provider: "github",
          photoURL: user.photoURL || ""
        });
      } else {
        await updateUserLastLogin(user.uid);
      }

      toast.success("Signed in with GitHub.");
      return user;
    } catch (error) {
      handleAuthError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password / Password Reset Email
  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success("Password reset email sent successfully. Please check your inbox.");
    } catch (error) {
      handleAuthError(error);
      throw error;
    }
  };

  const connectGoogleCalendar = async (): Promise<void> => {
    try {
      googleProvider.setCustomParameters({
        prompt: 'consent',
        access_type: 'offline'
      });
      const userCredential = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(userCredential);
      
      const tokenResponse = (userCredential as any)._tokenResponse;
      const refreshToken = tokenResponse?.oauthRefreshToken || tokenResponse?.refreshToken;
      const expiresIn = tokenResponse?.oauthExpireIn || 3600;

      if (credential && credential.accessToken) {
        persistGoogleToken(credential.accessToken, refreshToken, expiresIn);
        toast.success("Google Calendar connected!");
      }
    } catch (error) {
      handleAuthError(error);
      throw error;
    }
  };

  const getValidGoogleAccessToken = async (): Promise<string | null> => {
    if (!googleAccessToken) return null;
    
    // Check if token is expired or about to expire in the next 2 minutes
    const now = Date.now();
    const isExpired = googleTokenExpiry ? now >= (googleTokenExpiry - 120000) : false;
    
    if (isExpired && googleRefreshToken) {
      try {
        const response = await fetch('/api/refresh-google-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            refresh_token: googleRefreshToken
          })
        });

        if (response.ok) {
          const data = await response.json();
          persistGoogleToken(data.access_token, googleRefreshToken, data.expires_in);
          return data.access_token;
        } else {
          // Refresh failed, prompt user to reconnect
          toast.error("Google Calendar not connected please connect it.");
          setGoogleAccessToken(null);
          localStorage.removeItem('googleAccessToken');
          return null;
        }
      } catch (error) {
        console.error("Failed to refresh Google token:", error);
        return null;
      }
    } else if (isExpired && !googleRefreshToken) {
      toast.error("Google Calendar not connected please connect it.");
      setGoogleAccessToken(null);
      localStorage.removeItem('googleAccessToken');
      return null;
    }
    
    return googleAccessToken;
  };

  const value = {
    currentUser,
    loading,
    googleAccessToken,
    userPrefs,
    signup,
    login,
    logout,
    googleSignIn,
    githubSignIn,
    resetPassword,
    connectGoogleCalendar,
    getValidGoogleAccessToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
