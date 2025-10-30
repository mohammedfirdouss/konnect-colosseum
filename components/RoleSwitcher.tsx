import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { useUser } from "../contexts/UserContext";

export function RoleSwitcher() {
  const { user, setUser } = useUser();

  const handleRoleToggle = (checked: boolean) => {
    if (!user) return;

    const newRole: "buyer" | "seller" = checked ? "seller" : "buyer";
    const updatedUser = { ...user, role: newRole };
    setUser(updatedUser);

    // Persist to localStorage
    localStorage.setItem("konnect_user", JSON.stringify(updatedUser));
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <Label
        htmlFor="role-switch"
        style={{ color: "#B3B3B3", fontSize: "14px" }}
      >
        Seller Mode
      </Label>
      <Switch
        id="role-switch"
        checked={user?.role === "seller"}
        onCheckedChange={handleRoleToggle}
      />
    </div>
  );
}

