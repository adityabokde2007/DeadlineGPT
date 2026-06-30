import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Sparkles } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  publicOnly?: boolean;
}

/**
 * Route protection component.
 * If publicOnly is true, authenticated users are redirected to /dashboard.
 * If publicOnly is false/undefined, unauthenticated users are redirected to /.
 */
export default function ProtectedRoute({ children, publicOnly = false }: ProtectedRouteProps) {
  const { currentUser, loading } = useAuth();

  // Show a professional, branded loading skeleton/spinner state during authentication check
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-on-surface select-none">
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <Sparkles size={16} className="absolute text-primary animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight text-on-surface">DeadlineGPT</h4>
            <p className="text-xs font-semibold text-on-surface-variant/80 mt-1">Securing your sync parameters...</p>
          </div>
        </div>
      </div>
    );
  }

  if (publicOnly && currentUser) {
    // If user is already logged in, they shouldn't access Login/Signup pages
    return <Navigate to="/dashboard" replace />;
  }

  if (!publicOnly && !currentUser) {
    // If not logged in, redirect home/protected page requests to Landing page
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
