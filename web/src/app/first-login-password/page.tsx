import { redirect } from "next/navigation";

export default function FirstLoginPasswordRedirect() {
  redirect("/change-password");
}
