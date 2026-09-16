export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // pb-16 reserved for bottom nav — added in Module 12
    <div className="min-h-screen pb-16">
      {children}
    </div>
  )
}
