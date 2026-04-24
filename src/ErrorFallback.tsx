import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

export const ErrorFallback = ({ error, resetErrorBoundary }) => {
  const errorMessage = error?.message || "Unknown runtime error";
  const isMissingSupabaseEnv = errorMessage.includes(
    "Missing Supabase environment variables"
  );

  if (isMissingSupabaseEnv) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Supabase configuration is missing</AlertTitle>
            <AlertDescription>
              The app could not start because required Supabase variables are not available in this runtime.
            </AlertDescription>
          </Alert>

          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-foreground">How to fix</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Open your project settings.</li>
              <li>Go to Secrets (or Environment Variables, depending on UI version).</li>
              <li>Add VITE_SUPABASE_URL with your Supabase project URL.</li>
              <li>Add VITE_SUPABASE_ANON_KEY with your Supabase anon key.</li>
              <li>Save and redeploy the project.</li>
            </ol>
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Local development fallback</h3>
            <p className="text-sm text-muted-foreground">
              Create a .env.local file in project root with:
            </p>
            <pre className="text-xs bg-muted/50 p-3 rounded border overflow-auto">
{`VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY`}
            </pre>
          </div>

          <Button onClick={resetErrorBoundary} className="w-full" variant="outline">
            <RefreshCwIcon />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangleIcon />
          <AlertTitle>This app has encountered a runtime error</AlertTitle>
          <AlertDescription>
            Something unexpected happened while running the application. The error details are shown below. Contact the rpm author and let them know about this issue.
          </AlertDescription>
        </Alert>
        
        <div className="bg-card border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">Error Details:</h3>
          <pre className="text-xs text-destructive bg-muted/50 p-3 rounded border overflow-auto max-h-32">
            {errorMessage}
          </pre>
        </div>
        
        <Button 
          onClick={resetErrorBoundary} 
          className="w-full"
          variant="outline"
        >
          <RefreshCwIcon />
          Try Again
        </Button>
      </div>
    </div>
  );
}
