import { redirect } from "next/navigation";

/** The workspace landing route sends agents straight to the inbox. */
export default function WorkspaceRoot() {
  redirect("/inbox");
}
