export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="h-12 flex items-center justify-between px-4 border-b">
          <div className="font-semibold">Drink The Beer</div>
          <a className="text-sm underline" href="/profile">Profile</a>
        </header>
  
        <main className="flex-1">{children}</main>
  
        <nav className="h-14 border-t flex justify-around items-center">
          <a href="/feed">Feed</a>
          <a href="/log">Log</a>
          <a href="/analytics">Analytics</a>
        </nav>
      </div>
    );
  }
  