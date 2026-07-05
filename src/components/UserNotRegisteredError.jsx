import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Account Not Found</h1>
        <p className="text-muted-foreground mb-8">
          Your account is not registered in the QuantHedger system. Please contact your administrator or register for access.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Register Now
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
