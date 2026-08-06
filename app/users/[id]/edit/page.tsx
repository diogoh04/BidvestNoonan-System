import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import UserForm from "@/components/UserForm";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getUser(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/users/${id}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load user");
  return res.json();
}

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const user = await getUser(params.id);
  if (!user) notFound();

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Edit account</h1>
        <p className="mt-1 text-sm text-ink/50">{user.username}</p>
        <div className="mt-6">
          <UserForm
            initial={{
              id: user.id,
              username: user.username,
              role: user.role,
              staffId: user.staffId,
              staffNome: user.staffNome,
              active: user.active,
            }}
          />
        </div>
      </main>
    </>
  );
}
