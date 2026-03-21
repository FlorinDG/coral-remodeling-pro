import { redirect } from "next/navigation";

export default function LibraryRootRedirect() {
    redirect('/admin/library/articles');
}
