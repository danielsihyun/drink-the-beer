export default function FeedPage() {
  return (
    <div className="container max-w-2xl px-4 py-6">
      <h2 className="mb-4 text-2xl font-bold">Feed</h2>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="rounded-lg border border-border bg-card p-4">
            <p className="text-card-foreground">Sample feed item {item}. This is where your content would appear.</p>
          </div>
        ))}
      </div>
    </div>
  )
}
