import Link from "next/link"

export function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="flex h-16 items-center justify-between px-4">
        {/* App Name */}
        <h1 className="text-xl font-semibold text-foreground">Drink The Beer</h1>

        {/* Profile Icon Button */}
        <Link
          href="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 transition-colors"
          aria-label="Profile"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
          </svg>
        </Link>
      </div>
    </header>
  )
}
