type Props = {
  value: string
  label: string
  small?: boolean
}

export function StatCard({ value, label, small = false }: Props) {
  return (
    <div className="bg-raised rounded-lg p-4 flex flex-col gap-1 border border-rim">
      <span
        className={`font-display tracking-wide text-amber leading-none ${
          small ? 'text-3xl' : 'text-5xl'
        }`}
      >
        {value}
      </span>
      <span className="text-secondary text-xs uppercase tracking-widest font-body">
        {label}
      </span>
    </div>
  )
}
