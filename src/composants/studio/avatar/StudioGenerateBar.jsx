import { Loader2 } from "lucide-react";

export default function StudioGenerateBar({ onClick, disabled, loading }) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30">
      <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md bg-[#050810]/85">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className="studio-avatar-cta flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          Générer mon avatar
        </button>
      </div>
    </div>
  );
}
