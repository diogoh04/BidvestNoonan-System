import Header from "@/components/Header";
import UserForm from "@/components/UserForm";

export default function NewUserPage() {
  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">New access account</h1>
        <p className="mt-1 text-sm text-ink/50">
          Team Leaders need to be linked to a Staff already registered as team leader of a building.
        </p>
        <div className="mt-6">
          <UserForm />
        </div>
      </main>
    </>
  );
}
