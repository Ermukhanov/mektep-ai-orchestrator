import { GraduationCap } from "lucide-react";

export function Logo({ size = "md", inverted = false }: { size?: "sm" | "md" | "lg"; inverted?: boolean }) {
  const sizes = {
    sm: { wrap: "h-8 w-8", icon: "h-4 w-4", text: "text-base" },
    md: { wrap: "h-10 w-10", icon: "h-5 w-5", text: "text-xl" },
    lg: { wrap: "h-14 w-14", icon: "h-7 w-7", text: "text-3xl" },
  }[size];

  return (
    <div className="flex items-center gap-3">
      <div className={`${sizes.wrap} rounded-xl gradient-success flex items-center justify-center shadow-glow`}>
        <GraduationCap className={`${sizes.icon} text-white`} />
      </div>
      <div className={`font-display font-bold tracking-tight ${sizes.text} ${inverted ? "text-white" : "text-foreground"}`}>
        MEKTEP <span className="text-accent">AI</span>
      </div>
    </div>
  );
}
