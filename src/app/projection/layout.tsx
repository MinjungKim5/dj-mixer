export const metadata = {
  title: "ㅋㅁㅇ — Projection",
};

export default function ProjectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">{children}</div>
  );
}
