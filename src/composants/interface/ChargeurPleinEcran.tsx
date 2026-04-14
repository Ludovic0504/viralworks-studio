export default function FullScreenLoader({
  label = 'Chargement…',
}: {
  label?: string
}) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-[#0C1116]/95 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        {label && <p className="text-sm text-gray-300 font-medium">{label}</p>}
      </div>
    </div>
  )
}
