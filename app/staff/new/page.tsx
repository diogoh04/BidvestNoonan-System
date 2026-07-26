import Header from "@/components/Header";
import StaffForm from "@/components/StaffForm";

export default function NewStaffPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Register Staff</h1>
        <p className="mt-1 text-sm text-ink/50">
          Choose the type first — the form will adjust between Cleaner and Team Leader.
        </p>
        <div className="mt-6">
          <StaffForm />
        </div>
      </main>
    </>
  );
}
