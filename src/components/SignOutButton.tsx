import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-[11px] uppercase tracking-[0.14em]"
      onClick={async () => {
        await signOut();
        navigate("/");
      }}
    >
      <LogOut className="size-3.5" />
      EXIT
    </Button>
  );
}
