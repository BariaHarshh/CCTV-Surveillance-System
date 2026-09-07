export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1220] px-6 text-center text-white">
      <div>
        <h1 className="text-2xl font-bold">Offline</h1>
        <p className="mt-3 text-sm text-slate-300">
          Offline — data may be outdated. Live camera and incident information is not available while offline.
        </p>
      </div>
    </main>
  );
}
