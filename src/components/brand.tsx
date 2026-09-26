import { Layers2 } from "lucide-react";
export function Brand() {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-white">
        <Layers2 size={22} aria-hidden="true" />
      </span>
      <span className="text-sm leading-tight font-bold tracking-tight">
        BJJ Training
        <br />
        <span className="font-normal">Companion</span>
      </span>
    </span>
  );
}
