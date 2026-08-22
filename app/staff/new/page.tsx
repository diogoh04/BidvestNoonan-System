import Header from "@/components/Header";
import StaffForm from "@/components/StaffForm";

export default function NewStaffPage() {
  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Register Staff</h1>
        <p className="mt-1 text-sm text-ink/50">
          Add buildings this person cleans, and/or connect them as leader of one or more teams.
        </p>
        <div className="mt-6">
          <StaffForm />
        </div>
      </main>
    </>
  );
}
