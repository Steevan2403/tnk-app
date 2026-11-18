export function ComingSoon({ title }: { title: string }) {
  return (
    <section>
      <h1 className="font-serif text-3xl">{title}</h1>
      <p className="mt-3 text-muted">Coming soon</p>
    </section>
  );
}
