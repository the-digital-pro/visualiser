import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Not found</h1>
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        Back to home
      </Link>
    </div>
  );
}
