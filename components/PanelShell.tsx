export default function PanelShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center px-4 py-10">
      {children}
    </main>
  );
}
