import React from "react";
import { cn } from "@/lib/utils";

export interface FirstBankLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FirstBankLogo({ className, size = "md" }: FirstBankLogoProps) {
  const sizeClasses = {
    sm: "size-6 rounded-md",
    md: "size-7 rounded-md",
    lg: "size-8 rounded-lg",
  }[size];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-[#00205B] shadow-xs select-none",
        sizeClasses,
        className,
      )}
      title="FirstBank FIRSTASSIST"
      aria-label="FirstBank Logo"
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-[84%]"
      >
        {/* Background shield/crest subtle highlight */}
        <rect width="40" height="40" rx="8" fill="#00205B" />

        {/* FirstBank Golden Elephant silhouette */}
        <g fill="#F5B324">
          {/* Main body & back curve */}
          <path d="M26.5 13C24.5 10.8 21.2 9.5 18 9.5C13.2 9.5 9.5 12.8 8.5 17.5C7.8 20.8 8.2 24.5 9 27.5H12.5V23C12.5 22.2 13.2 21.5 14 21.5H16.5V27.5H20V23C20 22.2 20.7 21.5 21.5 21.5H24.5V27.5H28C28.8 25.2 29.5 22 29.5 19C29.5 16.5 28.5 14.5 26.5 13Z" />
          
          {/* Head & Trunk curving forward/up */}
          <path d="M25 12.5C27 12.5 29 13.5 30.5 15.2C31.8 16.8 32.5 19 32.5 21.2C32.5 22.5 31.8 23.5 30.8 23.5C29.8 23.5 29.2 22.5 29.2 21.2C29.2 19.8 28.5 18.2 27.2 17.2C26.5 16.7 25.8 16.4 25 16.4V12.5Z" />
          
          {/* Large Fan Ear */}
          <path d="M22.5 13.8C24.2 14.2 25.5 15.8 25.5 17.8C25.5 20.2 23.8 22.2 21.8 22.2C20.5 22.2 19.5 21.2 19.5 19.8C19.5 17.2 20.8 14.5 22.5 13.8Z" fill="#E5A823" />
          
          {/* Tusk (Ivory accent) */}
          <path d="M27 18.5C28.2 18.5 29.5 19.2 29.8 20.5C29.2 20.8 28.2 20.8 27.2 20.2L27 18.5Z" fill="#FFFFFF" />
          
          {/* Golden base pedestal line */}
          <rect x="7" y="28.5" width="26" height="2" rx="1" fill="#F5B324" />
        </g>
      </svg>
    </div>
  );
}
